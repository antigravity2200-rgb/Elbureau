import React, { useState, useEffect, useRef } from 'react';
import { GameState, GamePhase, Player, Question, Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { updateRoomState, updatePlayerState } from '../services/supabaseService';
import { SketchButton } from '../components/SketchButton';
import { SketchCard } from '../components/SketchCard';
import { Avatar } from '../components/Avatar';
import { generateFinalQuestion, validateAnswersBatch } from '../services/geminiService';

interface GameRoundProps {
    gameState: GameState;
    playerId: string;
    roomId: string;
}

export const GameRound: React.FC<GameRoundProps> = ({ gameState, playerId, roomId }) => {
    const { config, players, questions, currentQuestionIndex, phase } = gameState;

    // Detect User Language
    const [localLang, setLocalLang] = useState<Language>(config.language);
    useEffect(() => {
        try {
            const browserLang = navigator.language.split('-')[0] as Language;
            if (Object.values(Language).includes(browserLang)) {
                setLocalLang(browserLang);
            }
        } catch (e) {
            console.warn("Language detection failed", e);
        }
    }, []);

    const t = TRANSLATIONS[localLang];

    const me = players.find(p => p.id === playerId);
    const isHost = me?.isHost;

    const isWagerPhase = [GamePhase.WAGER_SETUP, GamePhase.WAGER_GENERATING, GamePhase.WAGER_QUESTION, GamePhase.WAGER_REVEAL].includes(phase);
    const activeQuestion = isWagerPhase ? (gameState.finalQuestion || { text: t.generatingFinal, category: t.wagerRound, correctAnswer: "", id: "final", type: "open" } as Question) : questions[currentQuestionIndex];

    const [selectedBet, setSelectedBet] = useState<number | null>(null);
    const [answerInput, setAnswerInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isValidating, setIsValidating] = useState(false); // New Guard State
    const [timeLeft, setTimeLeft] = useState(config.timerSeconds > 0 ? config.timerSeconds : 0);
    const [tieBreakerOptions, setTieBreakerOptions] = useState<string[] | null>(null);

    // Reset local state on new question or phase change
    useEffect(() => {
        setSelectedBet(me?.currentBet || null);
        setAnswerInput(me?.currentAnswer || '');
        setIsSubmitting(false);
        setIsValidating(false);
        setTimeLeft(config.timerSeconds > 0 ? config.timerSeconds : 0);
    }, [currentQuestionIndex, phase, config.timerSeconds]);

    // Timer Effect & Auto-Submission
    useEffect(() => {
        if (![GamePhase.BETTING, GamePhase.WAGER_QUESTION].includes(phase)) return;

        // If everyone submitted, stop visually
        if (players.every(p => p.currentBet !== null && !!p.currentAnswer)) return;

        if (timeLeft > 0) {
            const timer = setInterval(() => {
                setTimeLeft(prev => prev > 0 ? prev - 1 : 0);
            }, 1000);
            return () => clearInterval(timer);
        } else if (timeLeft === 0 && isHost) {
            // TIME IS UP! Auto-submit valid placeholders for laggers
            const laggingPlayers = players.filter(p => !p.currentAnswer || (phase === GamePhase.BETTING && p.currentBet === null));

            if (laggingPlayers.length > 0) {
                const updatedPlayers = players.map(p => {
                    if (!p.currentAnswer || (phase === GamePhase.BETTING && p.currentBet === null)) {
                        // Force a bet if needed (lowest available)
                        const forcedBet = (phase === GamePhase.BETTING && p.currentBet === null)
                            ? (p.betsAvailable[0] || 0)
                            : p.currentBet;

                        return {
                            ...p,
                            currentBet: forcedBet,
                            currentAnswer: '-' // Mark as effectively wrong
                        };
                    }
                    return p;
                });

                updateRoomState(roomId, {
                    players: updatedPlayers,
                    phase: GamePhase.PREVIEW // Force move since everyone is now "done"
                });
            }
        }
    }, [phase, timeLeft, config.timerSeconds, players, isHost, roomId]);

    // Sync effective selection from remote if available
    useEffect(() => {
        if (me?.currentBet) setSelectedBet(me.currentBet);
    }, [me?.currentBet]);

    useEffect(() => {
        if (me?.currentAnswer) setAnswerInput(me.currentAnswer);
    }, [me?.currentAnswer]);


    if (!me || (!activeQuestion && !isWagerPhase)) return <div>Loading...</div>;

    // Use activeQuestion for rendering, with fallback to translations
    const currentQuestion = {
        ...activeQuestion,
        text: activeQuestion?.translations?.[localLang]?.text || activeQuestion?.text,
        options: activeQuestion?.translations?.[localLang]?.options || activeQuestion?.options,
        correctAnswer: activeQuestion?.translations?.[localLang]?.correctAnswer || activeQuestion?.correctAnswer,
        hint: activeQuestion?.translations?.[localLang]?.hint || activeQuestion?.hint,
        explanation: activeQuestion?.translations?.[localLang]?.explanation || activeQuestion?.explanation,
    };

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
        if (!isHost || isValidating) return;
        setIsValidating(true);

        // Prep Batch Submissions
        const submissions = players
            .filter(p => !!p.currentAnswer)
            .map(p => ({ id: p.id, answer: p.currentAnswer }));

        try {
            const validationResults = await validateAnswersBatch(
                gameState.apiKey,
                currentQuestion.text,
                currentQuestion.correctAnswer,
                submissions,
                localLang
            );

            const validatedPlayers = players.map(p => ({
                ...p,
                isCorrect: validationResults[p.id] ?? false // Default false if missing
            }));

            await updateRoomState(roomId, {
                phase: GamePhase.REVEAL,
                players: validatedPlayers
            });
        } catch (e) {
            console.error("Reveal validation error", e);
            alert("Error validating answers. Please try again.");
            setIsValidating(false);
        }
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

            // CHECK FOR FINAL WAGER ROUND
            if (nextIdx >= questions.length) {
                await updateRoomState(roomId, {
                    phase: GamePhase.WAGER_SETUP,
                    // Reset player round state for wager
                    players: players.map(p => ({
                        ...p,
                        wagerAmount: undefined,
                        wagerDifficulty: undefined,
                        currentAnswer: '',
                        isCorrect: null
                    }))
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



    const handleStartFinalRound = async () => {
        if (!isHost) return;

        // 1. Calculate Winning Difficulty
        const votes = { easy: 0, medium: 0, hard: 0 };
        players.forEach(p => {
            if (p.wagerDifficulty) votes[p.wagerDifficulty as keyof typeof votes]++;
        });

        // Find max
        let winningDiff = 'medium';
        let maxVotes = -1;
        (Object.entries(votes) as [string, number][]).forEach(([diff, count]) => {
            if (count > maxVotes) {
                maxVotes = count;
                winningDiff = diff;
            } else if (count === maxVotes) {
                if (diff === 'hard') winningDiff = 'hard';
            }
        });

        // 2. Set State to Generating
        // TIE BREAKER: If there's a tie, don't auto-proceed. Show selection UI for Host.
        const tiedDifficulties = (Object.entries(votes) as [string, number][])
            .filter(([_, count]) => count === maxVotes)
            .map(([diff]) => diff);

        if (tiedDifficulties.length > 1 && isHost) {
            setTieBreakerOptions(tiedDifficulties);
            return;
        }

        // --- FIX: Race Condition Protection ---
        // We set a flag or loading state to prevent double clicks? 
        // Actually, we transition to WAGER_GENERATING. 
        // But let's log it.
        console.log("Starting Final Round Generation...");

        await updateRoomState(roomId, {
            phase: GamePhase.WAGER_GENERATING,
            winningDifficulty: winningDiff,
            loadingMessage: undefined // Clear any previous error
        });

        // 3. Generate Question
        try {
            const finalQ = await generateFinalQuestion(gameState.apiKey, config.theme, config.language, winningDiff);

            // Fetch latest state to ensure we don't overwrite any (unlikely) changes, 
            // but more importantly, we just push the new phase.
            await updateRoomState(roomId, {
                phase: GamePhase.WAGER_QUESTION,
                finalQuestion: finalQ,
                // Reset player inputs
                players: players.map(p => ({ ...p, currentAnswer: '', isCorrect: null }))
            });

        } catch (e) {
            console.error("Final Gen Error", e);
            await updateRoomState(roomId, {
                phase: GamePhase.WAGER_SETUP,
                loadingMessage: "Error generating question. Please try again. (" + (e as any).message + ")"
            });
        }
    };

    const submitWagerPrediction = async () => {
        if (!answerInput.trim()) return;
        setIsSubmitting(true);
        try {
            await updatePlayerState(roomId, playerId, { currentAnswer: answerInput });
        } catch (e) {
            alert((e as any).message);
            setIsSubmitting(false);
        }
    };

    const handleWagerReveal = async () => {
        if (!isHost || isValidating) return;
        setIsValidating(true);

        const submissions = players
            .filter(p => !!p.currentAnswer)
            .map(p => ({ id: p.id, answer: p.currentAnswer }));

        try {
            const validationResults = await validateAnswersBatch(
                gameState.apiKey,
                currentQuestion.text,
                currentQuestion.correctAnswer,
                submissions,
                localLang
            );

            const validatedPlayers = players.map(p => ({
                ...p,
                isCorrect: validationResults[p.id] ?? false
            }));

            await updateRoomState(roomId, {
                phase: GamePhase.WAGER_REVEAL,
                players: validatedPlayers
            });
        } catch (e) {
            console.error("Wager reveal error", e);
            alert("Error validating final answers.");
            setIsValidating(false);
        }
    };

    const handleEndGame = async () => {
        if (!isHost) return;

        // Calculate Final Scores
        const scoredPlayers = players.map(p => {
            let change = 0;
            if (p.isCorrect === true) change = (p.wagerAmount || 0);
            if (p.isCorrect === false) change = -(p.wagerAmount || 0);

            return { ...p, score: p.score + change };
        });

        await updateRoomState(roomId, {
            phase: GamePhase.ENDGAME,
            players: scoredPlayers
        });
    };

    // --- RENDER HELPERS ---

    const isInputPhase = phase === GamePhase.BETTING || phase === GamePhase.WAGER_QUESTION;
    const isActionPhase = phase === GamePhase.BETTING || phase === GamePhase.ANSWERING || phase === GamePhase.WAGER_QUESTION;
    const isPreview = phase === GamePhase.PREVIEW || phase === GamePhase.WAGER_REVEAL; // Reuse preview logic for wager reveal initially
    const isReveal = phase === GamePhase.REVEAL;
    const isWagerReveal = phase === GamePhase.WAGER_REVEAL;

    // For wager question, HasSubmitted is just answer check
    const hasSubmitted = isWagerPhase
        ? !!me.currentAnswer
        : (me.currentBet !== null && !!me.currentAnswer);

    return (
        <div className="flex flex-col h-full w-full max-w-lg mx-auto p-4 pt-12 md:p-6 overflow-hidden">

            {/* 1. TOP BAR: Progress & Score - Keep at top */}
            <header className="flex-none flex items-center justify-between mb-2 z-10 origin-top">
                <div className="flex items-center gap-2 bg-white dark:bg-white/10 px-3 py-1 rounded-sketchy border-2 border-text-main dark:border-white shadow-sketch text-sm font-bold">
                    <span className="text-primary mr-1">Q</span>
                    {isWagerPhase ? t.wagerRound.split(' ')[0] : `${currentQuestionIndex + 1} / ${config.questionCount}`}
                </div>

                <div className={`flex items-center gap-2 px-4 py-1 rounded-full border-2 border-text-main shadow-sketch transition-all ${me.isCorrect === true ? 'bg-primary' : me.isCorrect === false ? 'bg-red-100' : 'bg-paper-white'}`}>
                    <span className="material-symbols-outlined text-lg">stars</span>
                    <span className="font-black text-xl">{me.score}</span>
                </div>
            </header>

            {/* CENTERED CONTENT WRAPPER */}
            <div className="flex-1 flex flex-col justify-center gap-12 w-full max-h-full overflow-y-auto no-scrollbar pb-6 relative">

                {/* 2. QUESTION CARD (Hide during Wager Setup) */}
                {phase !== GamePhase.WAGER_SETUP && (
                    <section className="relative z-20 animate-slide-in-down flex-none mt-2">
                        <SketchCard className={`${isWagerPhase ? "bg-black text-white border-pop-yellow" : "bg-white dark:bg-gray-800"}`} padding="p-5">
                            <div className="absolute -top-3 -left-2 bg-primary text-black text-xs font-black uppercase px-2 py-1 rounded-sm border-2 border-black rotate-[-6deg] shadow-sm">
                                {currentQuestion.category || (isWagerPhase ? t.wagerRound : "General")}
                            </div>

                            <h2 className={`text-2xl md:text-3xl font-black text-center leading-tight mt-3 line-clamp-4 ${isWagerPhase ? "text-pop-yellow" : "text-text-main dark:text-white"}`}>
                                {currentQuestion.text}
                            </h2>

                            {/* TIMER BAR */}
                            {isInputPhase && config.timerSeconds > 0 && (
                                <div className="mt-6">
                                    <div className="flex justify-between items-end mb-1 px-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{t.timeRemaining}</span>
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

                            {(isReveal || isWagerReveal) && (
                                <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-200 dark:border-gray-600 text-center animate-fade-in">
                                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">{t.answerLabel}</p>
                                    <p className="text-xl font-bold text-green-600 dark:text-green-400">{currentQuestion.correctAnswer}</p>
                                </div>
                            )}
                        </SketchCard>
                    </section>
                )}

                {/* 3. MAIN CONTENT AREA (Switches between Action, Grid, Wager) */}

                {/* VIEW A: BETTING & INPUT (Action Phase) */}
                {isActionPhase && (
                    <section className="flex flex-col gap-5 relative z-30 flex-none animate-slide-up">

                        {/* Betting Row (Only for Standard Rounds) */}
                        {!isWagerPhase && (
                            <div className="transition-all duration-300">
                                <div className="flex items-center justify-between mb-2 px-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">1. {t.wagerPoints}</label>
                                </div>
                                <div className="flex gap-2 flex-wrap justify-center py-2">
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
                                                `}
                                            >
                                                {chipVal}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Answer Input */}
                        <div className={`transition-all duration-500 ${selectedBet || isWagerPhase ? 'opacity-100 translate-y-0' : 'opacity-30 translate-y-4'}`}>
                            <div className="flex items-center justify-between mb-1 px-1">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{isWagerPhase ? t.finalAnswerPlaceholder : "2. " + t.submitAnswer}</label>
                            </div>

                            <SketchCard className="bg-paper-white/50 dark:bg-white/5 border-dashed" padding="p-3">
                                {config.questionTypes === 'mc' && currentQuestion.options && !isWagerPhase ? (
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
                                            placeholder={isWagerPhase ? t.finalAnswerPlaceholder : (selectedBet ? t.typeAnswer : t.pickWagerFirst)}
                                            disabled={hasSubmitted || (!selectedBet && !isWagerPhase)}
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
                {(isPreview || isReveal || isWagerReveal) && (
                    <>
                        {/* Only show preview if current player has submitted */}
                        {(isPreview && !hasSubmitted) ? (
                            <div className="text-center text-gray-500 font-bold bg-white/80 py-8 rounded-lg backdrop-blur-sm">
                                {t.waitingForOthers}
                            </div>
                        ) : (
                            <section className="grid grid-cols-2 gap-4 w-full px-1 animate-fade-in relative z-30">
                                {players.map((p, i) => {
                                    const isCorrect = p.isCorrect === true;
                                    const bgClass = isCorrect ? 'bg-primary' : (p.isCorrect === false ? 'bg-red-200' : 'bg-paper-white dark:bg-gray-700');
                                    const borderClass = isCorrect ? 'border-2 border-black z-20' : 'border-[3px] border-text-main';
                                    const scaleClass = isCorrect ? 'scale-105' : '';

                                    return (
                                        <div
                                            key={p.id}
                                            onClick={() => toggleCorrectness(p.id)}
                                            className={`
                                            rounded-xl p-4 shadow-sketch relative group transition-all duration-200
                                            ${bgClass} ${borderClass} ${scaleClass}
                                            ${(isReveal || isWagerReveal) && isHost ? 'cursor-pointer' : 'cursor-default'}
                                        `}
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <Avatar size="md" className={`${p.avatarColor}`} />
                                                {(isReveal || isWagerReveal) && (
                                                    <span className="material-symbols-outlined text-xl">
                                                        {isCorrect ? 'check_circle' : (p.isCorrect === false ? 'cancel' : 'help')}
                                                    </span>
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-black leading-tight break-words dark:text-white line-clamp-3 mb-2">
                                                    {(isPreview || isReveal || isWagerReveal || isHost || p.id === me.id) ? p.currentAnswer : "..."}
                                                </h3>
                                                <p className="text-sm font-bold opacity-70">@{p.name}</p>

                                                {(isReveal || isWagerReveal) && (
                                                    <div className="absolute -top-2 -right-2 bg-text-main text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-white">
                                                        {isWagerPhase ? (p.wagerAmount || 0) : (p.currentBet || 0)}
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

                {/* 5. WAGER SETUP (Votes & Bet) */}
                {phase === GamePhase.WAGER_SETUP && (
                    <section className="flex flex-col gap-6 relative z-30 flex-none animate-slide-up w-full">
                        <div className="text-center mb-2">
                            <h2 className="text-3xl font-black text-text-main dark:text-white mb-1">{t.wagerRound}</h2>
                            <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">{t.highStakes}</p>
                        </div>

                        {/* SCOREBOARD PREVIEW */}
                        <SketchCard className="bg-paper-white dark:bg-gray-700 max-h-40 overflow-y-auto" padding="p-2">
                            <div className="grid grid-cols-2 gap-2">
                                {players.map(p => (
                                    <div key={p.id} className="flex items-center justify-between bg-white dark:bg-gray-800 p-2 rounded-lg border-2 border-gray-200">
                                        <div className="flex items-center gap-2">
                                            <Avatar size="xs" className={p.avatarColor} />
                                            <span className="font-bold text-xs truncate max-w-[80px]">{p.name}</span>
                                        </div>
                                        <span className="font-black text-sm">{p.score}</span>
                                    </div>
                                ))}
                            </div>
                        </SketchCard>

                        {/* Wager Amount Selection */}
                        <SketchCard className="bg-white dark:bg-gray-800" padding="p-4">
                            <h3 className="text-lg font-black mb-3">1. {t.chooseWager}</h3>
                            <div className="grid grid-cols-3 gap-3">
                                {[0, 10, 20].map(amt => (
                                    <button
                                        key={amt}
                                        onClick={() => {
                                            if (me.wagerAmount === undefined) updatePlayerState(roomId, playerId, { wagerAmount: amt });
                                        }}
                                        disabled={me.wagerAmount !== undefined}
                                        className={`
                                            p-4 rounded-xl border-2 text-xl font-black transition-all
                                            ${me.wagerAmount === amt
                                                ? 'bg-pop-yellow border-black shadow-sketch scale-105'
                                                : 'bg-white border-gray-300 hover:border-black text-gray-400'
                                            }
                                        `}
                                    >
                                        {amt}
                                    </button>
                                ))}
                            </div>
                        </SketchCard>

                        {/* Difficulty Vote */}
                        <SketchCard className="bg-white dark:bg-gray-800" padding="p-4">
                            <h3 className="text-lg font-black mb-3">2. {t.voteDifficulty}</h3>
                            <div className="grid grid-cols-3 gap-3">
                                {['easy', 'medium', 'hard'].map(diff => (
                                    <button
                                        key={diff}
                                        onClick={() => {
                                            if (me.wagerDifficulty === undefined) updatePlayerState(roomId, playerId, { wagerDifficulty: diff as any });
                                        }}
                                        disabled={me.wagerDifficulty !== undefined}
                                        className={`
                                            p-4 rounded-xl border-2 text-sm font-black transition-all uppercase
                                            ${me.wagerDifficulty === diff
                                                ? 'bg-pop-red text-white border-black shadow-sketch scale-105'
                                                : 'bg-white border-gray-300 hover:border-black text-gray-400'
                                            }
                                        `}
                                    >
                                        {diff}
                                    </button>
                                ))}
                            </div>
                        </SketchCard>

                        {/* Waiting Message */}
                        {me.wagerAmount !== undefined && me.wagerDifficulty !== undefined && !gameState.loadingMessage && (
                            <div className="text-center text-gray-500 font-bold bg-white/80 py-3 rounded-lg backdrop-blur-sm animate-pulse">
                                {t.waitingForOthers}
                            </div>
                        )}

                        {/* Error Message */}
                        {gameState.loadingMessage && (
                            <div className="text-center text-pop-red font-bold bg-white/90 py-3 rounded-lg border-2 border-pop-red animate-bounce">
                                ⚠ {gameState.loadingMessage}
                            </div>
                        )}

                        {/* Host Logic for Transition */}
                        {isHost && players.every(p => p.wagerAmount !== undefined && p.wagerDifficulty !== undefined) && !tieBreakerOptions && (
                            <SketchButton
                                variant="primary"
                                onClick={handleStartFinalRound}
                                className="w-full text-lg py-3 shadow-sketch-lg animate-bounce"
                            >
                                {t.generateFinalBtn}
                            </SketchButton>
                        )}

                        {/* TIE BREAKER UI */}
                        {isHost && tieBreakerOptions && (
                            <SketchCard className="bg-pop-yellow border-black animate-pulse" padding="p-4">
                                <h3 className="text-lg font-black mb-3">TIE! Pick Difficulty:</h3>
                                <div className="flex gap-2 justify-center">
                                    {tieBreakerOptions.map(diff => (
                                        <button
                                            key={diff}
                                            onClick={async () => {
                                                setTieBreakerOptions(null);
                                                await updateRoomState(roomId, {
                                                    phase: GamePhase.WAGER_GENERATING,
                                                    winningDifficulty: diff
                                                });
                                                // Trigger logic manually since we bypassed the vote calculation
                                                try {
                                                    const finalQ = await generateFinalQuestion(gameState.apiKey, config.theme, config.language, diff);
                                                    await updateRoomState(roomId, {
                                                        phase: GamePhase.WAGER_QUESTION,
                                                        finalQuestion: finalQ,
                                                        winningDifficulty: diff,
                                                        players: players.map(p => ({ ...p, currentAnswer: '', isCorrect: null }))
                                                    });
                                                } catch (e) {
                                                    console.error("Final Gen Error", e);
                                                    await updateRoomState(roomId, {
                                                        phase: GamePhase.WAGER_SETUP,
                                                        loadingMessage: "Error generating. Try again."
                                                    });
                                                }
                                            }}
                                            className="px-4 py-2 bg-black text-white font-bold rounded-lg uppercase hover:scale-105 transition-transform"
                                        >
                                            {diff}
                                        </button>
                                    ))}
                                </div>
                            </SketchCard>
                        )}
                    </section>
                )}


                {/* 4. FOOTER BUTTON */}
                <div className="pt-2 text-center z-30 min-h-[60px] flex items-end justify-center">
                    {/* STANDARD & WAGER SUBMISSION */}
                    {isActionPhase && !hasSubmitted && (
                        <SketchButton
                            variant="primary"
                            disabled={!answerInput || (isSubmitting && !isWagerPhase) || (!isWagerPhase && !selectedBet)}
                            onClick={isWagerPhase ? submitWagerPrediction : submitPrediction}
                            className={`w-full text-lg py-3 shadow-sketch-lg ${isWagerPhase ? "bg-pop-red text-white border-black" : ""}`}
                        >
                            {isSubmitting ? t.sending : (isWagerPhase ? t.lockInFinal : t.lockInBet)}
                        </SketchButton>
                    )}

                    {isActionPhase && hasSubmitted && (
                        <div className="w-full text-gray-500 font-bold bg-white/80 py-3 rounded-lg backdrop-blur-sm animate-pulse border-2 border-dashed border-gray-300">
                            {t.waitingForOthers}
                        </div>
                    )}

                    {/* Host Controls for Preview -> Reveal */}
                    {(isPreview && isHost) && (
                        <SketchButton
                            variant="primary"
                            onClick={handleReveal}
                            className={`w-full text-lg py-3 shadow-sketch-lg bg-pop-blue border-black text-white ${(isWagerReveal) ? 'hidden' : ''}`}
                        >
                            {t.startJudging} <span className="material-symbols-outlined ml-2">gavel</span>
                        </SketchButton>
                    )}

                    {phase === GamePhase.WAGER_QUESTION && isHost && players.every(p => !!p.currentAnswer) && (
                        <SketchButton
                            variant="primary"
                            onClick={handleWagerReveal}
                            className="w-full text-lg py-3 shadow-sketch-lg bg-pop-blue border-black text-white"
                        >
                            {t.revealFinal} <span className="material-symbols-outlined ml-2">visibility</span>
                        </SketchButton>
                    )}


                    {isReveal && isHost && (
                        <div className="w-full flex flex-col gap-2">
                            <div className="text-sm font-bold bg-white/80 py-1 rounded-full text-gray-600 mb-1 animate-bounce">
                                {t.targetCorrect}
                            </div>
                            <SketchButton
                                variant="secondary"
                                onClick={handleNextPhase}
                                className="w-full text-lg py-3"
                            >
                                {t.nextRound} <span className="material-symbols-outlined ml-2">check_circle</span>
                            </SketchButton>
                        </div>
                    )}

                    {isWagerReveal && isHost && (
                        <div className="w-full flex flex-col gap-2">
                            <div className="text-sm font-bold bg-white/80 py-1 rounded-full text-gray-600 mb-1 animate-bounce">
                                {t.judgeFinal}
                            </div>
                            <SketchButton
                                variant="secondary"
                                onClick={handleEndGame}
                                className="w-full text-lg py-3 bg-black text-white border-pop-yellow"
                            >
                                {t.finishGame} <span className="material-symbols-outlined ml-2">emoji_events</span>
                            </SketchButton>
                        </div>
                    )}


                    {(isReveal || isWagerReveal) && !isHost && (
                        <div className="text-gray-500 font-bold bg-white/80 py-2 rounded-lg backdrop-blur-sm">
                            {t.hostJudging}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};
