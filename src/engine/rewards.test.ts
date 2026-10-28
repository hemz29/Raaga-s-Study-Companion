import { describe, expect, it } from 'vitest';
import { computeDayPlay, playBalance } from './rewards';

describe('play-time scale', () => {
  const base = { plannedCount: 3, gatedPlanned: 3, extraBlocks: 0, validMistakes: 0, recallScore: null, gatePassed: true };
  it('gives nothing when the gate is not passed', () => {
    expect(computeDayPlay({ ...base, gatePassed: false }).total).toBe(0);
  });
  it('gives 15 base minutes for finishing the plan', () => {
    expect(computeDayPlay(base).total).toBe(15);
  });
  it('no base for an unfinished plan', () => {
    expect(computeDayPlay({ ...base, gatedPlanned: 2 }).total).toBe(0);
  });
  it('caps bonus blocks and mistakes', () => {
    expect(computeDayPlay({ ...base, extraBlocks: 3, validMistakes: 5 }).total).toBe(15 + 5 + 10);
  });
  it('applies the 40-minute ceiling', () => {
    expect(computeDayPlay({ ...base, extraBlocks: 1, validMistakes: 2, recallScore: 0.9 }).total).toBe(40);
  });
  it('gives a smaller recall bonus for a good score', () => {
    expect(computeDayPlay({ ...base, recallScore: 0.65 }).total).toBe(20);
  });
});

describe('play balance with carry-over', () => {
  it('carries unspent time for one day only', () => {
    const ledger = [{ date: '2026-10-01', minutes: 20, reason: 'earned' }];
    expect(playBalance(ledger, '2026-10-01')).toBe(20);
    expect(playBalance(ledger, '2026-10-02')).toBe(20);
    expect(playBalance(ledger, '2026-10-03')).toBe(0);
  });
  it('spends oldest minutes first', () => {
    const ledger = [
      { date: '2026-10-01', minutes: 20, reason: 'earned' },
      { date: '2026-10-02', minutes: 15, reason: 'earned' },
      { date: '2026-10-02', minutes: -25, reason: 'art' },
    ];
    expect(playBalance(ledger, '2026-10-02')).toBe(10);
    expect(playBalance(ledger, '2026-10-03')).toBe(10);
  });
});
