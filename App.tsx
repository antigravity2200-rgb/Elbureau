import React, { useState, useEffect } from 'react';
import { GameState, GamePhase, Language, GameConfig, Player } from './types';
import { TRANSLATIONS, AVATAR_COLORS } from './constants';
import { Lobby } from './views/Lobby';
import { GameRound } from './views/GameRound';
import { EndGame } from './views/EndGame';
import { SettingsModal } from './components/SettingsModal';
import { generateQuizQuestions } from './services/geminiService';
import { createRoom, joinRoom, subscribeToRoom, updateRoomState, resetRoom } from './services/firebase';

const getInitialLanguage = (): Language => {
  const saved = localStorage.getItem('elbureau_lang');
  if (Object.values(Language).includes(saved as Language)) {
    return saved as Language;
  }
  return Language.EN;
};

const INITIAL_CONFIG: GameConfig = {
  theme: 'General Knowledge',
  questionCount: 5,
  difficulty: 'medium',
  language: getInitialLanguage(),
  timerSeconds: 0,
  allowHints: true,
  scoringMode: 'standard',
  questionTypes: 'mixed'
};

function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [playerName, setPlayerName] = useState(localStorage.getItem('elbureau_player_name') || '');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // connection state
  const [roomId, setRoomId] = useState<string | null>(() => localStorage.getItem('elbureau_room_id'));
  const [playerId, setPlayerId] = useState<string | null>(() => localStorage.getItem('elbureau_player_id'));
  const [isReconnecting, setIsReconnecting] = useState(false);

  // The synchronized game state from Firebase
  const [gameState, setGameState] = useState<GameState>({
    phase: GamePhase.LOBBY,
    apiKey: apiKey,
    config: INITIAL_CONFIG,
    players: [],
    questions: [],
    currentQuestionIndex: 0,
  });

  // --- PERSISTENCE ---
  useEffect(() => {
    if (apiKey) localStorage.setItem('gemini_api_key', apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem('elbureau_player_name', playerName);
  }, [playerName]);

  useEffect(() => {
    localStorage.setItem('elbureau_lang', gameState.config.language);
  }, [gameState.config.language]);

  // --- SESSION PERSISTENCE ---
  useEffect(() => {
    if (roomId && playerId) {
      localStorage.setItem('elbureau_room_id', roomId);
      localStorage.setItem('elbureau_player_id', playerId);
    }
  }, [roomId, playerId]);

  // Auto-rejoin on app load
  useEffect(() => {
    const savedRoomId = localStorage.getItem('elbureau_room_id');
    const savedPlayerId = localStorage.getItem('elbureau_player_id');
    const savedName = localStorage.getItem('elbureau_player_name');

    if (savedRoomId && savedPlayerId && savedName && !isReconnecting) {
      setIsReconnecting(true);
      // Attempt to rejoin
      const player: Player = {
        id: savedPlayerId,
        name: savedName,
        score: 0,
        avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        isHost: false, // Will be corrected by server state
        betsAvailable: [],
        currentBet: null,
        currentAnswer: '',
        isCorrect: null,
        usedHint: false
      };

      joinRoom(savedRoomId, player)
        .then(() => {
          console.log('Reconnected to room:', savedRoomId);
          setRoomId(savedRoomId);
          setPlayerId(savedPlayerId);
        })
        .catch((e) => {
          console.warn('Failed to reconnect, clearing session:', e);
          // Clear invalid session
          localStorage.removeItem('elbureau_room_id');
          localStorage.removeItem('elbureau_player_id');
          setRoomId(null);
          setPlayerId(null);
        })
        .finally(() => setIsReconnecting(false));
    }
  }, []);


  // --- FIREBASE SUBSCRIPTION ---
  useEffect(() => {
    if (roomId) {
      const unsubscribe = subscribeToRoom(roomId, (data) => {
        setGameState(data);
      });
      return () => unsubscribe();
    }
  }, [roomId]);


  // --- HANDLERS ---

  const generatePlayerId = () => `player-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const handleCreateGame = async (config: GameConfig, name: string) => {
    const pid = generatePlayerId();
    const hostPlayer: Player = {
      id: pid,
      name: name,
      score: 0,
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      isHost: true,
      betsAvailable: [], // Will be set on start
      currentBet: null,
      currentAnswer: '',
      isCorrect: null,
      usedHint: false
    };

    try {
      const newRoomId = await createRoom(hostPlayer, config, apiKey);
      setPlayerId(pid);
      setRoomId(newRoomId);
      // Optimistically add player to local state to prevent flicker
      setGameState(prev => ({
        ...prev,
        players: [hostPlayer]
      }));
    } catch (e) {
      console.error(e);
      alert("Error creating room. Please check your connection or try again.");
    }
  };

  const handleJoinGame = async (code: string, name: string) => {
    const pid = generatePlayerId();
    const player: Player = {
      id: pid,
      name: name,
      score: 0,
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      isHost: false,
      betsAvailable: [],
      currentBet: null,
      currentAnswer: '',
      isCorrect: null,
      usedHint: false
    };

    try {
      await joinRoom(code, player);
      setPlayerId(pid);
      setRoomId(code);
    } catch (e) {
      console.error(e);
      alert("Error joining room. Check code or if game has started.");
    }
  };

  const handleStartGame = async (config: GameConfig) => {
    if (!roomId) return;

    // 1. Set Loading State
    await updateRoomState(roomId, { phase: GamePhase.GENERATING, config });

    try {
      // 2. Generate Content
      const questions = await generateQuizQuestions(
        apiKey,
        config.theme,
        config.questionCount,
        config.language,
        config.difficulty,
        config.questionTypes
      );

      // 3. Initialize Player Chips
      const chips = Array.from({ length: config.questionCount }, (_, i) => i + 1);

      const updatedPlayers = gameState.players.map(p => ({
        ...p,
        betsAvailable: [...chips],
        score: 0,
        usedHint: false
      }));

      // 4. Start Game - DIRECTLY TO ANSWERING (Unified Phase)
      await updateRoomState(roomId, {
        questions,
        players: updatedPlayers,
        phase: GamePhase.BETTING,
        currentQuestionIndex: 0
      });

    } catch (error) {
      console.error(error);
      alert("Failed to generate quiz. Check API Key in settings.");
      await updateRoomState(roomId, { phase: GamePhase.LOBBY });
    }
  };

  const handleReset = async () => {
    if (roomId && gameState.config) {
      await resetRoom(roomId, gameState.config);
    }
  };

  const handleLeave = () => {
    // Clear session
    localStorage.removeItem('elbureau_room_id');
    localStorage.removeItem('elbureau_player_id');
    setRoomId(null);
    setPlayerId(null);
    setGameState({ ...gameState, phase: GamePhase.LOBBY, players: [] });
  };

  const updateLanguage = (lang: Language) => {
    // If in lobby and host, update remote config
    if (roomId && isHost && gameState.phase === GamePhase.LOBBY) {
      updateRoomState(roomId, { config: { ...gameState.config, language: lang } });
    } else {
      // Local update for unconnected state
      setGameState(prev => ({ ...prev, config: { ...prev.config, language: lang } }));
    }
  };

  const t = TRANSLATIONS[gameState.config.language];
  const me = gameState.players.find(p => p.id === playerId);
  const isHost = me?.isHost || false;

  // Render Logic
  const showLobby = !roomId || gameState.phase === GamePhase.LOBBY;
  const showGame = roomId && !showLobby && gameState.phase !== GamePhase.GENERATING && gameState.phase !== GamePhase.ENDGAME;
  const showLoading = gameState.phase === GamePhase.GENERATING;
  const showEnd = gameState.phase === GamePhase.ENDGAME;

  return (
    <div
      dir={gameState.config.language === Language.AR ? 'rtl' : 'ltr'}
      className="h-[100dvh] w-full overflow-hidden flex flex-col font-display text-text-main bg-background-light dark:bg-background-dark select-none"
    >
      {/* Floating Controls */}
      <div className="absolute top-2 left-2 z-50 flex gap-2">
        {roomId && !showGame && (
          <button
            onClick={handleLeave}
            className="w-10 h-10 bg-white border-2 border-ink rounded-full flex items-center justify-center shadow-sketch-sm hover:scale-110 transition-transform font-sketch font-bold text-xl text-pop-red"
            title="Leave Room"
          >
            ✕
          </button>
        )}
      </div>



      {/* Main Content */}
      <main className="flex-1 w-full h-full relative overflow-hidden flex flex-col">

        {showLobby && (
          <Lobby
            onStartGame={handleStartGame}
            onCreateGame={handleCreateGame}
            onJoinGame={handleJoinGame}
            config={gameState.config}
            // If host, update remote, else local
            setConfig={(c) => {
              if (roomId && isHost) updateRoomState(roomId, { config: c });
              else setGameState(prev => ({ ...prev, config: c }));
            }}
            hasApiKey={!!apiKey}
            onOpenSettings={() => setIsSettingsOpen(true)}
            playerName={playerName}
            setPlayerName={setPlayerName}
            // Real Data
            connectedPlayers={gameState.players}
            roomCode={roomId || undefined}
            isHost={isHost}
            isWaiting={!!roomId}
          />
        )}

        {showLoading && (
          <div className="flex flex-col h-full w-full items-center justify-center p-6 text-center animate-pulse space-y-6 z-0">
            <div className="w-20 h-20 md:w-24 md:h-24 border-8 border-ink border-t-pop-yellow rounded-full animate-spin flex-none"></div>
            <h2 className="text-2xl md:text-3xl font-sketch text-ink leading-relaxed max-w-md mx-auto">{t.generating}</h2>
            {isHost && <p className="text-sm font-bold text-gray-400">Calling Bureau Intelligence...</p>}
          </div>
        )}

        {showGame && roomId && playerId && (
          <GameRound gameState={gameState} playerId={playerId} roomId={roomId} />
        )}

        {showEnd && (
          <EndGame gameState={gameState} onReset={handleReset} onLeave={handleLeave} isHost={isHost} />
        )}
      </main>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKey={apiKey}
        setApiKey={setApiKey}
        language={gameState.config.language}
        setLanguage={updateLanguage}
        playerName={playerName}
        setPlayerName={setPlayerName}
      />
    </div>
  );
}

export default App;