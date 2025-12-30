import React, { useState, useEffect } from 'react';
import { GameConfig, Player, Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { SketchButton } from '../components/SketchButton';
import { SketchCard } from '../components/SketchCard';
import { Avatar } from '../components/Avatar';

interface LobbyProps {
  onStartGame: (config: GameConfig) => void;
  onJoinGame: (code: string, name: string) => void;
  onCreateGame: (config: GameConfig, name: string) => void;
  config: GameConfig;
  setConfig: (c: GameConfig) => void;
  hasApiKey: boolean;
  onOpenSettings: () => void;
  playerName: string;
  setPlayerName: (name: string) => void;
  connectedPlayers: Player[];
  roomCode?: string;
  isHost: boolean;
  isWaiting: boolean;
  language: Language;
}

type LobbyView = 'home' | 'host_setup' | 'join_setup' | 'waiting_room';

const THEME_CARDS = [
  { id: 'ai', label: 'AI Custom', icon: 'auto_awesome', color: 'from-indigo-500 via-purple-500 to-pink-500', value: 'custom' },
  { id: 'general', label: 'General', image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC6Agwk2UBozDgDdAeL6XvMEHZq7T_dx8zrzeemHX7iNWhrgVvRnMCg0R3AP0An6sktTRnW8SInGSiTHxhdk-Q9AW2gkjXWwGxC0FiZ-Cx1iKOaA6OhbMv6pb9kd_ipZTugs4N4NwuZvibUlpIJkaTFAu74ZCp9xO4EeB2dzzoPfriRcn199Xm2tj1NJ64BkkaFVjVW5J8K0vAeEuWFbuY-czAYuCwg5ydWYPhcfn2lMtONWebSxYdFsCUnpeGyHRB8UpHf4pH8lxtv', value: 'General Knowledge' },
  { id: 'history', label: 'History', image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDpUIY8zhIRb_mVo-kdo2DQ-15zkLvetQOwR5x70bRxy0Jn3E1ThO96Rh3QO6XZOPt4GjUOPqT772j7w4Zh_7UGvWdVHrKAHLGB1o_isgkJXrOFkIStwNas3cnhR0wZcdewN2VIwTZAtWmxWpHU22UtxQcohChJ0xAe-FEgda6IjVjRLMGaVPqh_IPVFPWXxx26j5HciQ0gRI4MoJWq8ZZeMN7un8J_ROoyzqyF0FeA_W61v-tUrX0J8SqlIZupj6agvNEyDa-FMSiR', value: 'History' },
  { id: 'science', label: 'Science', image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBZ08jRVGEIkqz6RrUgpfDBUNAtFtNSUwTwMwfYmd-vlUUTPgep0Z3uNrnG96JNff1dkoXY5SoF-3JKqvfeIMiJclAO3-FIuTDSNakpb7Bj0d3xT9TeVymB1fIt58uPaQHCuolxGkkPXaQosyj3pE0tXS7tWLI9P3aO9zb3uU_YCFpbelvziem4jr21tvhlixA2-cgCkXJx8FWs6y9V-7gAjtwqVfNeI7xGkm8kdJ0H4xvHlcq0L9qfs4TeeVVeCsEbbY5cXlHJv_YW', value: 'Science' },
  { id: 'sports', label: 'Sports', image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDZqdjKOFC7ZleSrdmG8te2yqwJfySguFZ1F1P4giSux5S1yxEg5nJOWgixkSeXLGIB2RU3JKtTbM5ZiCESNx0GBRfoqpLHU505TFycMFRT7Jj6axsqq2ovnzL8oKMZtE8B06aCO7letcB_kagm_JCchK1zqYoDLTB-XJ2pM1AUMsmXNaO9NCiccc-2WgRfE64YITIKTKMPpjtwSdlx8s9Ld7DhbkdJBKtMWNgfatKF568vNUzstSXjsoxVAy26hC2_eEd-246LieJa', value: 'Sports' },
];

export const Lobby: React.FC<LobbyProps> = ({
  onStartGame,
  onJoinGame,
  onCreateGame,
  config,
  setConfig,
  hasApiKey,
  onOpenSettings,
  playerName,
  setPlayerName,
  connectedPlayers,
  roomCode,
  isHost,
  isWaiting,
  language
}) => {
  const [view, setView] = useState<LobbyView>(isWaiting ? 'waiting_room' : 'home');
  const [customTheme, setCustomTheme] = useState('');
  const [joinCodeParts, setJoinCodeParts] = useState(['', '', '', '']);
  const [isBusy, setIsBusy] = useState(false);

  const t = TRANSLATIONS[language];

  useEffect(() => {
    if (isWaiting) {
      setView('waiting_room');
    }
  }, [isWaiting]);

  const handleCreate = async () => {
    let effectiveName = playerName.trim();
    if (!effectiveName) {
      effectiveName = `Host`;
      setPlayerName(effectiveName);
    }

    setIsBusy(true);
    await onCreateGame({
      ...config,
      theme: config.theme === 'custom' ? customTheme : config.theme
    }, effectiveName);
    setIsBusy(false);
  };

  const handleJoin = async () => {
    const code = joinCodeParts.join('');
    let effectiveName = playerName.trim();
    if (!effectiveName) {
      effectiveName = `Player`;
      setPlayerName(effectiveName);
    }

    if (code.length !== 4) return;

    setIsBusy(true);
    try {
      await onJoinGame(code, effectiveName);
    } catch (e) {
      alert("Could not join room. Check code.");
      setIsBusy(false);
    }
  };

  const handleCodeInput = (index: number, value: string) => {
    // Only allow numeric input
    if (value && !/^\d$/.test(value)) return;

    if (value.length > 1) value = value.slice(0, 1);
    const newParts = [...joinCodeParts];
    newParts[index] = value;
    setJoinCodeParts(newParts);

    if (value && index < 3) {
      document.getElementById(`code-${index + 1}`)?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !joinCodeParts[index] && index > 0) {
      document.getElementById(`code-${index - 1}`)?.focus();
    }
  };

  // --- VIEWS ---

  if (view === 'waiting_room') {
    return (
      <div className="flex flex-col h-full w-full max-w-md mx-auto relative pt-8">
        {/* Header */}
        <div className="flex items-center px-6 py-4 justify-between z-20">
          <div className="w-12"></div>
          <h2 className="text-text-main dark:text-white text-2xl font-black uppercase tracking-tight flex-1 text-center bg-white dark:bg-black border-2 border-text-main dark:border-white shadow-sketch-sm rounded-lg py-1 rotate-1">{t.lobby}</h2>
          <div className="flex w-12 items-center justify-end">
            <button onClick={onOpenSettings} className="flex items-center justify-center rounded-full h-12 w-12 bg-white dark:bg-gray-800 border-2 border-text-main dark:border-white shadow-sketch text-text-main dark:text-white hover:bg-gray-50 active:translate-y-[2px] active:shadow-sketch-active transition-all">
              <span className="material-symbols-outlined">settings</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-32 no-scrollbar px-4">
          {/* Room Code Card */}
          <div className="relative w-full rounded-2xl bg-primary border-[3px] border-text-main shadow-sketch-lg p-8 overflow-hidden transform transition-transform hover:scale-[1.01] duration-300 mb-8">
            <div className="absolute top-3 right-3 w-4 h-4 bg-white border-2 border-text-main rounded-full"></div>
            <div className="absolute top-3 left-3 w-4 h-4 bg-white border-2 border-text-main rounded-full"></div>
            <div className="absolute bottom-3 right-3 w-4 h-4 bg-white border-2 border-text-main rounded-full"></div>
            <div className="absolute bottom-3 left-3 w-4 h-4 bg-white border-2 border-text-main rounded-full"></div>
            <div className="relative flex flex-col items-center justify-center text-center z-10">
              <span className="bg-white border-2 border-text-main px-3 py-1 rounded-full text-text-main font-bold uppercase tracking-widest text-xs mb-3 shadow-sketch-sm -rotate-2">{t.roomCode}</span>
              <h1 className="text-text-main text-6xl md:text-7xl font-black tracking-widest leading-none drop-shadow-sm select-all">{roomCode}</h1>
              <button onClick={() => navigator.share?.({ title: 'Join ElBureau', text: `Join code: ${roomCode}` })} className="mt-6 inline-flex items-center gap-2 bg-white hover:bg-gray-50 active:bg-gray-100 border-2 border-text-main shadow-sketch px-4 py-2 rounded-xl transition-all active:translate-y-[2px] active:shadow-sketch-active cursor-pointer">
                <span className="material-symbols-outlined text-lg">share</span>
                <span className="text-sm font-bold text-text-main uppercase">{t.tapToShare}</span>
              </button>
            </div>
          </div>

          {/* Players Status */}
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="inline-flex items-center justify-center gap-x-3 rounded-xl bg-white dark:bg-gray-800 border-2 border-text-main dark:border-white pl-3 pr-5 py-2 shadow-sketch">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-100 border-2 border-text-main text-green-700">
                <span className="material-symbols-outlined text-xl font-bold">check</span>
              </div>
              <p className="text-text-main dark:text-white text-base font-bold">{connectedPlayers.length} {t.playersReady}</p>
            </div>
            <h2 className="text-text-main dark:text-white text-lg font-bold leading-tight text-center bg-paper-white/80 backdrop-blur-sm px-4 py-1 rounded-lg border-2 border-dashed border-text-main/30">
              {t.waitingForPlayers}
            </h2>
          </div>

          {/* Player Grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 pb-6">
            {connectedPlayers.map((p, idx) => (
              <div key={p.id} className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-white dark:bg-gray-800 border-[3px] border-text-main dark:border-gray-500 shadow-sketch hover:-translate-y-1 hover:shadow-sketch-lg transition-all cursor-default group">
                <div className="relative">
                  <Avatar size="lg" className={`bg-${p.avatarColor}-100`} />
                  {p.isHost && <div className="absolute top-0 right-0 -mr-2 -mt-2 text-2xl">👑</div>}
                  <div className="absolute bottom-0 right-0 bg-green-500 w-6 h-6 rounded-full border-[3px] border-text-main shadow-sm"></div>
                </div>
                <h3 className={`text-text-main dark:text-white text-lg font-black uppercase tracking-tight ${idx % 2 === 0 ? '-rotate-1' : 'rotate-1'}`}>{p.name}</h3>
              </div>
            ))}

            {/* Empty Slots */}
            {Array.from({ length: Math.max(0, 4 - connectedPlayers.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border-[3px] border-dashed border-text-main/20 dark:border-white/20 bg-transparent min-h-[160px]">
                <div className="w-16 h-16 rounded-full bg-transparent border-2 border-dashed border-text-main/20 flex items-center justify-center text-text-main/40 dark:text-white/40">
                  <span className="material-symbols-outlined text-3xl">person_add</span>
                </div>
                <h3 className="text-text-main/40 dark:text-white/40 text-sm font-bold uppercase tracking-wide">{t.waiting}</h3>
              </div>
            ))}
          </div>
        </div>

        {/* Start Game Action */}
        {isHost && (
          <div className="fixed bottom-0 left-0 right-0 p-6 pt-12 z-30 bg-gradient-to-t from-background-light via-background-light to-transparent dark:from-background-dark dark:via-background-dark pointer-events-none">
            <div className="max-w-md mx-auto w-full flex flex-col items-center gap-4 pointer-events-auto">
              {!hasApiKey && (
                <button onClick={onOpenSettings} className="bg-pop-red/10 border-2 border-pop-red border-dashed rounded-lg p-2 text-xs font-bold text-pop-red w-full text-center hover:bg-pop-red/20">
                  ⚠ {t.apiKeyMissing}
                </button>
              )}
              <button
                onClick={() => onStartGame(config)}
                disabled={!hasApiKey}
                className="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-1 active:shadow-sketch-active transition-all text-text-main font-black uppercase tracking-wider text-xl h-16 rounded-full border-[3px] border-text-main shadow-sketch-lg flex items-center justify-center gap-3 group relative overflow-hidden"
              >
                <span className="material-symbols-outlined text-3xl">play_circle</span>
                {t.start}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'host_setup') {
    return (
      <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden pb-32">
        {/* Header */}
        <div className="sticky top-0 z-50 flex items-center bg-background-light dark:bg-background-dark p-4 pt-8 pb-2 justify-between border-b-2 border-paper-border dark:border-white/10">
          <button onClick={() => setView('home')} className="text-text-main dark:text-white flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-transparent active:bg-black/5 hover:bg-black/5 transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-3xl font-bold">arrow_back</span>
          </button>
          <h2 className="text-text-main dark:text-white text-2xl font-display font-bold leading-tight tracking-tight flex-1 text-center pr-12">{t.gameSetup}</h2>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar pt-6">

          {/* Player Name */}
          <div className="px-5 mb-6">
            <label className="text-text-main dark:text-white text-sm font-display font-bold ml-1 mb-2 block uppercase tracking-wide">{t.yourName}</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full bg-white dark:bg-white/5 border-2 border-paper-border rounded-xl px-4 py-3 font-display font-bold text-lg outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all"
              placeholder={t.hostNamePlaceholder}
            />
          </div>

          {/* Themes */}
          <h3 className="text-text-main dark:text-white text-xl font-display font-bold leading-tight tracking-wide px-5 pb-4 transform -rotate-1">{t.chooseVibe}</h3>
          <div className="flex w-full overflow-x-auto px-5 py-4 no-scrollbar scroll-pl-5 mb-4">
            <div className="flex min-h-min flex-row items-start justify-start gap-4 pr-5">
              {THEME_CARDS.map((card) => {
                const isSelected = (card.value === 'custom' && config.theme === 'custom') || (config.theme === card.value);
                return (
                  <div key={card.id} onClick={() => setConfig({ ...config, theme: card.value })} className={`group flex flex-col justify-center gap-2 w-32 cursor-pointer transition-transform hover:-translate-y-1 ${isSelected ? 'transform -translate-y-1' : ''}`}>
                    <div className={`relative w-full aspect-[3/4] bg-white dark:bg-white/5 rounded-xl overflow-hidden border-2 border-paper-border ${isSelected ? 'shadow-sketch-lg ring-2 ring-primary ring-offset-2 ring-offset-background-light' : 'shadow-sketch group-hover:shadow-sketch-hover'} transition-all`}>
                      {isSelected && <div className="absolute top-2 right-2 bg-primary text-black border-2 border-paper-border text-[10px] font-display font-bold px-2 py-1 rounded-md z-10 shadow-sketch-sm -rotate-6">{t.picked}</div>}

                      {card.image ? (
                        <div className={`w-full h-full bg-center bg-cover transition-all duration-300 ${isSelected ? '' : 'grayscale group-hover:grayscale-0'}`} style={{ backgroundImage: `url('${card.image}')` }}></div>
                      ) : (
                        <div className="w-full h-full bg-black relative">
                          <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-90`}></div>
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
                            <span className="material-symbols-outlined text-white text-4xl mb-2 drop-shadow-md">{card.icon}</span>
                            <span className="text-white text-sm font-display font-bold leading-tight drop-shadow-md">{card.label}</span>
                          </div>
                        </div>
                      )}

                      <div className={`absolute bottom-0 w-full border-t-2 border-paper-border p-2 text-center ${isSelected ? 'bg-primary' : 'bg-white'}`}>
                        <p className="text-text-main text-sm font-display font-bold truncate">{card.label}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {config.theme === 'custom' && (
            <div className="px-5 mb-6 animate-slide-up">
              <input
                type="text"
                value={customTheme}
                onChange={(e) => setCustomTheme(e.target.value)}
                className="w-full bg-white dark:bg-white/5 border-2 border-paper-border border-dashed rounded-xl px-4 py-3 font-display font-bold text-lg outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all"
                placeholder={t.customThemePlaceholder}
              />
            </div>
          )}

          {/* Questions Count */}
          <div className="flex flex-col">
            <h3 className="text-text-main dark:text-white text-xl font-display font-bold leading-tight tracking-wide px-5 pb-4 transform rotate-1">{t.nittyGritty}</h3>
            <div className="px-5 mb-6">
              <div className="bg-white dark:bg-white/5 rounded-xl p-5 border-2 border-paper-border shadow-sketch">
                <div className="flex w-full items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-text-main text-2xl">quiz</span>
                    <p className="text-text-main dark:text-white text-lg font-display font-bold">{t.howManyQs}</p>
                  </div>
                  <span className="bg-primary text-text-main border-2 border-paper-border px-3 py-1 rounded-lg text-sm font-bold shadow-sketch-sm rotate-2">{config.questionCount}</span>
                </div>
                <div className="flex items-center gap-4 px-2">
                  <span className="text-sm font-bold font-display text-text-main">3</span>
                  <input
                    type="range"
                    min="3"
                    max="30"
                    value={config.questionCount}
                    onChange={(e) => setConfig({ ...config, questionCount: parseInt(e.target.value) })}
                    className="flex-1 h-3 bg-gray-100 rounded-full appearance-none border-2 border-paper-border accent-primary cursor-pointer"
                    style={{
                      backgroundImage: 'linear-gradient(#f4d125, #f4d125)',
                      backgroundSize: `${((config.questionCount - 3) * 100) / 27}% 100%`,
                      backgroundRepeat: 'no-repeat'
                    }}
                  />
                  <span className="text-sm font-bold font-display text-text-main">30</span>
                </div>
              </div>

              {/* Difficulty */}
              <div className="mt-4">
                <p className="text-text-main dark:text-white text-sm font-display font-bold ml-1 mb-2">{t.difficultyLevel}</p>
                <div className="flex p-2 bg-white dark:bg-white/5 border-2 border-paper-border rounded-xl shadow-sketch gap-2">
                  {(['easy', 'medium', 'hard', 'mixed'] as const).map(diff => (
                    <button
                      key={diff}
                      onClick={() => setConfig({ ...config, difficulty: diff })}
                      className={`flex-1 py-2 rounded-lg font-display font-bold text-sm border-2 transition-all capitalize
                              ${config.difficulty === diff
                          ? 'bg-primary text-black border-paper-border shadow-sketch-sm transform -translate-y-1'
                          : 'text-text-main border-transparent hover:bg-gray-100 hover:border-paper-border'}
                              `}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question Types */}
              <div className="mt-4">
                <p className="text-text-main dark:text-white text-sm font-display font-bold ml-1 mb-2">{t.questionStyle}</p>
                <div className="flex p-2 bg-white dark:bg-white/5 border-2 border-paper-border rounded-xl shadow-sketch gap-2">
                  {[
                    { val: 'mixed', label: t.styleMix },
                    { val: 'mc', label: t.styleChoices },
                    { val: 'open', label: t.styleTyped }
                  ].map(type => (
                    <button
                      key={type.val}
                      onClick={() => setConfig({ ...config, questionTypes: type.val as any })}
                      className={`flex-1 py-2 rounded-lg font-display font-bold text-sm border-2 transition-all
                              ${config.questionTypes === type.val
                          ? 'bg-primary text-black border-paper-border shadow-sketch-sm transform -translate-y-1'
                          : 'text-text-main border-transparent hover:bg-gray-100 hover:border-paper-border'}
                              `}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* House Rules */}
          <div className="flex flex-col pb-24">
            <h3 className="text-text-main dark:text-white text-xl font-display font-bold leading-tight tracking-wide px-5 pb-4 transform -rotate-1">{t.houseRules}</h3>
            <div className="px-5 flex flex-col gap-4">
              {/* Timer */}
              <div className="flex flex-col gap-2 p-4 bg-white dark:bg-white/5 rounded-xl border-2 border-paper-border shadow-sketch">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-xl">timer</span>
                  <p className="text-text-main dark:text-white text-lg font-display font-bold">{t.timeLimit}</p>
                </div>
                <div className="flex gap-2">
                  {[15, 30, 45, 60].map(sec => (
                    <button
                      key={sec}
                      onClick={() => setConfig({ ...config, timerSeconds: sec })}
                      className={`flex-1 py-2 rounded-lg font-display font-bold text-sm border-2 transition-all
                                  ${config.timerSeconds === sec
                          ? 'bg-primary text-black border-paper-border shadow-sketch-sm transform -translate-y-1'
                          : 'text-text-main border-transparent hover:bg-gray-100 hover:border-paper-border'}
                                  `}
                    >
                      {`${sec}s`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hints */}
              <div onClick={() => setConfig({ ...config, allowHints: !config.allowHints })} className="flex items-center justify-between p-4 bg-white dark:bg-white/5 rounded-xl border-2 border-paper-border shadow-sketch hover:shadow-sketch-hover transition-all cursor-pointer group">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-xl group-hover:text-primary transition-colors">lightbulb</span>
                    <p className="text-text-main dark:text-white text-lg font-display font-bold">{t.allowHints}</p>
                  </div>
                  <p className="text-xs font-bold text-text-main/60 dark:text-white/60 pl-7 font-display">{t.hintDynamicCost}</p>
                </div>
                <div className={`relative h-8 w-14 rounded-full border-2 border-paper-border cursor-pointer transition-colors shadow-sketch-sm ${config.allowHints ? 'bg-primary' : 'bg-gray-200'}`}>
                  <div className={`absolute top-1 size-5 rounded-full bg-white border-2 border-paper-border shadow-sm transition-all ${config.allowHints ? 'right-1' : 'left-1'}`}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Action */}
        <div className="fixed bottom-0 left-0 right-0 p-5 pt-10 z-20 pointer-events-none bg-gradient-to-t from-background-light from-60% to-transparent dark:from-background-dark">
          <button
            onClick={handleCreate}
            disabled={isBusy}
            className="pointer-events-auto w-full bg-primary text-black text-xl font-display font-bold py-4 rounded-xl border-2 border-paper-border shadow-sketch-lg hover:shadow-sketch hover:translate-y-1 active:shadow-sketch-active active:translate-y-[4px] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <span>{isBusy ? t.creating : t.launchGame}</span>
            <span className="material-symbols-outlined text-2xl animate-pulse">rocket_launch</span>
          </button>
        </div>
      </div>
    );
  }

  if (view === 'join_setup') {
    return (
      <div className="relative flex min-h-[100dvh] w-full flex-col max-w-md mx-auto">
        {/* Header */}
        <header className="flex items-center p-6 pt-12 justify-between z-10">
          <button onClick={() => setView('home')} className="group flex h-12 w-12 items-center justify-center rounded-xl bg-white dark:bg-white/10 border-2 border-text-main dark:border-white shadow-sketch hover:shadow-sketch-hover transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px]">
            <span className="material-symbols-outlined text-2xl font-bold dark:text-white">arrow_back</span>
          </button>
        </header>

        <main className="flex-1 flex flex-col items-center px-6 pt-4 pb-8 z-10 w-full animate-slide-up">
          {/* Logo/Icon */}
          <div className="relative mb-10 mt-2">
            <div className="absolute inset-0 bg-primary rounded-sketchy border-2 border-text-main rotate-6 translate-x-2 translate-y-1"></div>
            <div className="relative h-36 w-36 bg-white dark:bg-white/10 rounded-sketchy border-2 border-text-main dark:border-white shadow-sketch flex items-center justify-center overflow-hidden -rotate-3 transition-transform duration-300 hover:rotate-0">
              <img alt="Game Icon" className="h-full w-full object-contain p-4" src="/logo.svg" />
            </div>
          </div>

          <div className="text-center mb-10 space-y-2">
            <h1 className="text-4xl font-display font-black tracking-wide uppercase text-text-main dark:text-white drop-shadow-sm rotate-1">{t.joinFun}</h1>
            <p className="text-lg text-text-main/60 dark:text-white/60 font-medium font-display">{t.enterMagicCode}</p>
          </div>

          {/* Inputs */}
          <div className="w-full max-w-[340px] mb-8">
            <fieldset className="flex justify-between gap-3">
              {joinCodeParts.map((part, i) => (
                <div key={i} className="relative group">
                  <input
                    id={`code-${i}`}
                    type="text"
                    inputMode="numeric"
                    value={part}
                    onChange={(e) => handleCodeInput(i, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(i, e)}
                    className="flex h-16 w-[4.5rem] text-center bg-white dark:bg-white/5 rounded-xl text-3xl font-display font-bold text-text-main dark:text-white placeholder:text-gray-300 border-2 border-text-main dark:border-white shadow-sketch outline-none transition-all focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none focus:ring-0 focus:border-primary"
                    placeholder="?"
                    autoFocus={i === 0}
                  />
                </div>
              ))}
            </fieldset>
          </div>

          <div className="w-full max-w-[340px] mb-10">
            <label className="text-text-main dark:text-white text-sm font-display font-bold ml-1 mb-2 block uppercase tracking-wide">{t.yourName}</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full bg-white dark:bg-white/5 border-2 border-text-main dark:border-white rounded-xl px-4 py-3 font-display font-bold text-lg outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all text-center placeholder:text-gray-300"
              placeholder={t.playerNamePlaceholder}
            />
          </div>

          <div className="w-full mt-auto mb-4">
            <button
              onClick={handleJoin}
              disabled={isBusy || joinCodeParts.join('').length !== 4}
              className="group relative flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-16 bg-primary text-black text-xl font-display font-black tracking-wider uppercase border-2 border-text-main shadow-sketch transition-all hover:shadow-sketch-hover hover:-translate-y-0.5 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="relative z-10 flex items-center gap-2">
                {isBusy ? t.joining : t.enterRoom}
                <span className="material-symbols-outlined text-2xl font-bold group-hover:rotate-12 transition-transform">arrow_forward</span>
              </span>
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 50%)', backgroundSize: '10px 10px' }}></div>
            </button>
          </div>
        </main>
      </div>
    );
  }

  // DEFAULT: HOME VIEW
  return (
    <div className="relative flex min-h-full flex-col max-w-md mx-auto h-full">
      <header className="flex items-center justify-between p-6 pt-12 z-20">
        <div className="flex items-center gap-2 bg-paper-white dark:bg-white/10 px-3 py-1.5 rounded-full shadow-sketch border-2 border-text-main dark:border-white/50 cursor-pointer hover:-rotate-2 transition-transform">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center overflow-hidden border-2 border-text-main dark:border-white/20">
            <span className="material-symbols-outlined text-text-main text-sm">sentiment_satisfied</span>
          </div>
          <span className="text-sm font-bold text-text-main dark:text-white pr-2 font-marker tracking-wide">{playerName || 'Guest'}</span>
        </div>
        <button onClick={onOpenSettings} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-text-main dark:text-white border-2 border-text-main dark:border-white shadow-sketch active:shadow-none active:translate-x-[3px] active:translate-y-[3px]">
          <span className="material-symbols-outlined text-2xl">settings</span>
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 -mt-10 relative z-10 w-full">
        {/* Floating Animations */}
        <svg className="absolute top-20 left-6 w-16 h-16 opacity-30 animate-float text-blue-400" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" viewBox="0 0 100 100"><path d="M20,20 Q40,5 60,20 T90,30 T60,60 T30,50 T20,20 Z"></path></svg>
        <svg className="absolute bottom-40 right-4 w-24 h-24 opacity-20 animate-float-delayed text-primary" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" strokeDasharray="10 5"></circle><path d="M30,30 L70,70 M30,70 L70,30"></path></svg>

        <div className="w-full max-w-[280px] mx-auto mb-8 animate-wiggle">
          <div className="absolute -top-6 -right-6 transform rotate-12 z-20">
            <div className="bg-primary px-4 py-1 rounded-sketchy-sm shadow-sketch transform rotate-6 border-2 border-text-main">
              <span className="text-sm font-black text-text-main uppercase tracking-wider font-marker">{t.beta}</span>
            </div>
          </div>
          <img src="/logo.svg" alt="ElBureau Logo" className="w-full h-auto drop-shadow-sm transform -rotate-2" />
        </div>

        {/* Tagline */}
        <div className="mb-14 relative group animate-pop-in" style={{ animationDelay: '0.2s' }}>
          <div className="bg-paper-white px-8 py-4 rounded-sketchy border-2 border-text-main shadow-sketch transform -rotate-1 hover:rotate-1 transition-transform duration-300 relative z-20">
            <p className="text-text-main font-bold text-lg text-center font-marker">"{t.readyToBuzz}"</p>
          </div>
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col gap-5 max-w-xs relative z-30 animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <SketchButton onClick={() => setView('join_setup')} variant="primary" className="h-16 text-2xl" sketchy>
            <span className="material-symbols-outlined mr-3 text-3xl font-black">play_arrow</span>
            {t.joinRoomBtn}
          </SketchButton>

          <SketchButton onClick={() => setView('host_setup')} variant="secondary" className="h-16 text-xl" sketchy>
            <span className="material-symbols-outlined mr-3 text-3xl group-hover:rotate-90 transition-transform">add_circle</span>
            {t.createRoomBtn}
          </SketchButton>
        </div>
      </main>

      <footer className="p-6 pb-10 flex justify-center items-center gap-6 text-sm font-bold text-text-main/60 dark:text-white/60 font-marker z-20">
        <a href="#" className="hover:text-primary hover:underline decoration-wavy decoration-2 transition-colors flex items-center gap-1">
          <span className="material-symbols-outlined text-lg">help</span>
          {t.howToPlay}
        </a>
        <span className="w-1.5 h-1.5 bg-text-main rounded-full"></span>
        <a href="#" className="hover:text-primary hover:underline decoration-wavy decoration-2 transition-colors">{t.privacy}</a>
      </footer>
    </div>
  );
};