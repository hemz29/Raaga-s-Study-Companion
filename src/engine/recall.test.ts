import { describe, expect, it } from 'vitest';
import type { Subject, Takeaway } from '../types';
import { dueTakeaways, looksRight, makeCloze, recallScore, schedule, selectRecall } from './recall';

const tk = (o: Partial<Takeaway>): Takeaway => ({
  id: 't', blockId: 'b', subjectId: 'history', date: '2026-10-01', text: 'x',
  intervalStep: 0, nextDue: '2026-10-02', history: [], ...o,
});

describe('fill-in-the-blank', () => {
  it('blanks the year first', () => {
    expect(makeCloze('The Battle of Plassey was fought in 1757')).toEqual({ prompt: 'The Battle of Plassey was fought in _____', answer: '1757' });
  });
  it('keeps BC with the year', () => {
    expect(makeCloze('Chandragupta founded the empire in 321 BC.')?.answer).toBe('321 BC');
  });
  it('falls back to the longest proper name', () => {
    expect(makeCloze('The capital of the empire was Pataliputra on the Ganga')?.answer).toBe('Pataliputra');
  });
  it('returns null when there is no anchor', () => {
    expect(makeCloze('plants make food because of sunlight')).toBeNull();
  });
});

describe('spaced scheduler', () => {
  it('advances 1 -> 3 -> 7 -> 21 days on got it', () => {
    let t = tk({});
    t = schedule(t, 'got', '2026-10-02');
    expect(t.nextDue).toBe('2026-10-05');
    t = schedule(t, 'got', '2026-10-05');
    expect(t.nextDue).toBe('2026-10-12');
    t = schedule(t, 'got', '2026-10-12');
    expect(t.nextDue).toBe('2026-11-02');
    t = schedule(t, 'got', '2026-11-02');
    expect(t.nextDue).toBeNull();
  });
  it('resets to next day on a miss', () => {
    const t = schedule(tk({ intervalStep: 2 }), 'missed', '2026-10-10');
    expect(t.intervalStep).toBe(0);
    expect(t.nextDue).toBe('2026-10-11');
  });
  it('repeats the same interval on nearly', () => {
    const t = schedule(tk({ intervalStep: 1 }), 'nearly', '2026-10-10');
    expect(t.nextDue).toBe('2026-10-13');
  });
});

describe('recall selection', () => {
  const subjects = [{ id: 'history', kind: 'memory' }, { id: 'physics', kind: 'science' }] as Subject[];
  it('only picks due items from before today', () => {
    const all = [tk({ id: 'a' }), tk({ id: 'b', date: '2026-10-05', nextDue: '2026-10-05' }), tk({ id: 'c', nextDue: '2026-10-09' })];
    expect(dueTakeaways(all, '2026-10-05').map((t) => t.id)).toEqual(['a']);
  });
  it('caps at 5 questions', () => {
    const all = Array.from({ length: 12 }, (_, i) => tk({ id: `t${i}`, subjectId: i % 2 ? 'history' : 'physics' }));
    expect(selectRecall(all, subjects, '2026-10-05')).toHaveLength(5);
  });
  it('scores got/nearly/missed', () => {
    expect(recallScore([{ rating: 'got' }, { rating: 'nearly' }, { rating: 'missed' }, { rating: 'got' }] as never)).toBe(0.625);
  });
  it('lenient answer hint', () => {
    expect(looksRight('plassey', 'Plassey')).toBe(true);
    expect(looksRight('1756', '1757')).toBe(false);
  });
});
