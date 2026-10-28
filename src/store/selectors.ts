import type { AppState, DateKey, Mood, Subject } from '../types';
import { config } from '../config';
import { consistency, moodFor } from '../engine/creature';
import { playBalance, spentOn } from '../engine/rewards';
import { addDays, diffDays, weekStart } from '../engine/dates';
import { REVIEW_SUBJECT_ID, earliestTestDate } from '../engine/planner';
import { dueTakeaways } from '../engine/recall';

export const REVIEW_SUBJECT: Subject = { id: REVIEW_SUBJECT_ID, name: 'Boss fight: weekly review', kind: 'memory', color: '#8e6bd8', chapters: [] };

export function subjectById(s: AppState, id: string): Subject | undefined {
  return id === REVIEW_SUBJECT_ID ? REVIEW_SUBJECT : s.subjects.find((x) => x.id === id);
}

export function chapterTitle(s: AppState, chapterId?: string): string | undefined {
  if (!chapterId) return undefined;
  for (const sub of s.subjects) {
    const c = sub.chapters.find((x) => x.id === chapterId);
    if (c) return c.title;
  }
  return undefined;
}

export function activeDays(s: AppState): Set<DateKey> {
  return new Set(Object.values(s.blocks).filter((b) => b.completedGate).map((b) => b.date));
}

export function consistencyFor(s: AppState, today: DateKey) {
  const start = s.profile?.createdAt.slice(0, 10) ?? today;
  return consistency(today, activeDays(s), new Set(s.settings.pausedDays), start);
}

/** Most recent past study day whose report was never sent. */
export function unsentReportDay(s: AppState, today: DateKey): DateKey | undefined {
  const days = Object.values(s.sessions)
    .filter((x) => x.date < today && x.blockIds.length > 0)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const last = days[0];
  return last && !last.reportSent && diffDays(today, last.date) <= 3 ? last.date : undefined;
}

export function moodOf(s: AppState, today: DateKey): Mood {
  const c = consistencyFor(s, today);
  return moodFor({
    paused: s.settings.paused,
    consistencyOk: c.ok,
    unsentReport: !!unsentReportDay(s, today),
    studiedToday: activeDays(s).has(today),
    active: c.active,
  });
}

export const MOOD_LABEL: Record<Mood, string> = {
  paused: 'peacefully asleep',
  sleepy: 'a bit sleepy',
  content: 'content',
  happy: 'happy',
  radiant: 'very happy',
};

export interface GateStatus {
  blocksDone: number;
  recallDue: boolean;
  recallDone: boolean;
  passed: boolean;
  reasons: string[];
}

export function gateStatus(s: AppState, today: DateKey): GateStatus {
  const session = s.sessions[today];
  const blocksDone = session ? session.blockIds.filter((id) => s.blocks[id]?.completedGate).length : 0;
  const recallDue = !!session?.recall?.length || (!session?.recallDone && dueTakeaways(Object.values(s.takeaways), today).length > 0);
  const recallDone = !!session?.recallDone;
  const reasons: string[] = [];
  if (blocksDone === 0) reasons.push('Finish and log at least one study block');
  if (recallDue && !recallDone) reasons.push("Do today's recall quiz");
  if (s.activeBlock?.phase === 'log') reasons.push('Finish logging your current block');
  return { blocksDone, recallDue, recallDone, passed: reasons.length === 0, reasons };
}

export function balanceOf(s: AppState, today: DateKey): number {
  return playBalance(s.ledger, today);
}

export function playUsedToday(s: AppState, today: DateKey): number {
  return spentOn(s.ledger, today);
}

export function lightTokenAvailable(s: AppState, today: DateKey): boolean {
  if (s.lightTokens[weekStart(today)]) return false;
  if (isExamWeek(s, today) && s.settings.examWeekLightDay === 'off') return false;
  return true;
}

export function lightDayMinutes(s: AppState, today: DateKey): number {
  return isExamWeek(s, today) && s.settings.examWeekLightDay === 'half' ? config.blocks.halfBlockMinutes : config.blocks.lightDayMinutes;
}

export function isExamWeek(s: AppState, today: DateKey): boolean {
  const t = earliestTestDate(s.subjects.filter((x) => x.testDate && x.testDate >= today), s.plan.globalTestDate && s.plan.globalTestDate >= today ? s.plan.globalTestDate : undefined);
  return !!t && diffDays(t, today) <= 7;
}

export function daysToTest(s: AppState, today: DateKey): number | undefined {
  const future = [s.plan.globalTestDate, ...s.subjects.map((x) => x.testDate)].filter((d): d is string => !!d && d >= today).sort();
  return future[0] ? diffDays(future[0], today) : undefined;
}

export function totalGatedBlocks(s: AppState): number {
  return Object.values(s.blocks).filter((b) => b.completedGate).length;
}

export function tomorrowRecallTopics(s: AppState, today: DateKey): string[] {
  const tomorrow = addDays(today, 1);
  const due = Object.values(s.takeaways).filter((t) => t.nextDue && t.nextDue <= tomorrow);
  const topics = due.map((t) => chapterTitle(s, t.chapterId) ?? subjectById(s, t.subjectId)?.name ?? '');
  return [...new Set(topics.filter(Boolean))].slice(0, 4);
}
