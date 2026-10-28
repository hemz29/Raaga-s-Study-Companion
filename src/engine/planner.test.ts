import { describe, expect, it } from 'vitest';
import type { Subject } from '../types';
import { autoSpread, moveBlock, REVIEW_SUBJECT_ID } from './planner';
import { weekday } from './dates';

const mk = (id: string, kind: Subject['kind'], n: number, status: 'in' | 'out' = 'in'): Subject => ({
  id, name: id, kind, color: '#000',
  chapters: Array.from({ length: n }, (_, i) => ({ id: `${id}-${i + 1}`, subjectId: id, number: i + 1, title: `C${i + 1}`, weight: 1, portionStatus: status, doneDates: [] })),
});
const subjects = [mk('maths', 'maths', 5), mk('history', 'memory', 4), mk('physics', 'science', 3), mk('english', 'language', 3), mk('geo', 'memory', 3, 'out')];
const start = '2026-11-02'; // a Monday

describe('auto-spread planner', () => {
  const plan = autoSpread(subjects, { days: {} }, start);
  const days = Object.keys(plan.days).sort();
  it('plans a week when there is no test date', () => {
    expect(days[0]).toBe(start);
    expect(days.at(-1)).toBe('2026-11-08');
  });
  it('never plans more than 3 blocks a day', () => {
    for (const d of days) expect(plan.days[d].length).toBeLessThanOrEqual(3);
  });
  it('has maths every weekday and a boss fight on Sunday', () => {
    for (const d of days) {
      if (weekday(d) === 6) expect(plan.days[d][0].subjectId).toBe(REVIEW_SUBJECT_ID);
      else expect(plan.days[d].some((b) => b.subjectId === 'maths')).toBe(true);
    }
  });
  it('skips chapters not in portion', () => {
    expect(days.flatMap((d) => plan.days[d]).some((b) => b.subjectId === 'geo')).toBe(false);
  });
  it('adds short revision touches for memory subjects', () => {
    expect(days.flatMap((d) => plan.days[d]).some((b) => b.subjectId === 'history' && b.type === 'revise')).toBe(true);
  });
  it('keeps manually moved chapters on re-spread', () => {
    const tue = plan.days['2026-11-03'];
    const learn = days.flatMap((d) => plan.days[d].map((b) => ({ d, b }))).find((x) => x.b.type === 'learn' && x.b.subjectId === 'physics')!;
    const moved = moveBlock(plan, subjects, learn.b.id, learn.d, '2026-11-06');
    const again = autoSpread(moved.subjects, moved.plan, start);
    expect(again.days['2026-11-06'].some((b) => b.chapterId === learn.b.chapterId && b.manual)).toBe(true);
    expect(tue).toBeDefined();
  });
  it('spreads to the test date when one is set', () => {
    const p = autoSpread(subjects, { days: {}, globalTestDate: '2026-11-20' }, start);
    expect(Object.keys(p.days).sort().at(-1)! < '2026-11-20').toBe(true);
    expect(Object.keys(p.days).length).toBeGreaterThan(7);
  });
});
