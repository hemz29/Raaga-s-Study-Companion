export type DateKey = string; // YYYY-MM-DD in local time

export type WorldId = 'emberwick' | 'lumenwood' | 'drift';
export type SubjectKind = 'maths' | 'memory' | 'science' | 'language' | 'other';
export type PortionStatus = 'in' | 'probably' | 'out';
export type BlockType = 'learn' | 'practice' | 'revise' | 'boss';
export type StageId = 'egg' | 'hatchling' | 'juvenile' | 'teen' | 'adult' | 'mythic';
export type RecallRating = 'got' | 'nearly' | 'missed';
export type Mood = 'paused' | 'sleepy' | 'content' | 'happy' | 'radiant';

export interface Chapter {
  id: string;
  subjectId: string;
  number: number;
  title: string;
  weight: number; // 1 = normal, 2 = heavy/long chapter
  portionStatus: PortionStatus;
  manualDate?: DateKey; // set when Raaga drags a chapter's learn block to a day; survives re-spread
  doneDates: DateKey[];
}

export interface Subject {
  id: string;
  name: string;
  kind: SubjectKind;
  color: string;
  testDate?: DateKey;
  chapters: Chapter[];
}

export interface PlannedBlock {
  id: string;
  subjectId: string;
  chapterId?: string;
  type: BlockType;
  minutes: number;
  manual?: boolean; // placed or moved by Raaga; kept on re-spread
}

export interface Plan {
  generatedAt?: string;
  globalTestDate?: DateKey;
  days: Record<DateKey, PlannedBlock[]>;
}

export interface Takeaway {
  id: string;
  blockId: string;
  subjectId: string;
  chapterId?: string;
  date: DateKey;
  text: string;
  ownQuestion?: string;
  ownAnswer?: string;
  intervalStep: number;
  nextDue: DateKey | null; // null = mastered
  history: { date: DateKey; rating: RecallRating }[];
}

export interface BlockLog {
  id: string;
  date: DateKey;
  subjectId: string;
  chapterId?: string;
  type: BlockType;
  startedAt: string;
  minutes: number;
  takeawayIds: string[];
  exerciseTypes: string[];
  exerciseNote?: string;
  completedGate: boolean;
  extra: boolean; // beyond the day's plan
}

export interface Mistake {
  id: string;
  date: DateKey;
  subjectId: string;
  category: string;
  note: string;
}

export interface RecallItem {
  takeawayId: string;
  prompt: string;
  answer: string;
  kind: 'own' | 'cloze' | 'free';
  rating?: RecallRating;
}

export interface DaySession {
  date: DateKey;
  selected: PlannedBlock[]; // what she chose at launch (up to 3)
  blockIds: string[];
  lightDay: boolean;
  recall?: RecallItem[];
  recallDone: boolean;
  reportSent: boolean;
  reportNote?: string;
  briefingsDone: number;
  swaps: { from: string; to: string }[];
  playEarned: number;
  gpEarned: number;
}

export interface Creature {
  name?: string;
  gp: number;
  stage: StageId;
  traits: Record<string, number>;
  hatchedAt?: string;
  cosmetics: string[];
  customArt: Partial<Record<StageId, string>>; // image ids in the images store
  pendingCelebration?: 'hatch' | StageId;
}

export interface LedgerEntry {
  date: DateKey;
  minutes: number; // positive = earned, negative = spent
  reason: string;
}

export interface ActiveBlock {
  planned: PlannedBlock;
  phase: 'briefing' | 'focus' | 'log' | 'break';
  startedAt: number; // epoch ms of focus start
  pausedAt?: number;
  pausedMs: number;
  breakStartedAt?: number;
  extra: boolean;
}

export interface Settings {
  muted: boolean;
  parentPinHash?: string;
  paused: boolean;
  pausedDays: DateKey[];
  examWeekLightDay: 'normal' | 'half' | 'off';
  chaptersReviewed: boolean;
}

export interface Profile {
  name: string;
  world: WorldId;
  createdAt: string;
}

export interface GalleryItem {
  id: string;
  createdAt: string;
  pinned: boolean;
}

export interface AppState {
  version: 1;
  profile?: Profile;
  subjects: Subject[];
  plan: Plan;
  sessions: Record<DateKey, DaySession>;
  blocks: Record<string, BlockLog>;
  takeaways: Record<string, Takeaway>;
  mistakes: Mistake[];
  creature: Creature;
  ledger: LedgerEntry[];
  settings: Settings;
  lightTokens: Record<DateKey, DateKey>; // weekStart -> date used
  weekBonusesGiven: DateKey[]; // weekStarts already rewarded for unused token
  swapStreak: Record<string, number>;
  gallery: GalleryItem[];
  activeBlock?: ActiveBlock;
}
