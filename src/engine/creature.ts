import type { DateKey, Mood, StageId } from '../types';
import { config } from '../config';
import { addDays } from './dates';

export function stageFor(gp: number, gatedBlocksTotal: number): StageId {
  let stage: StageId = 'egg';
  for (const s of config.stages) if (gp >= s.gp) stage = s.id;
  if (stage === 'egg' && gatedBlocksTotal >= config.hatchAfterBlocks) stage = 'hatchling';
  return stage;
}

export function stageIndex(id: StageId): number {
  return config.stages.findIndex((s) => s.id === id);
}

export function nextStage(id: StageId) {
  return config.stages[stageIndex(id) + 1];
}

/** Progress (0..1) from the current stage threshold to the next. */
export function stageProgress(gp: number, stage: StageId): number {
  const cur = config.stages[stageIndex(stage)];
  const nxt = nextStage(stage);
  if (!nxt) return 1;
  return Math.max(0, Math.min(1, (gp - cur.gp) / (nxt.gp - cur.gp)));
}

export interface Consistency {
  window: { date: DateKey; active: boolean; paused: boolean; beforeStart: boolean }[];
  active: number;
  required: number;
  ok: boolean;
}

/**
 * Rolling window (5 of 7): looks back over the last 7 non-paused days. Today only counts
 * if she has already studied. Days before she started never count against her.
 */
export function consistency(
  today: DateKey,
  activeDays: Set<DateKey>,
  pausedDays: Set<DateKey>,
  startDate: DateKey,
): Consistency {
  const { windowDays, requiredDays } = config.consistency;
  const allowance = windowDays - requiredDays;
  const window: Consistency['window'] = [];
  let d = activeDays.has(today) ? today : addDays(today, -1);
  let guard = 0;
  while (window.length < windowDays && guard++ < 60) {
    if (pausedDays.has(d)) { d = addDays(d, -1); continue; }
    window.unshift({ date: d, active: activeDays.has(d), paused: false, beforeStart: d < startDate });
    d = addDays(d, -1);
  }
  const eligible = window.filter((w) => !w.beforeStart).length;
  const active = window.filter((w) => w.active).length;
  const required = Math.max(0, Math.min(requiredDays, eligible - allowance));
  return { window, active, required, ok: active >= required };
}

export function moodFor(opts: { paused: boolean; consistencyOk: boolean; unsentReport: boolean; studiedToday: boolean; active: number }): Mood {
  if (opts.paused) return 'paused';
  if (!opts.consistencyOk || opts.unsentReport) return 'sleepy';
  if (opts.studiedToday && opts.active >= 6) return 'radiant';
  if (opts.studiedToday || opts.active >= 5) return 'happy';
  return 'content';
}
