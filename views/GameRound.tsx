import React, { useState, useEffect, useRef } from 'react';
import { GameState, GamePhase, Player, Question } from '../types';
import { TRANSLATIONS } from '../constants';
import { updateRoomState, updatePlayerState } from '../services/firebase';
import { SketchButton } from '../components/SketchButton';
import { SketchCard } from '../components/SketchCard';
import { Avatar } from '../components/Avatar';

interface GameRoundProps {
    gameState: GameState;
    playerId: string;
    roomId: string;
}

export const GameRound: React.FC<GameRoundProps> = ({ gameState, playerId, roomId }) => {
    const { config, players, questions, currentQuestionIndex, phase } = gameState;
    const t = TRANSLATIONS[config.language];

    const me = players.find(p => p.id === playerId);
    const currentQuestion = questions[currentQuestionIndex];

    const [selectedBet, setSelectedBet] = useState<number | null>(null);
    const [answerInput, setAnswerInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [timeLeft, setTimeLeft] = useState(config.timerSeconds > 0 ? config.timerSeconds : 0);

    // Reset local state on new question
    useEffect(() => {
        setSelectedBet(me?.currentBet || null);
        setAnswerInput(me?.currentAnswer || '');
        setIsSubmitting(false);
        setTimeLeft(config.timerSeconds > 0 ? config.timerSeconds : 0);
    }, [currentQuestionIndex, config.timerSeconds]);

    // Timer Effect
    useEffect(() => {
        if (phase !== GamePhase.BETTING || config.timerSeconds <= 0) return;

        // If everyone submitted, stop visually
        if (players.every(p => p.currentBet !== null && !!p.currentAnswer)) return;

        if (timeLeft <= 0) return;

        const timer = setInterval(() => {
            setTimeLeft(prev => prev > 0 ? prev - 1 : 0);
        }, 1000);

        return () => clearInterval(timer);
    }, [phase, timeLeft, config.timerSeconds, players]);

    // Sync effective selection from remote if available
    useEffect(() => {
        if (me?.currentBet) setSelectedBet(me.currentBet);
    }, [me?.currentBet]);

    useEffect(() => {
        if (me?.currentAnswer) setAnswerInput(me.currentAnswer);
    }, [me?.currentAnswer]);


    if (!me || !currentQuestion) return <div>Loading...</div>;

    const isHost = me.isHost;

    // --- ACTIONS ---

    const handleBetClick = (amount: number) => {
        if (phase !== GamePhase.BETTING) return;
        if (me.currentBet && me.currentAnswer) return; // Already fully submitted

        setSelectedBet(amount);
    };

    const submitPrediction = async () => {
        if (!selectedBet || !answerInput.trim()) return;
        setIsSubmitting(true);

        try {
            if (isHost) {
                // Host can update room state directly
                const updatedPlayers = players.map(p =>
                    p.id === playerId ? { ...p, currentBet: selectedBet, currentAnswer: answerInput } : p
                );

                // Check if all players have submitted BOTH
                const allDone = updatedPlayers.every(p => p.currentBet !== null && !!p.currentAnswer);

                // Transition to PREVIEW first, then REVEAL
                await updateRoomState(roomId, {
                    players: updatedPlayers,
                    phase: allDone ? GamePhase.PREVIEW : GamePhase.BETTING
                });
            } else {
                // Joined players send update to host via P2P
                await updatePlayerState(roomId, playerId, {
                    currentBet: selectedBet,
                    currentAnswer: answerInput
                });
            }
            // Note: We do NOT set isSubmitting(false) here. 
            // We wait for the state update to come back, which will toggle 'hasSubmitted' and remove the button.
        } catch (e) {
            console.error("Submission error:", e);
            alert("Failed to submit answer: " + (e as any).message);
            setIsSubmitting(false); // Allow retry
        }
    };

    const handleReveal = async () => {
        if (!isHost) return;
        await updateRoomState(roomId, { phase: GamePhase.REVEAL });
    };

    const toggleCorrectness = async (targetId: string) => {
        if (!isHost || phase !== GamePhase.REVEAL) return;

        // Toggle the target player's isCorrect status
        const updatedPlayers = players.map(p => {
            if (p.id === targetId) {
                return { ...p, isCorrect: !p.isCorrect };
            }
            return p;
        });

        await updateRoomState(roomId, { players: updatedPlayers });
    };

    const handleNextPhase = async () => {
        if (!isHost) return;

        if (phase === GamePhase.REVEAL) {
            // 1. Calculate Scores based on isCorrect status
            const scoredPlayers = players.map(p => {
                const pointsWon = p.isCorrect ? (p.currentBet || 0) : 0;
                return {
                    ...p,
                    score: p.score + pointsWon
                };
            });

            // Next Question or End Game
            const nextIdx = currentQuestionIndex + 1;
            if (nextIdx >= questions.length) {
                // Transition to Final Wager Round
                const resetPlayers = scoredPlayers.map(p => ({
                    ...p,
                    currentBet: null,
                    currentAnswer: '',
                    isCorrect: null,
                }));

                await updateRoomState(roomId, {
                    phase: GamePhase.WAGER_SETUP,
                    players: resetPlayers
                });
            } else {
                // Reset player round state
                const resetPlayers = scoredPlayers.map(p => ({
                    ...p,
                    currentBet: null,
                    currentAnswer: '',
                    isCorrect: null,
                    betsAvailable: p.betsAvailable.filter(b => b !== p.currentBet) // Remove used chip
                }));

                await updateRoomState(roomId, {
                    phase: GamePhase.BETTING,
                    currentQuestionIndex: nextIdx,
                    players: resetPlayers
                });
            }
        }
    };


    // --- RENDER HELPERS ---

    const isInputPhase = phase === GamePhase.BETTING;
    const isActionPhase = phase === GamePhase.BETTING || phase === GamePhase.ANSWERING;
    const isPreview = phase === GamePhase.PREVIEW;
    const isReveal = phase === GamePhase.REVEAL;

    const hasSubmitted = me.currentBet !== null && !!me.currentAnswer;

    return (
        <div className="flex flex-col h-full w-full max-w-lg mx-auto p-4 md:p-6 overflow-hidden">

            {/* 1. TOP BAR: Progress & Score - Keep at top */}
            <header className="flex-none flex items-center justify-between mb-2 z-10 scale-95 origin-top">
                <div className="flex items-center gap-2 bg-white dark:bg-white/10 px-3 py-1 rounded-sketchy border-2 border-text-main dark:border-white shadow-sketch text-sm font-bold">
                    <span className="text-primary mr-1">Q</span>
                    {currentQuestionIndex + 1} / {config.questionCount}
                </div>

                <div className={`flex items-center gap-2 px-4 py-1 rounded-full border-2 border-text-main shadow-sketch transition-all ${me.isCorrect === true ? 'bg-primary' : me.isCorrect === false ? 'bg-red-100' : 'bg-paper-white'}`}>
                    <span className="material-symbols-outlined text-lg">stars</span>
                    <span className="font-black text-xl">{me.score}</span>
                </div>
            </header>

            {/* CENTERED CONTENT WRAPPER */}
            <div className="flex-1 flex flex-col justify-center gap-12 w-full max-h-full overflow-y-auto no-scrollbar pb-6 relative">

                {/* 2. QUESTION CARD */}
                <section className="relative z-20 animate-slide-in-down flex-none mt-2">
                    <SketchCard className="bg-white dark:bg-gray-800" padding="p-5">
                        <div className="absolute -top-3 -left-2 bg-primary text-black text-xs font-black uppercase px-2 py-1 rounded-sm border-2 border-black rotate-[-6deg] shadow-sm">
                            {currentQuestion.category || "General"}
                        </div>

                        <h2 className="text-xl md:text-2xl font-black text-center text-text-main dark:text-white leading-tight mt-2 line-clamp-4">
                            {currentQuestion.text}
                        </h2>

                        {/* TIMER BAR */}
                        {isInputPhase && config.timerSeconds > 0 && (
                            <div className="mt-6">
                                <div className="flex justify-between items-end mb-1 px-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Time Remaining</span>
                                    <span className="text-xs font-black text-gray-800 dark:text-gray-200">{timeLeft}s</span>
                                </div>
                                <div className="relative w-full h-3 bg-white border-2 border-black rounded-full overflow-hidden shadow-sm">
                                    <div
                                        className="absolute top-0 left-0 h-full bg-primary transition-all duration-1000 ease-linear"
                                        style={{ width: `${(timeLeft / config.timerSeconds) * 100}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {isReveal && (
                            <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-200 dark:border-gray-600 text-center animate-fade-in">
                                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Answer</p>
                                <p className="text-xl font-bold text-green-600 dark:text-green-400">{currentQuestion.correctAnswer}</p>
                            </div>
                        )}
                    </SketchCard>
                </section>

                {/* 3. MAIN CONTENT AREA (Switches between Action and Grid) */}

                {/* VIEW A: BETTING & INPUT (Action Phase) */}
                {isActionPhase && (
                    <section className="flex flex-col gap-5 relative z-30 flex-none animate-slide-up">

                        {/* Betting Row */}
                        <div className="transition-all duration-300">
                            <div className="flex items-center justify-between mb-2 px-1">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">1. Wager</label>
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-2 px-1 no-scrollbar justify-center py-2">
                                {me.betsAvailable.map(chipVal => {
                                    const isSelected = selectedBet === chipVal;
                                    return (
                                        <button
                                            key={chipVal}
                                            onClick={() => handleBetClick(chipVal)}
                                            disabled={hasSubmitted}
                                            className={`
                        flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center
                        font-black text-lg border-2 transition-all transform
                        touch-action-manipulation select-none
                        ${isSelected
                                                    ? 'bg-primary text-black border-black shadow-sketch scale-110 -translate-y-2 z-10'
                                                    : 'bg-white text-gray-600 border-gray-300 hover:border-black hover:-translate-y-1'
                                                }
                        ${!isSelected ? '' : ''} 
                    `}
                                        >
                                            {chipVal}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Answer Input */}
                        <div className={`transition-all duration-500 ${selectedBet ? 'opacity-100 translate-y-0' : 'opacity-30 translate-y-4'}`}>
                            <div className="flex items-center justify-between mb-1 px-1">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">2. Answer</label>
                            </div>

                            <SketchCard className="bg-paper-white/50 dark:bg-white/5 border-dashed" padding="p-3">
                                {config.questionTypes === 'mc' && currentQuestion.options ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        {currentQuestion.options.map((opt, i) => (
                                            <button
                                                key={i}
                                                onClick={() => !hasSubmitted && setAnswerInput(opt)}
                                                disabled={hasSubmitted}
                                                className={`
                            p-2 rounded-xl border-2 text-sm font-bold text-center transition-all
                            touch-action-manipulation select-none
                            ${answerInput === opt
                                                        ? 'bg-text-main text-white border-text-main shadow-sketch scale-[1.02]'
                                                        : 'bg-white text-text-main border-gray-300 hover:border-text-main'
                                                    }
                            `}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={answerInput}
                                            onChange={(e) => setAnswerInput(e.target.value)}
                                            placeholder={selectedBet ? "Type answer..." : "Pick wager first..."}
                                            disabled={hasSubmitted || !selectedBet}
                                            className="w-full bg-white dark:bg-gray-800 border-2 border-text-main rounded-xl px-4 py-3 text-center font-bold text-lg outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all shadow-inner disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                                        />
                                        {!hasSubmitted && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none">
                                                <span className="material-symbols-outlined text-sm">edit</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </SketchCard>
                        </div>
                    </section>
                )}

                {/* VIEW B: ANSWER GRID (Preview & Reveal) */}
                {(isPreview || isReveal) && (
                    <>
                        {/* Only show preview if current player has submitted */}
                        {(isPreview && !hasSubmitted) ? (
                            <div className="text-center text-gray-500 font-bold bg-white/80 py-8 rounded-lg backdrop-blur-sm">
                                Answer submitted! Waiting for others...
                            </div>
                        ) : (
                            <section className="grid grid-cols-2 gap-4 w-full px-1 animate-fade-in relative z-30">
                                {players.map((p, i) => {
                                    const isCorrect = p.isCorrect === true; // Strict check for yellow

                                    const bgClass = isCorrect ? 'bg-primary' : 'bg-paper-white dark:bg-gray-700';
                                    const borderClass = isCorrect ? 'border-2 border-black z-20' : 'border-[3px] border-text-main';
                                    const scaleClass = isCorrect ? 'scale-105' : '';

                                    return (
                                        <div
                                            key={p.id}
                                            onClick={() => toggleCorrectness(p.id)}
                                            className={`
                             rounded-xl p-4 shadow-sketch relative group transition-all duration-200
                             ${bgClass} ${borderClass} ${scaleClass}
                             ${isReveal && isHost ? 'cursor-pointer' : 'cursor-default'}
                           `}
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <Avatar size="md" className={`${p.avatarColor}`} />
                                                {isReveal && (
                                                    <span className="material-symbols-outlined text-xl">
                                                        {isCorrect ? 'check_circle' : 'help'}
                                                    </span>
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-black leading-tight break-words dark:text-white line-clamp-3 mb-2">
                                                    {isPreview || isReveal || isHost || p.id === me.id ? p.currentAnswer : "..."}
                                                </h3>
                                                <p className="text-sm font-bold opacity-70">@{p.name}</p>

                                                {isReveal && (
                                                    <div className="absolute -top-2 -right-2 bg-text-main text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-white">
                                                        {p.currentBet}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </section>
                        )}
                    </>
                )}


                {/* 4. FOOTER BUTTON */}
                <div className="pt-2 text-center z-30 min-h-[60px] flex items-end justify-center">
                    {isActionPhase && !hasSubmitted && (
                        <SketchButton
                            variant="primary"
                            disabled={!selectedBet || !answerInput || isSubmitting}
                            onClick={submitPrediction}
                            className="w-full text-lg py-3 shadow-sketch-lg"
                        >
                            {isSubmitting ? 'Sending...' : 'Lock In Answer & Bet'}
                        </SketchButton>
                    )}

                    {isActionPhase && hasSubmitted && (
                        <div className="w-full text-gray-500 font-bold bg-white/80 py-3 rounded-lg backdrop-blur-sm animate-pulse border-2 border-dashed border-gray-300">
                            Waiting for others...
                        </div>
                    )}

                    {/* Host Controls for Preview -> Reveal */}
                    {isPreview && isHost && (
                        <SketchButton
                            variant="primary"
                            onClick={handleReveal}
                            className="w-full text-lg py-3 shadow-sketch-lg bg-pop-blue border-black text-white"
                        >
                            Start Judging <span className="material-symbols-outlined ml-2">gavel</span>
                        </SketchButton>
                    )}

                    {isPreview && !isHost && (
                        <div className="text-gray-500 font-bold bg-white/80 py-2 rounded-lg backdrop-blur-sm">
                            Waiting for host to judge...
                        </div>
                    )}

                    {/* Host Controls for Reveal -> Next */}
                    {isReveal && isHost && (
                        <div className="w-full flex flex-col gap-2">
                            <div className="text-sm font-bold bg-white/80 py-1 rounded-full text-gray-600 mb-1 animate-bounce">
                                Target Correct Cards!
                            </div>
                            <SketchButton
                                variant="secondary"
                                onClick={handleNextPhase}
                                className="w-full text-lg py-3"
                            >
                                Confirm & Next <span className="material-symbols-outlined ml-2">check_circle</span>
                            </SketchButton>
                        </div>
                    )}

                    {isReveal && !isHost && (
                        <div className="text-gray-500 font-bold bg-white/80 py-2 rounded-lg backdrop-blur-sm">
                            Host is judging answers...
                        </div>
                    )}
                </div>

            </div>

        </div>
    );
};
