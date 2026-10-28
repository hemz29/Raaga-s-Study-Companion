import type { DateKey } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(k: DateKey): Date {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(now: Date = new Date()): DateKey {
  return toKey(now);
}

export function addDays(k: DateKey, n: number): DateKey {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function diffDays(a: DateKey, b: DateKey): number {
  // a - b in whole days
  return Math.round((fromKey(a).getTime() - fromKey(b).getTime()) / 86400000);
}

/** 0 = Monday ... 6 = Sunday */
export function weekday(k: DateKey): number {
  return (fromKey(k).getDay() + 6) % 7;
}

export function weekStart(k: DateKey): DateKey {
  return addDays(k, -weekday(k));
}

export function range(start: DateKey, days: number): DateKey[] {
  return Array.from({ length: days }, (_, i) => addDays(start, i));
}

export function prettyDay(k: DateKey): string {
  return fromKey(k).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
