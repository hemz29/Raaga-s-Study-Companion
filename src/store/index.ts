import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  AppState, BlockLog, DateKey, DaySession, PlannedBlock, PortionStatus, RecallRating, StageId, Subject, Takeaway, WorldId,
} from '../types';
import seed from '../data/subjects.json';
import { config } from '../config';
import { kvStorage } from '../lib/db';
import { todayKey, weekStart, addDays } from '../engine/dates';
import { autoSpread, moveBlock as moveBlockPure, uid } from '../engine/planner';
import { initialDue, schedule, selectRecall, toRecallItem, recallScore } from '../engine/recall';
import { computeDayPlay } from '../engine/rewards';
import { stageFor, stageIndex } from '../engine/creature';
import { isValidMistakeNote } from '../engine/insights';

export function seedSubjects(): Subject[] {
  return seed.subjects.map((s) => ({
    id: s.id, name: s.name, kind: s.kind as Subject['kind'], color: s.color,
    chapters: s.chapters.map((c) => ({ ...c, subjectId: s.id, portionStatus: 'out' as PortionStatus, doneDates: [] })),
  }));
}

export function initialState(): AppState {
  return {
    version: 1,
    subjects: seedSubjects(),
    plan: { days: {} },
    sessions: {},
    blocks: {},
    takeaways: {},
    mistakes: [],
    creature: { gp: 0, stage: 'egg', traits: {}, cosmetics: [], customArt: {} },
    ledger: [],
    settings: { muted: false, paused: false, pausedDays: [], examWeekLightDay: 'normal', chaptersReviewed: seed.reviewed },
    lightTokens: {},
    weekBonusesGiven: [],
    swapStreak: {},
    gallery: [],
  };
}

export interface SubmitBlockInput {
  takeaways: { text: string; ownQuestion?: string; ownAnswer?: string }[];
  exerciseTypes: string[];
  exerciseNote?: string;
}

interface Actions {
  setupProfile(name: string, world: WorldId): void;
  setWorld(world: WorldId): void;
  setPortion(chapterId: string, status: PortionStatus): void;
  setTestDate(subjectId: string | 'global', date?: DateKey): void;
  regeneratePlan(): void;
  movePlannedBlock(blockId: string, from: DateKey, to: DateKey): void;
  removePlannedBlock(date: DateKey, blockId: string): void;
  addPlannedBlock(date: DateKey, block: Omit<PlannedBlock, 'id'>): void;
  startSession(selected: PlannedBlock[], lightDay: boolean, swaps: { from: string; to: string }[]): void;
  beginBlock(planned: PlannedBlock, extra: boolean): void;
  finishBriefing(completed: boolean): void;
  pauseBlock(): void;
  resumeBlock(): void;
  finishFocus(): void;
  abandonBlock(): void;
  submitBlock(input: SubmitBlockInput): void;
  endBreak(): void;
  logMistake(subjectId: string, category: string, note: string): void;
  prepareRecall(): void;
  rateRecall(index: number, rating: RecallRating): void;
  completeRecall(): void;
  spendPlay(minutes: number, reason: string): void;
  markReportSent(date: DateKey, note?: string): void;
  setReportNote(date: DateKey, note: string): void;
  setMuted(m: boolean): void;
  setPinHash(hash?: string): void;
  setPaused(p: boolean): void;
  setExamWeekLightDay(v: 'normal' | 'half' | 'off'): void;
  setChaptersReviewed(v: boolean): void;
  updateChapter(subjectId: string, chapterId: string, patch: { title?: string; weight?: number }): void;
  addChapter(subjectId: string, title: string): void;
  deleteChapter(subjectId: string, chapterId: string): void;
  renameSubject(subjectId: string, name: string): void;
  nameCreature(name: string): void;
  ackCelebration(): void;
  setCustomArt(stage: StageId, imageId?: string): void;
  addGalleryItem(id: string): void;
  togglePin(id: string): void;
  removeGalleryItem(id: string): void;
  dailyHousekeeping(): void;
  replaceAll(s: AppState): void;
  resetAll(): void;
}

export type Store = AppState & Actions & { hydrated: boolean };

const emptySession = (date: DateKey): DaySession => ({
  date, selected: [], blockIds: [], lightDay: false, recallDone: false, reportSent: false, briefingsDone: 0, swaps: [], playEarned: 0, gpEarned: 0,
});

/** Add GP (to total, today's session and optionally a subject trait); handles hatch/evolution celebrations. */
function withGp(s: AppState, gp: number, subjectId?: string): Partial<AppState> {
  const today = todayKey();
  const creature = { ...s.creature, gp: s.creature.gp + gp, traits: { ...s.creature.traits } };
  if (subjectId) creature.traits[subjectId] = (creature.traits[subjectId] ?? 0) + gp;
  const gatedTotal = Object.values(s.blocks).filter((b) => b.completedGate).length;
  const newStage = stageFor(creature.gp, gatedTotal);
  if (stageIndex(newStage) > stageIndex(creature.stage)) {
    creature.pendingCelebration = creature.stage === 'egg' ? 'hatch' : newStage;
    if (creature.stage === 'egg') creature.hatchedAt = new Date().toISOString();
    creature.stage = newStage;
  }
  const session = s.sessions[today] ?? emptySession(today);
  return { creature, sessions: { ...s.sessions, [today]: { ...session, gpEarned: session.gpEarned + gp } } };
}

/** Recompute today's earned play time (idempotent: one "earned" ledger entry per day). */
function recomputeDay(s: AppState, date: DateKey): Partial<AppState> {
  const session = s.sessions[date];
  if (!session) return {};
  const blocks = session.blockIds.map((id) => s.blocks[id]).filter((b) => b?.completedGate);
  const recallDue = !!session.recall?.length;
  const gatePassed = blocks.length > 0 && (!recallDue || session.recallDone) && s.activeBlock?.phase !== 'log';
  const validMistakes = s.mistakes.filter((m) => m.date === date && isValidMistakeNote(m.note)).length;
  const { total } = computeDayPlay({
    plannedCount: session.selected.length,
    gatedPlanned: blocks.filter((b) => !b.extra).length,
    extraBlocks: blocks.filter((b) => b.extra).length,
    validMistakes,
    recallScore: session.recallDone && session.recall?.length ? recallScore(session.recall) : null,
    gatePassed,
  });
  const ledger = s.ledger.filter((e) => !(e.date === date && e.reason === 'earned'));
  if (total > 0) ledger.push({ date, minutes: total, reason: 'earned' });
  return { ledger, sessions: { ...s.sessions, [date]: { ...session, playEarned: total } } };
}

export const useStore = create<Store>()(
  persist(
    (set) => {
      const update = (fn: (s: AppState) => Partial<AppState>) => set((s) => fn(s) as Partial<Store>);
      const updateToday = (fn: (s: AppState, today: DateKey) => Partial<AppState>) =>
        set((s) => {
          const today = todayKey();
          const patch = fn(s, today);
          const merged = { ...s, ...patch } as AppState;
          return { ...patch, ...recomputeDay(merged, today) } as Partial<Store>;
        });

      return {
        ...initialState(),
        hydrated: false,

        setupProfile: (name, world) => update(() => ({ profile: { name, world, createdAt: new Date().toISOString() } })),
        setWorld: (world) => update((s) => ({ profile: s.profile && { ...s.profile, world } })),

        setPortion: (chapterId, status) => update((s) => ({
          subjects: s.subjects.map((sub) => ({ ...sub, chapters: sub.chapters.map((c) => (c.id === chapterId ? { ...c, portionStatus: status } : c)) })),
        })),
        setTestDate: (subjectId, date) => update((s) => (subjectId === 'global'
          ? { plan: { ...s.plan, globalTestDate: date } }
          : { subjects: s.subjects.map((x) => (x.id === subjectId ? { ...x, testDate: date } : x)) })),
        regeneratePlan: () => update((s) => ({ plan: autoSpread(s.subjects, s.plan, todayKey()) })),
        movePlannedBlock: (blockId, from, to) => update((s) => moveBlockPure(s.plan, s.subjects, blockId, from, to)),
        removePlannedBlock: (date, blockId) => update((s) => {
          const days = { ...s.plan.days, [date]: (s.plan.days[date] ?? []).filter((b) => b.id !== blockId) };
          if (!days[date].length) delete days[date];
          return { plan: { ...s.plan, days } };
        }),
        addPlannedBlock: (date, block) => update((s) => ({
          plan: { ...s.plan, days: { ...s.plan.days, [date]: [...(s.plan.days[date] ?? []), { ...block, id: uid('pb'), manual: true }] } },
        })),

        startSession: (selected, lightDay, swaps) => update((s) => {
          const today = todayKey();
          const prev = s.sessions[today] ?? emptySession(today);
          const swapStreak = { ...s.swapStreak };
          for (const sw of swaps) {
            swapStreak[sw.from] = (swapStreak[sw.from] ?? 0) + 1;
            swapStreak[sw.to] = 0;
          }
          for (const b of selected) swapStreak[b.subjectId] = 0;
          const lightTokens = lightDay ? { ...s.lightTokens, [weekStart(today)]: today } : s.lightTokens;
          return {
            swapStreak, lightTokens,
            sessions: { ...s.sessions, [today]: { ...prev, selected, lightDay: prev.lightDay || lightDay, swaps: [...prev.swaps, ...swaps] } },
          };
        }),

        beginBlock: (planned, extra) => update(() => ({
          activeBlock: {
            planned, extra, pausedMs: 0, startedAt: Date.now(),
            phase: planned.type === 'practice' || planned.type === 'boss' || planned.subjectId === 'maths' ? 'briefing' : 'focus',
          },
        })),
        finishBriefing: (completed) => updateToday((s, today) => {
          const session = s.sessions[today] ?? emptySession(today);
          return {
            activeBlock: s.activeBlock && { ...s.activeBlock, phase: 'focus', startedAt: Date.now(), pausedMs: 0 },
            sessions: { ...s.sessions, [today]: { ...session, briefingsDone: session.briefingsDone + (completed ? 1 : 0) } },
          };
        }),
        pauseBlock: () => update((s) => ({ activeBlock: s.activeBlock && !s.activeBlock.pausedAt ? { ...s.activeBlock, pausedAt: Date.now() } : s.activeBlock })),
        resumeBlock: () => update((s) => {
          const a = s.activeBlock;
          if (!a?.pausedAt) return {};
          return { activeBlock: { ...a, pausedMs: a.pausedMs + (Date.now() - a.pausedAt), pausedAt: undefined } };
        }),
        finishFocus: () => update((s) => ({ activeBlock: s.activeBlock && { ...s.activeBlock, phase: 'log', pausedAt: undefined } })),
        abandonBlock: () => update(() => ({ activeBlock: undefined })),

        submitBlock: (input) => updateToday((s, today) => {
          const a = s.activeBlock;
          if (!a) return {};
          const blockId = uid('blk');
          const takeaways = { ...s.takeaways };
          const ids: string[] = [];
          for (const t of input.takeaways) {
            const id = uid('tk');
            const tk: Takeaway = {
              id, blockId, subjectId: a.planned.subjectId, chapterId: a.planned.chapterId, date: today, text: t.text.trim(),
              ownQuestion: t.ownQuestion?.trim() || undefined, ownAnswer: t.ownAnswer?.trim() || undefined,
              intervalStep: 0, nextDue: initialDue(today), history: [],
            };
            takeaways[id] = tk;
            ids.push(id);
          }
          const elapsed = Math.round((Date.now() - a.startedAt - a.pausedMs) / 60000);
          const block: BlockLog = {
            id: blockId, date: today, subjectId: a.planned.subjectId, chapterId: a.planned.chapterId, type: a.planned.type,
            startedAt: new Date(a.startedAt).toISOString(), minutes: Math.max(1, Math.min(elapsed, a.planned.minutes)),
            takeawayIds: ids, exerciseTypes: input.exerciseTypes, exerciseNote: input.exerciseNote, completedGate: true, extra: a.extra,
          };
          const subjects = a.planned.chapterId && (a.planned.type === 'learn' || a.planned.type === 'practice')
            ? s.subjects.map((sub) => ({ ...sub, chapters: sub.chapters.map((c) => (c.id === a.planned.chapterId && !c.doneDates.includes(today) ? { ...c, doneDates: [...c.doneDates, today] } : c)) }))
            : s.subjects;
          const session = s.sessions[today] ?? emptySession(today);
          const base: AppState = {
            ...s, takeaways, subjects,
            blocks: { ...s.blocks, [blockId]: block },
            sessions: { ...s.sessions, [today]: { ...session, blockIds: [...session.blockIds, blockId] } },
            activeBlock: { ...a, phase: 'break', breakStartedAt: Date.now() },
          };
          const extraGp = a.extra ? config.gp.extraBlock : 0;
          return { ...base, ...withGp(base, config.gp.block + extraGp, a.planned.subjectId) };
        }),
        endBreak: () => update(() => ({ activeBlock: undefined })),

        logMistake: (subjectId, category, note) => updateToday((s, today) => {
          const mistakes = [...s.mistakes, { id: uid('m'), date: today, subjectId, category, note: note.trim() }];
          const validToday = mistakes.filter((m) => m.date === today && isValidMistakeNote(m.note)).length;
          const base = { ...s, mistakes };
          if (isValidMistakeNote(note) && validToday <= config.gp.maxMistakeGpPerDay) {
            const withRare = validToday === 1 && !s.creature.cosmetics.includes('detective-monocle')
              ? { ...base, creature: { ...base.creature, cosmetics: [...base.creature.cosmetics, 'detective-monocle'] } } : base;
            const rareStar = mistakes.filter((m) => isValidMistakeNote(m.note)).length >= 10 && !withRare.creature.cosmetics.includes('star-cloak')
              ? { ...withRare, creature: { ...withRare.creature, cosmetics: [...withRare.creature.cosmetics, 'star-cloak'] } } : withRare;
            return { ...rareStar, ...withGp(rareStar, config.gp.mistake) };
          }
          return base;
        }),

        prepareRecall: () => update((s) => {
          const today = todayKey();
          const session = s.sessions[today] ?? emptySession(today);
          if (session.recall) return {};
          const picks = selectRecall(Object.values(s.takeaways), s.subjects, today);
          if (!picks.length) return {};
          const chapterTitle = (id?: string) => s.subjects.flatMap((x) => x.chapters).find((c) => c.id === id)?.title;
          return { sessions: { ...s.sessions, [today]: { ...session, recall: picks.map((t) => toRecallItem(t, chapterTitle(t.chapterId))) } } };
        }),
        rateRecall: (index, rating) => update((s) => {
          const today = todayKey();
          const session = s.sessions[today];
          if (!session?.recall) return {};
          const recall = session.recall.map((r, i) => (i === index ? { ...r, rating } : r));
          return { sessions: { ...s.sessions, [today]: { ...session, recall } } };
        }),
        completeRecall: () => updateToday((s, today) => {
          const session = s.sessions[today];
          if (!session?.recall || session.recallDone) return {};
          const takeaways = { ...s.takeaways };
          for (const r of session.recall) {
            const t = takeaways[r.takeawayId];
            if (t && r.rating) takeaways[r.takeawayId] = schedule(t, r.rating, today);
          }
          const base = { ...s, takeaways, sessions: { ...s.sessions, [today]: { ...session, recallDone: true } } };
          return { ...base, ...withGp(base, config.gp.recall) };
        }),

        spendPlay: (minutes, reason) => update((s) => (minutes > 0 ? { ledger: [...s.ledger, { date: todayKey(), minutes: -minutes, reason }] } : {})),
        markReportSent: (date, note) => update((s) => {
          const session = s.sessions[date];
          return session ? { sessions: { ...s.sessions, [date]: { ...session, reportSent: true, reportNote: note } } } : {};
        }),
        setReportNote: (date, note) => update((s) => {
          const session = s.sessions[date];
          return session ? { sessions: { ...s.sessions, [date]: { ...session, reportNote: note } } } : {};
        }),

        setMuted: (muted) => update((s) => ({ settings: { ...s.settings, muted } })),
        setPinHash: (parentPinHash) => update((s) => ({ settings: { ...s.settings, parentPinHash } })),
        setPaused: (paused) => update((s) => {
          const today = todayKey();
          const pausedDays = paused && !s.settings.pausedDays.includes(today) ? [...s.settings.pausedDays, today] : s.settings.pausedDays;
          return { settings: { ...s.settings, paused, pausedDays } };
        }),
        setExamWeekLightDay: (examWeekLightDay) => update((s) => ({ settings: { ...s.settings, examWeekLightDay } })),
        setChaptersReviewed: (chaptersReviewed) => update((s) => ({ settings: { ...s.settings, chaptersReviewed } })),
        updateChapter: (subjectId, chapterId, patch) => update((s) => ({
          subjects: s.subjects.map((x) => (x.id !== subjectId ? x : { ...x, chapters: x.chapters.map((c) => (c.id === chapterId ? { ...c, ...patch } : c)) })),
        })),
        addChapter: (subjectId, title) => update((s) => ({
          subjects: s.subjects.map((x) => (x.id !== subjectId ? x : {
            ...x, chapters: [...x.chapters, { id: uid(`${x.id}-c`), subjectId, number: x.chapters.length + 1, title, weight: 1, portionStatus: 'out', doneDates: [] }],
          })),
        })),
        deleteChapter: (subjectId, chapterId) => update((s) => ({
          subjects: s.subjects.map((x) => (x.id !== subjectId ? x : { ...x, chapters: x.chapters.filter((c) => c.id !== chapterId).map((c, i) => ({ ...c, number: i + 1 })) })),
        })),
        renameSubject: (subjectId, name) => update((s) => ({ subjects: s.subjects.map((x) => (x.id === subjectId ? { ...x, name } : x)) })),

        nameCreature: (name) => update((s) => ({ creature: { ...s.creature, name } })),
        ackCelebration: () => update((s) => ({ creature: { ...s.creature, pendingCelebration: undefined } })),
        setCustomArt: (stage, imageId) => update((s) => {
          const customArt = { ...s.creature.customArt };
          if (imageId) customArt[stage] = imageId; else delete customArt[stage];
          return { creature: { ...s.creature, customArt } };
        }),
        addGalleryItem: (id) => update((s) => ({ gallery: [{ id, createdAt: new Date().toISOString(), pinned: false }, ...s.gallery] })),
        togglePin: (id) => update((s) => ({ gallery: s.gallery.map((g) => (g.id === id ? { ...g, pinned: !g.pinned } : g)) })),
        removeGalleryItem: (id) => update((s) => ({ gallery: s.gallery.filter((g) => g.id !== id) })),

        /** Runs on load: keeps pause days frozen and grants the "kept your light token" weekly bonus. */
        dailyHousekeeping: () => update((s) => {
          const today = todayKey();
          let out: Partial<AppState> = {};
          if (s.settings.paused && !s.settings.pausedDays.includes(today)) {
            out.settings = { ...s.settings, pausedDays: [...s.settings.pausedDays, today] };
          }
          if (s.profile) {
            const lastWeek = addDays(weekStart(today), -7);
            const started = s.profile.createdAt.slice(0, 10) <= lastWeek;
            const studied = Object.values(s.blocks).some((b) => b.date >= lastWeek && b.date < weekStart(today));
            if (started && studied && !s.lightTokens[lastWeek] && !s.weekBonusesGiven.includes(lastWeek)) {
              const base = { ...s, ...out, weekBonusesGiven: [...s.weekBonusesGiven, lastWeek] } as AppState;
              out = { ...out, weekBonusesGiven: base.weekBonusesGiven, ...withGp(base, config.gp.unusedLightTokenWeek) };
            }
          }
          return out;
        }),

        replaceAll: (state) => set(() => ({ ...initialState(), ...state, activeBlock: undefined })),
        resetAll: () => set(() => ({ ...initialState() })),
      };
    },
    {
      name: 'app-state',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: (s) => {
        const { hydrated, ...rest } = s;
        return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function')) as unknown as Store;
      },
      onRehydrateStorage: () => () => {
        useStore.setState({ hydrated: true });
        useStore.getState().dailyHousekeeping();
      },
    },
  ),
);

export function snapshot(): AppState {
  const s = useStore.getState();
  return Object.fromEntries(Object.entries(s).filter(([k, v]) => typeof v !== 'function' && k !== 'hydrated')) as unknown as AppState;
}
