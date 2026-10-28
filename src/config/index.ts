import raw from './config.json';
import type { StageId } from '../types';

export interface Stage { id: StageId; name: string; gp: number }

export const config = raw as Omit<typeof raw, 'stages'> & { stages: Stage[] };
export type Config = typeof config;
