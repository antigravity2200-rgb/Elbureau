import Peer from 'peerjs';
import { GameState, GamePhase, Player, GameConfig } from '../types';

// NOTE: This file is named 'firebase.ts' to maintain compatibility with existing imports,
// but it now implements a P2P architecture using PeerJS instead of Firebase.

// --- P2P STATE ---
let peer: any = null;
let hostConnection: any = null; // Client -> Host connection
let clientConnections: Map<string, any> = new Map(); // Host -> Client connections
let currentGameState: GameState | null = null;
let onStateUpdate: ((state: GameState) => void) | null = null;
let isHost = false;

const ID_PREFIX = 'elbureau-game-v1-';

// --- INTERNAL HELPERS ---

const cleanup = () => {
  if (peer) {
    peer.destroy();
    peer = null;
  }
  hostConnection = null;
  clientConnections.clear();
  currentGameState = null;
  onStateUpdate = null;
  isHost = false;
};

const broadcast = (data: any) => {
  clientConnections.forEach(conn => {
    if (conn.open) {
      try {
        conn.send(data);
      } catch (e) {
        console.error("Broadcast error", e);
      }
    }
  });
};

const handleData = (data: any, senderId: string) => {
  if (!currentGameState) return;

  // HOST LOGIC: Process incoming actions from players
  if (isHost) {
    if (data.type === 'JOIN') {
      const newPlayer = data.player;
      
      // Check if player already exists (reconnect scenario)
      const existingIdx = currentGameState.players.findIndex(p => p.id === newPlayer.id);
      let newPlayers = [...currentGameState.players];
      
      if (existingIdx >= 0) {
        // Update existing player socket/info
        newPlayers[existingIdx] = { ...newPlayers[existingIdx], ...newPlayer };
      } else {
        newPlayers.push(newPlayer);
      }
      
      const newState = { ...currentGameState, players: newPlayers };
      updateRoomState(null as any, newState);
    } 
    else if (data.type === 'PLAYER_UPDATE') {
      const { playerId, updates } = data;
      const newPlayers = currentGameState.players.map(p => 
        p.id === playerId ? { ...p, ...updates } : p
      );
      updateRoomState(null as any, { players: newPlayers });
    }
  } 
  // CLIENT LOGIC: Process incoming state from Host
  else {
    if (data.type === 'STATE_UPDATE') {
      currentGameState = data.state;
      if (onStateUpdate) onStateUpdate(currentGameState!);
    }
  }
};

// --- PUBLIC API ---

export const createRoom = async (
  hostPlayer: Player, 
  config: GameConfig, 
  apiKey: string
): Promise<string> => {
  cleanup(); // Reset previous session

  // Generate a short 4-character room code
  const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
  const peerId = `${ID_PREFIX}${roomCode}`;

  isHost = true;
  currentGameState = {
    phase: GamePhase.LOBBY,
    apiKey,
    config,
    players: [hostPlayer],
    questions: [],
    currentQuestionIndex: 0
  };

  peer = new Peer(peerId);

  return new Promise((resolve, reject) => {
    peer.on('open', (id: string) => {
      console.log('Host initialized with Peer ID:', id);
      resolve(roomCode);
    });

    peer.on('error', (err: any) => {
      console.error('Peer error:', err);
      // If code is taken, we fail. In a prod app, retry with new code.
      if (err.type === 'unavailable-id') {
        reject(new Error("Room code collision. Please try again."));
      } else {
        reject(err);
      }
    });

    peer.on('connection', (conn: any) => {
      console.log('Client connecting:', conn.peer);
      
      conn.on('open', () => {
        clientConnections.set(conn.peer, conn);
        // Send immediate state sync
        conn.send({ type: 'STATE_UPDATE', state: currentGameState });
      });

      conn.on('data', (data: any) => handleData(data, conn.peer));
      
      conn.on('close', () => {
        clientConnections.delete(conn.peer);
      });
      
      conn.on('error', (e: any) => console.error("Conn error", e));
    });
  });
};

export const joinRoom = async (
  roomId: string, 
  player: Player
): Promise<GameState> => {
  cleanup(); // Reset previous session

  isHost = false;
  // Create a random client peer
  peer = new Peer(); 

  return new Promise((resolve, reject) => {
    peer.on('open', () => {
      const hostPeerId = `${ID_PREFIX}${roomId.toUpperCase()}`;
      console.log("Connecting to host:", hostPeerId);
      
      hostConnection = peer.connect(hostPeerId, { reliable: true });

      hostConnection.on('open', () => {
        console.log('Connected to host!');
        // Send Join Request
        hostConnection.send({ type: 'JOIN', player });
      });

      hostConnection.on('data', (data: any) => {
        if (data.type === 'STATE_UPDATE') {
            currentGameState = data.state;
            if (onStateUpdate) onStateUpdate(currentGameState!);
            resolve(currentGameState!); // Resolve promise on first state receipt
        }
      });

      hostConnection.on('close', () => {
        console.log("Disconnected from host");
      });

      hostConnection.on('error', (err: any) => {
        console.error("Connection error:", err);
        reject(err);
      });
    });
    
    peer.on('error', (err: any) => {
      console.error("Client Peer error:", err);
      reject(err);
    });

    // Timeout fallback if host doesn't exist or firewall issues
    setTimeout(() => {
        if (!hostConnection?.open && !currentGameState) {
            reject(new Error("Connection timed out. Room may not exist."));
        }
    }, 8000);
  });
};

export const subscribeToRoom = (
  roomId: string, 
  onUpdate: (data: GameState) => void
) => {
  onStateUpdate = onUpdate;
  
  // If we already have state (from join), trigger immediately
  if (currentGameState) {
    onUpdate(currentGameState);
  }
  
  // Return cleanup function
  return () => {
    onStateUpdate = null;
  };
};

export const updateRoomState = async (
  roomId: string, 
  updates: Partial<GameState>
) => {
  if (isHost && currentGameState) {
    currentGameState = { ...currentGameState, ...updates };
    
    // 1. Notify local UI
    if (onStateUpdate) onStateUpdate(currentGameState);
    
    // 2. Broadcast to all clients
    broadcast({ type: 'STATE_UPDATE', state: currentGameState });
  } else {
    // Clients should not call this directly, but if they do, we ignore or warn
    // console.warn("Clients cannot update room state directly.");
  }
};

export const updatePlayerState = async (
  roomId: string, 
  playerId: string, 
  updates: Partial<Player>
) => {
  if (isHost) {
    // Host updating a player (could be themselves or another)
    if (currentGameState) {
        const newPlayers = currentGameState.players.map(p => 
            p.id === playerId ? { ...p, ...updates } : p
        );
        // Reuse updateRoomState to handle broadcast
        updateRoomState(roomId, { players: newPlayers });
    }
  } else {
    // Client requesting update for themselves
    if (hostConnection && hostConnection.open) {
        hostConnection.send({ type: 'PLAYER_UPDATE', playerId, updates });
    }
  }
};

export const resetRoom = async (roomId: string, config: GameConfig) => {
    if (!isHost || !currentGameState) return;
    
    const resetPlayers = currentGameState.players.map(p => ({
      ...p,
      score: 0,
      betsAvailable: Array.from({ length: config.questionCount }, (_, i) => i + 1),
      currentBet: null,
      currentAnswer: '',
      isCorrect: null,
      wagerAmount: undefined,
      wagerDifficulty: undefined,
      usedHint: false
    }));

    const newState = {
         ...currentGameState,
         phase: GamePhase.LOBBY,
         questions: [],
         finalQuestion: undefined,
         currentQuestionIndex: 0,
         players: resetPlayers,
         config: config
    };
    
    updateRoomState(roomId, newState);
};