import type { Chapter, DateKey, Plan, PlannedBlock, Subject } from '../types';
import { config } from '../config';
import { addDays, diffDays, range, weekday } from './dates';

export const REVIEW_SUBJECT_ID = '__review__';
const LANGUAGE_DAYS = new Set([1, 3, 5]); // Tue, Thu, Sat: about 3 light language touches a week
const SUNDAY = 6;
const MAX_HORIZON_DAYS = 70;

let counter = 0;
export function uid(prefix = 'id'): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function chapterQueue(s: Subject): Chapter[] {
  const rank = { in: 0, probably: 1, out: 2 } as const;
  return s.chapters
    .filter((c) => c.portionStatus !== 'out' && c.doneDates.length === 0 && !c.manualDate)
    .sort((a, b) => rank[a.portionStatus] - rank[b.portionStatus] || a.number - b.number);
}

export function earliestTestDate(subjects: Subject[], globalTestDate?: DateKey): DateKey | undefined {
  const dates = [globalTestDate, ...subjects.map((s) => s.testDate)].filter(Boolean) as DateKey[];
  return dates.sort()[0];
}

export function horizon(start: DateKey, subjects: Subject[], globalTestDate?: DateKey): DateKey[] {
  const test = earliestTestDate(subjects, globalTestDate);
  let days = 7; // "plan for the week" when no test date exists
  if (test && test > start) days = Math.min(MAX_HORIZON_DAYS, diffDays(test, start));
  return range(start, Math.max(1, days));
}

interface QueueItem { subjectId: string; chapterId?: string; type: PlannedBlock['type']; minutes: number }

/**
 * Proposes a day-by-day plan from in-portion (then "probably") chapters.
 * Manual blocks and chapters with a manualDate are kept where Raaga put them.
 */
export function autoSpread(subjects: Subject[], plan: Plan, start: DateKey): Plan {
  const b = config.blocks;
  const days = horizon(start, subjects, plan.globalTestDate);
  const out: Record<DateKey, PlannedBlock[]> = {};

  // keep the past untouched, keep manual blocks in the horizon
  for (const [d, blocks] of Object.entries(plan.days)) {
    if (d < start) out[d] = blocks;
    else {
      const manual = blocks.filter((x) => x.manual);
      if (manual.length) out[d] = manual;
    }
  }
  const dayList = (d: DateKey) => (out[d] ??= []);

  // pinned chapters (manualDate) that lost their block get it back
  for (const s of subjects) for (const c of s.chapters) {
    if (c.manualDate && c.manualDate >= start && c.portionStatus !== 'out') {
      const list = dayList(c.manualDate);
      if (!list.some((x) => x.chapterId === c.id)) {
        list.push({ id: uid('pb'), subjectId: s.id, chapterId: c.id, type: 'learn', minutes: b.focusMinutes, manual: true });
      }
    }
  }

  const maths = subjects.filter((s) => s.kind === 'maths');
  const languages = subjects.filter((s) => s.kind === 'language');
  const rotating = subjects.filter((s) => s.kind === 'memory' || s.kind === 'science' || s.kind === 'other');

  // per-subject learn queues (heavier chapters get extra blocks)
  const learnQ = new Map<string, QueueItem[]>();
  for (const s of [...rotating, ...languages]) {
    const items: QueueItem[] = [];
    for (const c of chapterQueue(s)) {
      for (let i = 0; i < Math.max(1, c.weight); i++) {
        items.push({ subjectId: s.id, chapterId: c.id, type: 'learn', minutes: s.kind === 'language' ? b.shortBlockMinutes + 5 : b.focusMinutes });
      }
    }
    learnQ.set(s.id, items);
  }
  const mathsQ: QueueItem[] = [];
  for (const s of maths) for (const c of chapterQueue(s)) {
    mathsQ.push({ subjectId: s.id, chapterId: c.id, type: 'learn', minutes: b.focusMinutes });
    for (let i = 0; i < Math.max(1, c.weight); i++) mathsQ.push({ subjectId: s.id, chapterId: c.id, type: 'practice', minutes: b.mathsPracticeMinutes });
  }

  const revisions: { due: DateKey; item: QueueItem }[] = [];
  const lastPlanned = new Map<string, number>();
  let langTurn = 0;

  days.forEach((d, dayIdx) => {
    const list = dayList(d);
    const cap = () => b.maxPerDay - list.length;
    const has = (subjectId: string) => list.some((x) => x.subjectId === subjectId);
    const push = (q: QueueItem) => {
      list.push({ id: uid('pb'), ...q });
      lastPlanned.set(q.subjectId, dayIdx);
    };

    if (weekday(d) === SUNDAY) {
      if (cap() > 0 && !has(REVIEW_SUBJECT_ID)) push({ subjectId: REVIEW_SUBJECT_ID, type: 'boss', minutes: b.focusMinutes });
      return;
    }

    // 1. Maths every day
    if (maths.length && cap() > 0 && !list.some((x) => maths.some((m) => m.id === x.subjectId))) {
      push(mathsQ.shift() ?? { subjectId: maths[0].id, type: 'practice', minutes: b.mathsPracticeMinutes });
    }
    // 2. Short memory revision touches that are due
    revisions.sort((x, y) => (x.due < y.due ? -1 : 1));
    for (const r of [...revisions]) {
      if (cap() <= 0) break;
      if (r.due <= d && !has(r.item.subjectId)) {
        push(r.item);
        revisions.splice(revisions.indexOf(r), 1);
      }
    }
    // 3. Light language touch
    if (LANGUAGE_DAYS.has(weekday(d)) && languages.length && cap() > 0) {
      for (let i = 0; i < languages.length; i++) {
        const s = languages[(langTurn + i) % languages.length];
        const q = learnQ.get(s.id)!;
        if (q.length) { push(q.shift()!); langTurn = (langTurn + i + 1) % languages.length; break; }
      }
    }
    // 4. Rotate the remaining subjects, least recently planned first
    while (cap() > 0) {
      const candidates = rotating
        .filter((s) => learnQ.get(s.id)!.length && !has(s.id))
        .sort((x, y) => (lastPlanned.get(x.id) ?? -99) - (lastPlanned.get(y.id) ?? -99));
      const s = candidates[0];
      if (!s) break;
      const item = learnQ.get(s.id)!.shift()!;
      push(item);
      if (s.kind === 'memory') {
        revisions.push({ due: addDays(d, 2), item: { ...item, type: 'revise', minutes: b.shortBlockMinutes } });
        revisions.push({ due: addDays(d, 6), item: { ...item, type: 'revise', minutes: b.shortBlockMinutes } });
      }
    }
  });

  for (const d of Object.keys(out)) if (!out[d].length) delete out[d];
  return { ...plan, generatedAt: new Date().toISOString(), days: out };
}

export function isOverPlanned(blocks: PlannedBlock[]): boolean {
  return blocks.length > config.blocks.maxPerDay;
}

/** Move a block to another day; learn blocks pin their chapter to that day. */
export function moveBlock(plan: Plan, subjects: Subject[], blockId: string, from: DateKey, to: DateKey): { plan: Plan; subjects: Subject[] } {
  const src = plan.days[from] ?? [];
  const blk = src.find((x) => x.id === blockId);
  if (!blk || from === to) return { plan, subjects };
  const moved = { ...blk, manual: true };
  const days = { ...plan.days, [from]: src.filter((x) => x.id !== blockId), [to]: [...(plan.days[to] ?? []), moved] };
  if (!days[from].length) delete days[from];
  const newSubjects = blk.type === 'learn' && blk.chapterId
    ? subjects.map((s) => ({ ...s, chapters: s.chapters.map((c) => (c.id === blk.chapterId ? { ...c, manualDate: to } : c)) }))
    : subjects;
  return { plan: { ...plan, days }, subjects: newSubjects };
}
