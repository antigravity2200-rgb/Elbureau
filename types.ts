export enum GamePhase {
  SETUP = 'SETUP',
  LOBBY = 'LOBBY',
  GENERATING = 'GENERATING',
  BETTING = 'BETTING', // Players pick chips
  ANSWERING = 'ANSWERING', // Players answer
  PREVIEW = 'PREVIEW', // Everyone sees answers before result
  REVEAL = 'REVEAL', // Correct answer shown
  SCORING = 'SCORING',
  WAGER_SETUP = 'WAGER_SETUP',
  WAGER_GENERATING = 'WAGER_GENERATING',
  WAGER_QUESTION = 'WAGER_QUESTION',
  WAGER_REVEAL = 'WAGER_REVEAL',
  ENDGAME = 'ENDGAME',
}

export enum Language {
  EN = 'en',
  FR = 'fr',
  AR = 'ar',
}

export interface Player {
  id: string;
  name: string;
  score: number;
  avatarColor: string;
  isHost: boolean;
  betsAvailable: number[];
  currentBet: number | null;
  currentAnswer: string;
  isCorrect: boolean | null; // Null means not yet validated
  isBot?: boolean;
  wagerAmount?: number;
  wagerDifficulty?: 'easy' | 'medium' | 'hard';
  usedHint?: boolean;
}

export interface Question {
  id: string;
  text: string;
  type: 'open' | 'mc';
  options?: string[]; // For MC
  correctAnswer: string;
  explanation?: string;
  hint?: string;
  category?: string; // Optional topic tag
}

export interface GameConfig {
  theme: string;
  questionCount: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  language: Language;
  // Advanced Settings
  timerSeconds: number; // 0 for infinite
  allowHints: boolean;
  scoringMode: 'standard' | 'punishing'; // standard = 0 for wrong, punishing = -bet for wrong
  questionTypes: 'mixed' | 'mc' | 'open';
}

export interface GameState {
  phase: GamePhase;
  apiKey: string;
  config: GameConfig;
  players: Player[];
  questions: Question[];
  currentQuestionIndex: number;
  finalQuestion?: Question;
  winningDifficulty?: string;
  loadingMessage?: string;
}

export type ThemePreset = {
  id: string;
  label: Record<Language, string>;
  value: string;
};