import { describe, expect, it } from 'vitest';
import { consistency, moodFor, stageFor, stageProgress } from './creature';

describe('creature stages', () => {
  it('hatches after 2 gated blocks even below 30 GP', () => {
    expect(stageFor(20, 1)).toBe('egg');
    expect(stageFor(20, 2)).toBe('hatchling');
  });
  it('evolves on GP thresholds', () => {
    expect(stageFor(400, 40)).toBe('juvenile');
    expect(stageFor(1700, 170)).toBe('mythic');
  });
  it('progress between stages', () => {
    expect(stageProgress(600, 'juvenile')).toBeCloseTo(0.5);
  });
});

describe('5 of 7 consistency window', () => {
  const start = '2026-09-01';
  it('ok with 5 active days out of the last 7', () => {
    const active = new Set(['2026-10-01', '2026-10-02', '2026-10-04', '2026-10-05', '2026-10-06']);
    const c = consistency('2026-10-08', active, new Set(), start);
    expect(c.window).toHaveLength(7);
    expect(c.active).toBe(5);
    expect(c.ok).toBe(true);
  });
  it('sleepy below 5', () => {
    const active = new Set(['2026-10-01', '2026-10-05']);
    expect(consistency('2026-10-08', active, new Set(), start).ok).toBe(false);
  });
  it('does not count today against her before she studies', () => {
    const active = new Set(['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06']);
    const c = consistency('2026-10-08', active, new Set(), start);
    expect(c.window[6].date).toBe('2026-10-07');
  });
  it('skips paused days (frozen window)', () => {
    const active = new Set(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']);
    const paused = new Set(['2026-10-06', '2026-10-07']);
    expect(consistency('2026-10-08', active, paused, start).ok).toBe(true);
  });
  it('is forgiving for a brand-new start', () => {
    expect(consistency('2026-10-02', new Set(), new Set(), '2026-10-01').ok).toBe(true);
  });
  it('mood never goes below sleepy', () => {
    expect(moodFor({ paused: false, consistencyOk: false, unsentReport: false, studiedToday: false, active: 0 })).toBe('sleepy');
    expect(moodFor({ paused: true, consistencyOk: false, unsentReport: true, studiedToday: false, active: 0 })).toBe('paused');
  });
});
