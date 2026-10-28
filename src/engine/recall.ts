import type { DateKey, RecallItem, RecallRating, Subject, Takeaway } from '../types';
import { config } from '../config';
import { addDays } from './dates';
import { properNouns } from './takeaways';

const BLANK = '_____';

/** Rule-based fill-in-the-blank: blank a year/number first, then a proper name. */
export function makeCloze(text: string): { prompt: string; answer: string } | null {
  const year = text.match(/\b(\d{3,4})(\s?(BC|BCE|AD|CE))?\b/);
  const num = year ?? text.match(/\b\d+(\.\d+)?\b/);
  if (num && num.index !== undefined) {
    const answer = num[0];
    return { prompt: text.slice(0, num.index) + BLANK + text.slice(num.index + answer.length), answer };
  }
  const names = properNouns(text);
  if (names.length) {
    // prefer the longest name (more specific)
    const answer = [...names].sort((a, b) => b.length - a.length)[0];
    const idx = text.indexOf(answer);
    if (idx >= 0) return { prompt: text.slice(0, idx) + BLANK + text.slice(idx + answer.length), answer };
  }
  return null;
}

export function toRecallItem(t: Takeaway, chapterTitle?: string): RecallItem {
  if (t.ownQuestion && t.ownAnswer) {
    return { takeawayId: t.id, prompt: t.ownQuestion, answer: t.ownAnswer, kind: 'own' };
  }
  const cloze = makeCloze(t.text);
  if (cloze) return { takeawayId: t.id, ...cloze, kind: 'cloze' };
  return {
    takeawayId: t.id,
    prompt: `Recall one key point you noted${chapterTitle ? ` about "${chapterTitle}"` : ''}.`,
    answer: t.text,
    kind: 'free',
  };
}

/** Spaced repetition: next day, +3, +7, +21. Missed resets; nearly repeats the step; got advances. */
export function schedule(t: Takeaway, rating: RecallRating, today: DateKey): Takeaway {
  const intervals = config.recall.intervalsDays;
  let step = t.intervalStep;
  if (rating === 'missed') step = 0;
  else if (rating === 'got') step = step + 1;
  const nextDue = step >= intervals.length ? null : addDays(today, intervals[step]);
  return { ...t, intervalStep: step, nextDue, history: [...t.history, { date: today, rating }] };
}

export function initialDue(date: DateKey): DateKey {
  return addDays(date, config.recall.intervalsDays[0]);
}

export function dueTakeaways(all: Takeaway[], today: DateKey): Takeaway[] {
  return all.filter((t) => t.nextDue !== null && t.nextDue <= today && t.date < today);
}

/**
 * Pick up to maxQuestions due takeaways, weighting memory-heavy subjects and overdue items.
 * Deterministic given the same inputs (seeded by date) so a refresh shows the same quiz.
 */
export function selectRecall(all: Takeaway[], subjects: Subject[], today: DateKey): Takeaway[] {
  const due = dueTakeaways(all, today);
  const kindOf = new Map(subjects.map((s) => [s.id, s.kind]));
  let seed = [...today].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const scored = due.map((t) => {
    const overdue = t.nextDue ? Math.max(0, (Date.parse(today) - Date.parse(t.nextDue)) / 86400000) : 0;
    const w = (kindOf.get(t.subjectId) === 'memory' ? config.recall.memorySubjectWeight : 1) + overdue * 0.25;
    return { t, score: w * (0.5 + rand()) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, config.recall.maxQuestions).map((s) => s.t);
}

export function recallScore(items: RecallItem[]): number {
  const rated = items.filter((i) => i.rating);
  if (!rated.length) return 0;
  const pts = rated.reduce((a, i) => a + (i.rating === 'got' ? 1 : i.rating === 'nearly' ? 0.5 : 0), 0);
  return pts / rated.length;
}

/** Lenient auto-check used only as a hint; she still self-rates. */
export function looksRight(guess: string, answer: string): boolean {
  const n = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const g = n(guess), a = n(answer);
  return !!g && (g === a || (a.length > 4 && (a.includes(g) || g.includes(a)) && g.length >= a.length * 0.6));
}
