import React from 'react';
import { SketchCard } from './SketchCard';
import { SketchButton } from './SketchButton';
import { SketchInput } from './SketchInput';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  playerName: string;
  setPlayerName: (name: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  setApiKey,
  language,
  setLanguage,
  playerName,
  setPlayerName,
}) => {
  if (!isOpen) return null;

  const t = TRANSLATIONS[language];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/20 backdrop-blur-sm animate-pop-in">
      <div className="w-full max-w-md">
        <SketchCard className="w-full bg-white shadow-sketch-hover" noPadding>
          <div className="flex justify-between items-center p-4 border-b-3 border-ink bg-gray-50">
            <h2 className="font-sketch text-2xl font-bold">{t.settings}</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center font-bold text-xl hover:text-pop-red">✕</button>
          </div>

          <div className="p-6 space-y-6">
            {/* Language */}
            <div className="space-y-2">
              <label className="font-sketch text-lg font-bold block">{t.language}</label>
              <div className="flex rounded-lg border-2 border-ink overflow-hidden">
                {Object.values(Language).map((lang, idx) => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={`
                      flex-1 py-2 font-bold font-sketch text-lg transition-colors
                      ${language === lang ? 'bg-pop-yellow' : 'bg-white hover:bg-gray-100'}
                      ${idx !== 2 ? 'border-r-2 border-ink' : ''}
                    `}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Player Name */}
            <SketchInput
              label={t.playerName}
              placeholder="Guest"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
            />

            {/* API Key */}
            <div>
              <SketchInput
                label={t.enterApiKey}
                type="password"
                placeholder="AIza..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">{t.apiKeyDesc}</p>
            </div>

            <div className="pt-2">
              <SketchButton fullWidth onClick={onClose} variant="primary">
                {t.save}
              </SketchButton>
            </div>
          </div>
        </SketchCard>
      </div>
    </div>
  );
};