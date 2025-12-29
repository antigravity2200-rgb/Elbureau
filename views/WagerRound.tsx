import React, { useState, useEffect } from 'react';
import { GameState, GamePhase, Player } from '../types';
import { TRANSLATIONS } from '../constants';
import { updateRoomState, updatePlayerState } from '../services/firebase';
import { generateFinalQuestion } from '../services/geminiService';
import { SketchButton } from '../components/SketchButton';
import { SketchCard } from '../components/SketchCard';
import { Avatar } from '../components/Avatar';

interface WagerRoundProps {
    gameState: GameState;
    playerId: string;
    roomId: string;
}

export const WagerRound: React.FC<WagerRoundProps> = ({ gameState, playerId, roomId }) => {
    const { config, players, phase, finalQuestion } = gameState;
    const t = TRANSLATIONS[config.language];
    const me = players.find(p => p.id === playerId);
    const isHost = me?.isHost || false;

    // Local state for Setup
    const [selectedWager, setSelectedWager] = useState<number | null>(null);
    const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard' | null>(null);

    // Local state for Question
    const [answerInput, setAnswerInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Sync local state with remote
    useEffect(() => {
        if (me?.wagerAmount !== undefined) setSelectedWager(me.wagerAmount);
        if (me?.wagerDifficulty) setSelectedDifficulty(me.wagerDifficulty);
        if (me?.currentAnswer) setAnswerInput(me.currentAnswer);
    }, [me]);

    if (!me) return <div>Loading...</div>;

    // --- ACTIONS ---

    const submitWagerSetup = async () => {
        if (selectedWager === null || !selectedDifficulty) return;

        if (isHost) {
            const updatedPlayers = players.map(p =>
                p.id === playerId ? { ...p, wagerAmount: selectedWager, wagerDifficulty: selectedDifficulty } : p
            );
            await updateRoomState(roomId, { players: updatedPlayers });
        } else {
            await updatePlayerState(roomId, playerId, {
                wagerAmount: selectedWager,
                wagerDifficulty: selectedDifficulty
            });
        }
    };

    const generateQuestion = async () => {
        if (!isHost) return;
        await updateRoomState(roomId, { phase: GamePhase.WAGER_GENERATING });

        try {
            // Calculate difficulty vote
            const votes = { easy: 0, medium: 0, hard: 0 };
            players.forEach(p => {
                if (p.wagerDifficulty) votes[p.wagerDifficulty]++;
            });

            // Simple majority or Host tie-break (defaults to medium if distinct)
            let winningDiff = 'medium';
            if (votes.hard > votes.medium && votes.hard > votes.easy) winningDiff = 'hard';
            if (votes.easy > votes.medium && votes.easy > votes.hard) winningDiff = 'easy';
            if (votes.hard === votes.easy && votes.hard > votes.medium) winningDiff = 'hard'; // Tie breaker preference? Host? Let's just default to hard for drama.

            // Actually, let's use host's choice for tie-break if involved, or random.
            // Simplified: The host choice prevails in tie-break if we want "Host decides".
            // But code says "vote", so let's stick to simple majority logic above.

            const question = await generateFinalQuestion(
                gameState.apiKey,
                config.theme,
                config.language,
                winningDiff
            );

            // Reset answers for the question phase
            const resetPlayers = players.map(p => ({
                ...p,
                currentAnswer: '',
                isCorrect: null
            }));

            await updateRoomState(roomId, {
                phase: GamePhase.WAGER_QUESTION,
                finalQuestion: question,
                players: resetPlayers
            });

        } catch (e) {
            console.error(e);
            alert("Failed to generate final question.");
            await updateRoomState(roomId, { phase: GamePhase.WAGER_SETUP });
        }
    };

    const submitFinalAnswer = async () => {
        if (!answerInput.trim()) return;
        setIsSubmitting(true);

        try {
            if (isHost) {
                const updatedPlayers = players.map(p =>
                    p.id === playerId ? { ...p, currentAnswer: answerInput } : p
                );
                const allDone = updatedPlayers.every(p => !!p.currentAnswer);

                await updateRoomState(roomId, {
                    players: updatedPlayers,
                    phase: allDone ? GamePhase.WAGER_REVEAL : GamePhase.WAGER_QUESTION
                });
            } else {
                await updatePlayerState(roomId, playerId, { currentAnswer: answerInput });
            }
        } catch (e) {
            console.error(e);
            alert("Failed to submit.");
            setIsSubmitting(false);
        }
    };

    const toggleWagerCorrectness = async (targetId: string) => {
        if (!isHost || phase !== GamePhase.WAGER_REVEAL) return;

        const updatedPlayers = players.map(p => {
            if (p.id === targetId) {
                return { ...p, isCorrect: !p.isCorrect };
            }
            return p;
        });
        await updateRoomState(roomId, { players: updatedPlayers });
    };

    const finishGame = async () => {
        if (!isHost) return;

        // Calculate Final Scores
        const scoredPlayers = players.map(p => {
            if (p.wagerAmount === undefined) return p;

            // Correct = +Wager, Incorrect = -Wager
            const change = p.isCorrect ? p.wagerAmount : -p.wagerAmount;
            return {
                ...p,
                score: p.score + change
            };
        });

        await updateRoomState(roomId, {
            phase: GamePhase.ENDGAME,
            players: scoredPlayers
        });
    };


    // --- RENDERS ---

    // 1. SETUP PHASE
    if (phase === GamePhase.WAGER_SETUP) {
        const waitingFor = players.filter(p => p.wagerAmount === undefined || !p.wagerDifficulty);
        const mySetupDone = selectedWager !== null && !!selectedDifficulty && me.wagerAmount !== undefined;

        return (
            <div className="flex flex-col h-full w-full max-w-lg mx-auto p-6 overflow-y-auto no-scrollbar">
                <header className="mb-6 text-center">
                    <h2 className="text-3xl font-black text-text-main dark:text-white uppercase transform -rotate-1">Final Wager</h2>
                    <p className="text-sm font-bold opacity-60">High Stakes. Big Rewards... or Ruin.</p>
                </header>

                <SketchCard className="bg-white dark:bg-gray-800 mb-6" padding="p-6">
                    <h3 className="font-bold text-lg mb-4">1. Choose your Wager</h3>
                    <div className="flex justify-between gap-2 mb-6">
                        {[0, 10, 20].map(amt => (
                            <button
                                key={amt}
                                onClick={() => setSelectedWager(amt)}
                                disabled={mySetupDone}
                                className={`
                                    flex-1 py-4 rounded-xl border-2 font-black text-xl transition-all
                                    ${selectedWager === amt
                                        ? 'bg-primary text-black border-black shadow-sketch scale-105'
                                        : 'bg-paper-white text-gray-400 border-gray-200'
                                    }
                                `}
                            >
                                {amt}
                            </button>
                        ))}
                    </div>

                    <h3 className="font-bold text-lg mb-4">2. Vote Difficulty</h3>
                    <div className="flex flex-col gap-2">
                        {(['easy', 'medium', 'hard'] as const).map(diff => (
                            <button
                                key={diff}
                                onClick={() => setSelectedDifficulty(diff)}
                                disabled={mySetupDone}
                                className={`
                                    w-full py-3 rounded-xl border-2 font-bold uppercase transition-all
                                    ${selectedDifficulty === diff
                                        ? 'bg-text-main text-white border-text-main shadow-sketch'
                                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                                    }
                                `}
                            >
                                {diff}
                            </button>
                        ))}
                    </div>
                </SketchCard>

                {!mySetupDone && (
                    <SketchButton
                        disabled={selectedWager === null || !selectedDifficulty}
                        onClick={submitWagerSetup}
                        className="w-full py-4 text-xl shadow-sketch"
                    >
                        Lock In Preference
                    </SketchButton>
                )}

                {mySetupDone && (
                    <div className="text-center animate-pulse">
                        <p className="font-bold text-lg">Waiting for {waitingFor.length} players...</p>
                        {isHost && waitingFor.length === 0 && (
                            <SketchButton
                                onClick={generateQuestion}
                                variant="secondary"
                                className="w-full mt-4 py-4 text-xl bg-pop-red text-white border-black"
                            >
                                GENERATE FINAL BOSS
                            </SketchButton>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // 2. GENERATING PHASE
    if (phase === GamePhase.WAGER_GENERATING) {
        return (
            <div className="flex flex-col h-full w-full items-center justify-center p-6 text-center space-y-6">
                <div className="w-24 h-24 border-8 border-black border-t-pop-red rounded-full animate-spin"></div>
                <h2 className="text-3xl font-black text-pop-red animate-pulse">SUMMONING FINAL BOSS...</h2>
            </div>
        );
    }

    // 3. ACTION PHASE (Answering)
    if (phase === GamePhase.WAGER_QUESTION) {
        const hasSubmitted = !!me.currentAnswer;

        return (
            <div className="flex flex-col h-full w-full max-w-lg mx-auto p-6 overflow-hidden">
                <div className="bg-pop-red text-white text-center py-2 font-black uppercase tracking-widest border-b-4 border-black mb-4 transform -rotate-1 rounded-sm shadow-sm">
                    Final Question
                </div>

                <SketchCard className="bg-white dark:bg-gray-800 mb-6 flex-1 flex flex-col justify-center" padding="p-6">
                    <h2 className="text-2xl md:text-3xl font-black text-center text-text-main dark:text-white leading-tight">
                        {finalQuestion?.text}
                    </h2>
                </SketchCard>

                <div className="flex-none">
                    <textarea
                        value={answerInput}
                        onChange={(e) => setAnswerInput(e.target.value)}
                        placeholder="Your final answer..."
                        disabled={hasSubmitted}
                        className="w-full h-32 bg-white border-2 border-text-main rounded-xl p-4 font-bold text-lg outline-none focus:ring-4 focus:ring-pop-red/20 mb-4 resize-none"
                    />

                    {!hasSubmitted ? (
                        <SketchButton
                            onClick={submitFinalAnswer}
                            disabled={!answerInput.trim() || isSubmitting}
                            className="w-full py-4 text-xl shadow-sketch bg-text-main text-white"
                        >
                            {isSubmitting ? 'Submitting...' : 'SUBMIT FINAL ANSWER'}
                        </SketchButton>
                    ) : (
                        <div className="bg-white/80 border-2 border-dashed border-gray-400 p-4 text-center rounded-xl font-bold text-gray-500 animate-pulse">
                            Answer Sealed. Good luck.
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // 4. REVEAL PHASE
    if (phase === GamePhase.WAGER_REVEAL) {
        return (
            <div className="flex flex-col h-full w-full max-w-lg mx-auto p-4 md:p-6 overflow-hidden">
                <header className="flex-none mb-4 text-center">
                    <div className="bg-pop-red text-white inline-block px-4 py-1 font-black uppercase tracking-widest border-2 border-black transform rotate-1 rounded-sm shadow-sm mb-2">
                        Judgement Day
                    </div>
                    <div>
                        <span className="text-sm font-bold text-gray-500 uppercase">Correct Answer</span>
                        <p className="text-xl font-black text-green-600 dark:text-green-400 leading-tight">
                            {finalQuestion?.correctAnswer}
                        </p>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto no-scrollbar grid grid-cols-1 gap-3 pb-20">
                    {players.map(p => {
                        const isCorrect = p.isCorrect === true;
                        const wagerAmt = p.wagerAmount || 0;

                        return (
                            <div
                                key={p.id}
                                onClick={() => toggleWagerCorrectness(p.id)}
                                className={`
                                    relative p-4 rounded-xl border-2 transition-all cursor-pointer
                                    ${isCorrect
                                        ? 'bg-green-100 border-green-600'
                                        : 'bg-white border-gray-200 opacity-80'
                                    }
                                `}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Avatar size="sm" className={`bg-${p.avatarColor}-100`} />
                                        <span className="font-bold">{p.name}</span>
                                    </div>
                                    <div className={`font-black text-lg ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>
                                        {isCorrect ? `+${wagerAmt}` : `-${wagerAmt}`}
                                    </div>
                                </div>
                                <p className="font-display font-bold text-xl leading-tight">
                                    {p.currentAnswer}
                                </p>

                                {isHost && (
                                    <div className="absolute top-2 right-2">
                                        <span className="material-symbols-outlined">
                                            {isCorrect ? 'check_circle' : 'cancel'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {isHost ? (
                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background-light to-transparent pointer-events-none">
                        <div className="max-w-md mx-auto pointer-events-auto">
                            <SketchButton
                                onClick={finishGame}
                                fullWidth
                                className="py-4 text-xl shadow-sketch-lg bg-black text-white"
                            >
                                SHOW FINAL SCORES
                            </SketchButton>
                        </div>
                    </div>
                ) : (
                    <div className="fixed bottom-6 left-0 right-0 text-center pointer-events-none p-4">
                        <div className="max-w-md mx-auto bg-white/90 backdrop-blur border-2 border-black p-3 rounded-xl font-bold shadow-sketch">
                            Host is calculating final scores...
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return <div>...</div>;
};
