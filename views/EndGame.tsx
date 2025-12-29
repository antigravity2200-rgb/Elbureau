import React from 'react';
import { GameState } from '../types';
import { TRANSLATIONS } from '../constants';
import { SketchCard } from '../components/SketchCard';
import { SketchButton } from '../components/SketchButton';
import { Avatar } from '../components/Avatar';

interface EndGameProps {
  gameState: GameState;
  onReset: () => void;
  isHost: boolean;
}

export const EndGame: React.FC<EndGameProps> = ({ gameState, onReset, isHost }) => {
  const t = TRANSLATIONS[gameState.config.language];
  const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
  const winner = sortedPlayers[0];
  const runnerUps = sortedPlayers.slice(1);

  return (
    <div className="flex flex-col h-full w-full justify-center items-center py-6 px-4 relative overflow-hidden">
      {/* Background Decors */}
      <div className="fixed top-20 right-10 text-primary/20 transform rotate-45 -z-10 pointer-events-none animate-pulse">
        <span className="material-symbols-outlined text-[180px]">emoji_events</span>
      </div>
      <div className="fixed bottom-10 left-10 text-red-400/10 transform -rotate-12 -z-10 pointer-events-none">
        <span className="material-symbols-outlined text-[160px]">celebration</span>
      </div>

      <div className="flex-none mb-6 text-center transform -rotate-2">
        <h2 className="font-display font-black text-6xl text-text-main dark:text-white drop-shadow-sm">{t.gameOver}</h2>
      </div>

      <div className="flex-1 w-full flex flex-col items-center justify-start min-h-0 gap-6 max-w-md mx-auto overflow-y-auto no-scrollbar pb-20">

        {/* Winner Card */}
        <div className="relative w-full pt-8">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 text-6xl z-20 animate-bounce">👑</div>
          <SketchCard className="w-full bg-primary flex flex-col items-center p-6 border-[4px] border-text-main rotate-1 relative z-10" noPadding>
            <div className="w-full flex flex-col items-center gap-2 mb-4">
              <Avatar size="lg" className={`bg-${winner?.avatarColor}-100 border-4 border-white shadow-sm scale-110`} />
              <h3 className="text-3xl font-black text-text-main uppercase tracking-tight">{winner?.name}</h3>
            </div>
            <div className="bg-white border-2 border-text-main rounded-xl px-6 py-2 shadow-sketch-sm -rotate-1">
              <p className="text-4xl font-display font-black text-text-main">{winner?.score} <span className="text-sm font-bold opacity-50">PTS</span></p>
            </div>
          </SketchCard>
        </div>

        {/* Runner Ups */}
        <div className="w-full space-y-3">
          {runnerUps.map((p, idx) => (
            <div key={p.id} className="flex justify-between items-center p-3 bg-white dark:bg-white/10 border-2 border-text-main dark:border-white rounded-xl shadow-sketch-sm transform hover:-translate-y-1 transition-transform">
              <div className="flex items-center gap-4">
                <span className="font-display font-black text-xl w-8 text-text-main dark:text-gray-400">#{idx + 2}</span>
                <Avatar size="sm" className={`bg-${p.avatarColor}-100`} />
                <span className="font-bold text-lg truncate max-w-[120px] dark:text-white">{p.name}</span>
              </div>
              <span className="font-display font-black text-xl dark:text-white">{p.score} <span className="text-xs opacity-50">PTS</span></span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Action */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background-light from-80% to-transparent dark:from-background-dark z-30 pointer-events-none">
        <div className="max-w-md mx-auto pointer-events-auto">
          {isHost ? (
            <SketchButton onClick={onReset} variant="primary" fullWidth className="h-16 text-xl shadow-sketch">
              PLAY AGAIN
            </SketchButton>
          ) : (
            <div className="bg-white dark:bg-white/10 border-2 border-text-main dark:border-white rounded-xl p-4 text-center shadow-sketch animate-pulse">
              <p className="font-bold uppercase tracking-widest text-text-main dark:text-white text-sm">Waiting for Host...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};