import type { DateKey, LedgerEntry } from '../types';
import { config } from '../config';
import { diffDays } from './dates';

export interface DayPlayInput {
  plannedCount: number;
  gatedPlanned: number; // gated blocks counting toward the plan
  extraBlocks: number; // gated blocks beyond the plan
  validMistakes: number;
  recallScore: number | null; // null = no recall today
  gatePassed: boolean;
}

export interface PlayPart { label: string; minutes: number }

export function computeDayPlay(i: DayPlayInput): { total: number; parts: PlayPart[] } {
  const p = config.playTime;
  const parts: PlayPart[] = [];
  if (!i.gatePassed) return { total: 0, parts };
  if (i.plannedCount > 0 && i.gatedPlanned >= i.plannedCount) parts.push({ label: "Finished today's plan", minutes: p.baseMinutes });
  const extra = Math.min(i.extraBlocks, p.maxExtraBlocksPerDay);
  if (extra > 0) parts.push({ label: 'Bonus block', minutes: extra * p.extraBlockMinutes });
  const m = Math.min(i.validMistakes, p.maxMistakeBonusesPerDay);
  if (m > 0) parts.push({ label: `Caught ${m} of your own mistake${m > 1 ? 's' : ''}`, minutes: m * p.mistakeMinutes });
  if (i.recallScore !== null) {
    if (i.recallScore >= p.recallStrongThreshold) parts.push({ label: 'Super-strong recall', minutes: p.recallStrongMinutes });
    else if (i.recallScore >= p.recallGoodThreshold) parts.push({ label: 'Good recall', minutes: p.recallGoodMinutes });
  }
  let total = parts.reduce((a, x) => a + x.minutes, 0);
  if (total > p.dailyCeilingMinutes) total = p.dailyCeilingMinutes;
  return { total, parts };
}

/**
 * Play-time balance with expiry: minutes earned on day D can be spent on D..D+carryOverDays.
 * Spending uses the oldest minutes first.
 */
export function playBalance(ledger: LedgerEntry[], today: DateKey, carry = config.playTime.carryOverDays): number {
  const sorted = [...ledger].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : b.minutes - a.minutes));
  const buckets: { date: DateKey; left: number }[] = [];
  for (const e of sorted) {
    if (e.date > today) continue;
    if (e.minutes > 0) buckets.push({ date: e.date, left: e.minutes });
    else {
      let need = -e.minutes;
      for (const b of buckets) {
        if (need <= 0) break;
        if (diffDays(e.date, b.date) > carry) continue;
        const take = Math.min(b.left, need);
        b.left -= take;
        need -= take;
      }
    }
  }
  return buckets.filter((b) => diffDays(today, b.date) <= carry).reduce((a, b) => a + b.left, 0);
}

export function earnedOn(ledger: LedgerEntry[], date: DateKey): number {
  return ledger.filter((e) => e.date === date && e.minutes > 0).reduce((a, e) => a + e.minutes, 0);
}

export function spentOn(ledger: LedgerEntry[], date: DateKey): number {
  return -ledger.filter((e) => e.date === date && e.minutes < 0).reduce((a, e) => a + e.minutes, 0);
}
