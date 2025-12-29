
/// <reference types="vite/client" />
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { GameState, GamePhase, Player, GameConfig } from '../types';

let supabase: SupabaseClient | null = null;
let currentChannel: RealtimeChannel | null = null;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

if (supabaseUrl && supabaseKey) {
    try {
        supabase = createClient(supabaseUrl, supabaseKey, {
            realtime: {
                params: {
                    eventsPerSecond: 10,
                },
            },
        });
    } catch (e) {
        console.error("Failed to init Supabase:", e);
    }
}

// --- INITIALIZATION ---

export const initSupabase = (url?: string, key?: string) => {
    // Manual init still possible but generally unused if env vars are present
    if (!url || !key) return;
    if (!supabase) {
        try {
            supabase = createClient(url, key, {
                realtime: {
                    params: {
                        eventsPerSecond: 10,
                    },
                },
            });
        } catch (e) {
            console.error("Failed to init Supabase:", e);
        }
    }
};

// --- PUBLIC API ---

export const createRoom = async (
    hostPlayer: Player,
    config: GameConfig,
    apiKey: string
): Promise<string> => {
    if (!supabase) throw new Error("Supabase not initialized");

    // Generate a 4-digit numeric room code
    const roomCode = Math.floor(1000 + Math.random() * 9000).toString();

    const initialState: GameState = {
        phase: GamePhase.LOBBY,
        apiKey,
        config,
        players: [hostPlayer],
        questions: [],
        currentQuestionIndex: 0
    };

    const { error } = await supabase
        .from('rooms')
        .insert({
            id: roomCode,
            host_id: hostPlayer.id,
            game_state: initialState
        });

    if (error) {
        console.error("Supabase Create Error:", error);
        throw new Error("Failed to create room: " + error.message);
    }

    return roomCode;
};

export const joinRoom = async (
    roomId: string,
    player: Player
): Promise<GameState> => {
    if (!supabase) throw new Error("Supabase not initialized");

    // 1. Fetch current state to check existence and add player
    const { data: room, error } = await supabase
        .from('rooms')
        .select('game_state')
        .eq('id', roomId)
        .single();

    if (error || !room) {
        throw new Error("Room not found");
    }

    const currentState = room.game_state as GameState;

    // Check if player already exists (reconnect)
    const existingIdx = currentState.players.findIndex(p => p.id === player.id);
    let newPlayers = [...currentState.players];

    if (existingIdx >= 0) {
        newPlayers[existingIdx] = { ...newPlayers[existingIdx], ...player }; // Update info
    } else {
        newPlayers.push(player);
    }

    const newState = { ...currentState, players: newPlayers };

    // 2. Update the room with new player list
    const { error: updateError } = await supabase
        .from('rooms')
        .update({ game_state: newState })
        .eq('id', roomId);

    if (updateError) {
        throw new Error("Failed to join room: " + updateError.message);
    }

    return newState;
};

export const subscribeToRoom = (
    roomId: string,
    onUpdate: (data: GameState) => void
) => {
    if (!supabase) return () => { };

    // Unsubscribe previous if exists
    if (currentChannel) {
        supabase.removeChannel(currentChannel);
    }

    // Subscribe to changes on the 'rooms' table for this specific room ID
    currentChannel = supabase
        .channel(`room_${roomId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'rooms',
                filter: `id=eq.${roomId}`
            },
            (payload) => {
                const newState = payload.new.game_state as GameState;
                onUpdate(newState);
            }
        )
        .on(
            'broadcast',
            { event: 'client_action' },
            () => {
                // Placeholder for direct client-to-host events if we need them, 
                // but for now we are using shared state in DB.
            }
        )
        .subscribe((status) => {
            console.log(`Supabase subscription status for room ${roomId}:`, status);
        });

    return () => {
        if (currentChannel) {
            supabase?.removeChannel(currentChannel);
            currentChannel = null;
        }
    };
};

export const updateRoomState = async (
    roomId: string,
    updates: Partial<GameState>
) => {
    if (!supabase) return;

    // We need to fetch latest first to merge safely? 
    // No, for simplicity in this game loop, we often have the 'latest' local state 
    // if we are the host. However, to be safe against race conditions, 
    // ideally we use Postgres functions or careful merging.
    // For this prototype: Fetch -> Merge -> Update.

    // Optimisation: We assume the caller (usually Host) has the authoritative state.
    // But wait, `updates` is Partial. We can't just send Partial to JSONB column easily
    // without replacing the whole thing or using jsonb_set.
    // To keep it simple: We will fetch current, merge, then push.
    // OR: We rely on the fact that `App.tsx` keeps `gameState`. 
    // WARNING: If we don't pass the full state, we might overwrite with partial data 
    // if we just send `updates` to the DB column?
    // The DB column `game_state` expects the FULL JSON.
    // So we really need to pass the FULL merged state to `updateRoomState`, 
    // OR we fetch-merge-update here.

    // Let's change the strategy: The App (Host) usually passes the *changes*.
    // We should probably fetch the latest from DB to ensure we don't regress?
    // Actually, for a fast-paced game, the Host is the source of truth.
    // We should trust the Host's view of the state. 
    // But the `updateRoomState` signature in `firebase.ts` accepted `Partial<GameState>`.
    // The `firebase.ts` standard implementation merged it with `currentGameState` (local var).
    // We don't have a persistent local `currentGameState` here across renders 
    // (unless we add one, but `App.tsx` has it).

    // Let's add a local cache of state to this service to mimic the peer implementation behavior
    // or fetch-update.

    // BETTER APPROACH:
    // Fetch latest, merge, update.
    const { data: room, error: fetchError } = await supabase
        .from('rooms')
        .select('game_state')
        .eq('id', roomId)
        .single();

    if (fetchError || !room) {
        console.error("Error fetching room for update:", fetchError);
        return;
    }

    const currentState = room.game_state as GameState;
    const newState = { ...currentState, ...updates };

    const { error: updateError } = await supabase
        .from('rooms')
        .update({ game_state: newState })
        .eq('id', roomId);

    if (updateError) {
        console.error("Error updating room:", updateError);
    }
};

export const updatePlayerState = async (
    roomId: string,
    playerId: string,
    updates: Partial<Player>
) => {
    if (!supabase) return;

    const { data: room, error: fetchError } = await supabase
        .from('rooms')
        .select('game_state')
        .eq('id', roomId)
        .single();

    if (fetchError || !room) return;

    const currentState = room.game_state as GameState;

    // Update the specific player
    const newPlayers = currentState.players.map(p =>
        p.id === playerId ? { ...p, ...updates } : p
    );

    // Check for auto-transitions (Host logic moved to DB update?)
    // In the original, Host checked for "All Done".
    // Here, if a Client updates themselves, checking "All Done" is harder 
    // unless we put that logic here or listeners handle it.
    // original `firebase.ts` had logic: "Check if all players have submitted...".
    // Since we are moving to a DB model, every client writes to the DB.
    // The HOST's subscription will pick up the change. 
    // The HOST's 'useEffect' or subscription callback in App.tsx should handle game logic?
    // WAIT: In `firebase.ts`, `handleData` did the logic. 
    // Here, `App.tsx` doesn't have that logic. `App.tsx` just displays state.
    // `firebase.ts` contained a mini-server logic for the Host.

    // REFACTOR NEEDED:
    // We need to preserve the Host Logic.
    // Option 1: The Host player's client watches state changes and applies game rules.
    // Option 2: Embed logic here.

    // Let's go with Option 1/2 Hybrid:
    // When updating player state, we just save to DB.
    // The Host (App.tsx) needs to react to changes. 
    // note: `firebase.ts` `handleData` section `if (isHost) { ... }`.
    // We need to implement that "Observer" logic.

    // BUT: `App.tsx` doesn't currently contain the rule "If all answered -> go to Preview".
    // That was hidden in `firebase.ts`.
    // We should move that logic into this function effectively, 
    // OR we just save the state, and let the Host's `subscribeToRoom` callback handle it?
    // The `subscribeToRoom` just calls `setGameState`.

    // Critical Design Decision:
    // We will perform the check HERE during the update.
    // We need to check if we are applying a player update that triggers a phase change.

    let newState = { ...currentState, players: newPlayers };

    // LOGIC FROM OLD FIREBASE.TS:
    // "Check if all players have submitted BOTH bet and answer"
    // We can just run this check every time a player updates.
    // If true, we *also* update the phase.
    const allDone = newPlayers.every(p => p.currentBet !== null && !!p.currentAnswer);

    if (allDone && currentState.phase === GamePhase.BETTING) {
        // NOTE: We only want to trigger this if we are in BETTING/ANSWERING phase.
        // In the unified phase (GamePhase.BETTING in App.tsx logic line 213), we wait for all.
        // Actually App.tsx calls it BETTING (line 213).
        newState.phase = GamePhase.PREVIEW;
    }

    await supabase
        .from('rooms')
        .update({ game_state: newState })
        .eq('id', roomId);
};

export const resetRoom = async (roomId: string, config: GameConfig) => {
    if (!supabase) return;

    await updateRoomState(roomId, {
        phase: GamePhase.LOBBY,
        questions: [],
        currentQuestionIndex: 0,
        // We also need to reset players logic manually here since we can't reference the previous internal state easily?
        // Actually updateRoomState fetches state.
        // But we want to reset players strictly.
    });

    // Better to do a full read-modify-write here to ensure players are reset correctly
    const { data: room } = await supabase.from('rooms').select('game_state').eq('id', roomId).single();
    if (!room) return;

    const currentState = room.game_state as GameState;
    const resetPlayers = currentState.players.map(p => ({
        ...p,
        score: 0,
        betsAvailable: Array.from({ length: config.questionCount }, (_, i) => i + 1),
        currentBet: null,
        currentAnswer: '',
        isCorrect: null,
        wagerAmount: undefined,
        wagerDifficulty: undefined as any,
        usedHint: false
    }));

    const newState = {
        ...currentState,
        phase: GamePhase.LOBBY,
        questions: [],
        finalQuestion: undefined,
        currentQuestionIndex: 0,
        players: resetPlayers,
        config: config
    };

    await supabase.from('rooms').update({ game_state: newState }).eq('id', roomId);
};
