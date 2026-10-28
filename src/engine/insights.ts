import type { BlockLog, DateKey, Mistake } from '../types';
import { config } from '../config';
import { addDays } from './dates';

export function mistakeCounts(mistakes: Mistake[], since?: DateKey): { id: string; label: string; icon: string; count: number }[] {
  const list = since ? mistakes.filter((m) => m.date >= since) : mistakes;
  return config.mistakeCategories
    .map((c) => ({ ...c, count: list.filter((m) => m.category === c.id).length }))
    .sort((a, b) => b.count - a.count);
}

export function topMistake(mistakes: Mistake[], since?: DateKey) {
  const top = mistakeCounts(mistakes, since)[0];
  return top && top.count > 0 ? top : undefined;
}

export function isValidMistakeNote(note: string): boolean {
  return note.trim().split(/\s+/).filter(Boolean).length >= config.gate.minWordsMistakeNote;
}

/** Variety nudge: if the last 4 study days were only "Read the chapter", suggest practice. */
export function varietyNudge(blocks: BlockLog[], today: DateKey): string | undefined {
  const recent = blocks.filter((b) => b.completedGate && b.date < today && b.date >= addDays(today, -6));
  const days = [...new Set(recent.map((b) => b.date))].sort().slice(-4);
  if (days.length < 4) return undefined;
  const onlyReading = days.every((d) =>
    recent.filter((b) => b.date === d).every((b) => b.exerciseTypes.length > 0 && b.exerciseTypes.every((t) => t === 'Read the chapter')));
  if (onlyReading) return "You've read the chapter four days running. Try a practice round today, that's where marks are won!";
  return undefined;
}

/** Subjects swapped out N times in a row (avoidance pattern). */
export function avoidedSubjects(swapStreak: Record<string, number>): string[] {
  return Object.entries(swapStreak).filter(([, n]) => n >= config.swaps.avoidanceThreshold).map(([id]) => id);
}
