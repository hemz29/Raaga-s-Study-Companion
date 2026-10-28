import { useEffect, useMemo, useRef, useState } from 'react';
import type { PlannedBlock, Subject } from '../types';
import { useStore } from '../store';
import { config } from '../config';
import { todayKey } from '../engine/dates';
import { checkTakeaway, keyTermsFrom, type TakeawayCheck } from '../engine/takeaways';
import { avoidedSubjects } from '../engine/insights';
import { looksRight } from '../engine/recall';
import { computeDayPlay } from '../engine/rewards';
import { uid } from '../engine/planner';
import { isValidMistakeNote } from '../engine/insights';
import { recallScore } from '../engine/recall';
import {
  chapterTitle, gateStatus, lightDayMinutes, lightTokenAvailable, moodOf, subjectById,
} from '../store/selectors';
import { Bubble } from '../components/Bubble';
import { Creature } from '../components/Creature';
import { MistakeLogger } from '../components/MistakeLogger';
import { play } from '../lib/sound';
import { lines } from '../lib/voice';
import { Report } from './Report';
import type { Screen } from '../App';

export function Session({ go }: { go: (s: Screen) => void }) {
  const s = useStore();
  const today = todayKey();
  const session = s.sessions[today];
  const a = s.activeBlock;

  useEffect(() => { s.prepareRecall(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (s.settings.paused) {
    return <div className="page"><div className="card narrow center"><h2>Paused</h2><p>Your creature is peacefully asleep. Nothing counts against you while paused.</p><button className="btn" onClick={() => go('home')}>Home</button></div></div>;
  }
  if (a?.phase === 'briefing') return <Briefing />;
  if (a?.phase === 'focus') return <Timer />;
  if (a?.phase === 'log') return <BlockLogForm />;
  if (a?.phase === 'break') return <Break />;

  if (session?.recall?.length && !session.recallDone) return <RecallQuiz />;
  if (!session || !session.selected.length) return <Launch />;
  return <Hub go={go} />;
}

/* ---------- Launch: pick up to 3 blocks, swap freely, or use the light-day token ---------- */

function suggestionsFor(subjects: Subject[], planToday: PlannedBlock[], recentSubjectIds: string[]): PlannedBlock[] {
  if (planToday.length) return planToday.slice(0, config.blocks.maxPerDay);
  const out: PlannedBlock[] = [];
  const maths = subjects.find((x) => x.kind === 'maths');
  if (maths) out.push({ id: uid('pb'), subjectId: maths.id, type: 'practice', minutes: config.blocks.mathsPracticeMinutes });
  const rest = subjects.filter((x) => x.kind !== 'maths').sort((x, y) => recentSubjectIds.indexOf(x.id) - recentSubjectIds.indexOf(y.id));
  for (const sub of rest.slice(0, 2)) out.push({ id: uid('pb'), subjectId: sub.id, type: sub.kind === 'memory' ? 'revise' : 'learn', minutes: config.blocks.focusMinutes });
  return out;
}

function Launch() {
  const s = useStore();
  const today = todayKey();
  // subjects ordered least-recently studied first (never studied first of all)
  const recent = useMemo(() => {
    const last = new Map<string, string>();
    Object.values(s.blocks).forEach((b) => { if ((last.get(b.subjectId) ?? '') < b.date) last.set(b.subjectId, b.date); });
    return s.subjects.map((x) => x.id).sort((x, y) => (last.get(x) ?? '').localeCompare(last.get(y) ?? ''));
  }, [s.blocks, s.subjects]);
  const [picked, setPicked] = useState<PlannedBlock[]>(() => suggestionsFor(s.subjects, s.plan.days[today] ?? [], recent));
  const [swaps, setSwaps] = useState<{ from: string; to: string }[]>([]);
  const [swapping, setSwapping] = useState<string | null>(null);
  const [light, setLight] = useState(false);
  const avoided = avoidedSubjects(s.swapStreak).filter((id) => !picked.some((p) => p.subjectId === id));
  const tokenOk = lightTokenAvailable(s, today);
  const mood = moodOf(s, today);

  const swap = (blockId: string, toSubject: string) => {
    const blk = picked.find((p) => p.id === blockId)!;
    const sub = s.subjects.find((x) => x.id === toSubject)!;
    setSwaps([...swaps, { from: blk.subjectId, to: toSubject }]);
    setPicked(picked.map((p) => (p.id === blockId ? { id: uid('pb'), subjectId: toSubject, type: sub.kind === 'maths' ? 'practice' : 'learn', minutes: sub.kind === 'maths' ? config.blocks.mathsPracticeMinutes : config.blocks.focusMinutes } : p)));
    setSwapping(null);
  };

  const chosen = light ? picked.slice(0, 1).map((p) => ({ ...p, minutes: lightDayMinutes(s, today) })) : picked;

  return (
    <div className="page session-launch">
      <div className="launch-head">
        <Creature stage={s.creature.stage} world={s.profile!.world} mood={mood} size={140} cosmetics={s.creature.cosmetics} customArtId={s.creature.customArt[s.creature.stage]} />
        <Bubble>{light ? lines.lightDay : `Here's what your plan suggests for today. Swap anything you like, it's your call.`}</Bubble>
      </div>
      {avoided.map((id) => {
        const sub = subjectById(s, id)!;
        return (
          <div key={id} className="card hint-card row between wrap">
            <span>{lines.avoidance(sub.name)}</span>
            <button className="btn small" onClick={() => setPicked([...picked.slice(0, config.blocks.maxPerDay - 1), { id: uid('pb'), subjectId: id, type: 'revise', minutes: config.blocks.shortBlockMinutes }])}>Add a short one</button>
          </div>
        );
      })}
      <div className="launch-blocks">
        {chosen.map((b, i) => {
          const sub = subjectById(s, b.subjectId);
          return (
            <div key={b.id} className="card launch-block" style={{ borderTopColor: sub?.color }}>
              <span className="kicker">Block {i + 1}</span>
              <h3>{sub?.name}</h3>
              <p className="muted">{b.chapterId ? chapterTitle(s, b.chapterId) : b.type === 'boss' ? 'Pick any subject to revise and catch up' : 'Any chapter'} · {b.minutes} min</p>
              {swapping === b.id ? (
                <select autoFocus aria-label="Swap to subject" defaultValue="" onChange={(e) => e.target.value && swap(b.id, e.target.value)}>
                  <option value="" disabled>Swap to…</option>
                  {s.subjects.filter((x) => x.id !== b.subjectId).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              ) : (
                <div className="row">
                  <button className="btn small" onClick={() => setSwapping(b.id)}>Swap</button>
                  {!light && picked.length > 1 && <button className="btn small ghost" onClick={() => setPicked(picked.filter((p) => p.id !== b.id))}>Remove</button>}
                </div>
              )}
            </div>
          );
        })}
        {!light && picked.length < config.blocks.maxPerDay && (
          <div className="card launch-block add-card">
            <label className="field"><span>Add a block</span>
              <select defaultValue="" onChange={(e) => {
                const sub = s.subjects.find((x) => x.id === e.target.value);
                if (sub) setPicked([...picked, { id: uid('pb'), subjectId: sub.id, type: sub.kind === 'maths' ? 'practice' : 'learn', minutes: sub.kind === 'maths' ? config.blocks.mathsPracticeMinutes : config.blocks.focusMinutes }]);
                e.target.value = '';
              }}>
                <option value="" disabled>Choose subject…</option>
                {s.subjects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>
      <div className="row wrap">
        <button className="btn primary big" disabled={!chosen.length} onClick={() => { s.startSession(chosen, light, swaps); play('start'); }}>
          {light ? 'Start my light day' : `Let's go (${chosen.length} block${chosen.length > 1 ? 's' : ''})`}
        </button>
        {tokenOk && (
          <button className={`btn ${light ? 'on' : ''}`} onClick={() => setLight(!light)}>
            {light ? 'Back to a full day' : '✨ Use my light-day token'}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- Hub: progress through the day's blocks ---------- */

function Hub({ go }: { go: (s: Screen) => void }) {
  const s = useStore();
  const today = todayKey();
  const session = s.sessions[today]!;
  const done = session.blockIds.map((id) => s.blocks[id]).filter(Boolean);
  const doneNonExtra = done.filter((b) => !b.extra).length;
  const remaining = session.selected.slice(doneNonExtra);
  const gate = gateStatus(s, today);
  const [mistakeOpen, setMistakeOpen] = useState(false);
  const [wrap, setWrap] = useState(false);
  const [extraPick, setExtraPick] = useState('');
  const extrasDone = done.filter((b) => b.extra).length;

  if (wrap) return <WrapUp onBack={() => setWrap(false)} go={go} />;

  return (
    <div className="page">
      <h1>Today's session</h1>
      <div className="hub-grid">
        {session.selected.map((b, i) => {
          const log = done.filter((x) => !x.extra)[i];
          const sub = subjectById(s, b.subjectId);
          const isNext = !log && i === doneNonExtra;
          return (
            <div key={b.id} className={`card hub-block ${log ? 'done' : ''} ${isNext ? 'next' : ''}`} style={{ borderTopColor: sub?.color }}>
              <span className="kicker">Block {i + 1}{log ? ' · done ✓' : ''}</span>
              <h3>{sub?.name}</h3>
              <p className="muted small">{b.chapterId ? chapterTitle(s, b.chapterId) : 'Any chapter'} · {b.minutes} min</p>
              {isNext && <button className="btn primary" onClick={() => { s.beginBlock(b, false); play('start'); }}>Start block</button>}
            </div>
          );
        })}
        {done.filter((b) => b.extra).map((b) => (
          <div key={b.id} className="card hub-block done"><span className="kicker">Bonus block · done ✓</span><h3>{subjectById(s, b.subjectId)?.name}</h3></div>
        ))}
      </div>
      {remaining.length === 0 && !session.lightDay && extrasDone < config.playTime.maxExtraBlocksPerDay && (
        <div className="card row wrap">
          <span>Feeling strong? One bonus block earns +{config.playTime.extraBlockMinutes} min and +{config.gp.extraBlock} extra GP.</span>
          <select value={extraPick} onChange={(e) => setExtraPick(e.target.value)} aria-label="Bonus block subject">
            <option value="">Choose subject…</option>
            {s.subjects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <button className="btn" disabled={!extraPick} onClick={() => {
            s.beginBlock({ id: uid('pb'), subjectId: extraPick, type: 'learn', minutes: config.blocks.focusMinutes }, true);
            play('start');
          }}>Start bonus block</button>
        </div>
      )}
      <div className="row wrap">
        <button className="btn" onClick={() => setMistakeOpen(true)}>I caught a mistake</button>
        <button className={`btn ${remaining.length === 0 ? 'primary big' : ''}`} disabled={!done.length} onClick={() => setWrap(true)}>
          {remaining.length === 0 ? 'Wrap up my day' : 'Wrap up early'}
        </button>
        <button className="btn ghost" onClick={() => go('home')}>Home</button>
      </div>
      {!gate.passed && done.length > 0 && <p className="muted small">Still to do before rooms open: {gate.reasons.join(', ')}.</p>}
      {mistakeOpen && <MistakeLogger subjectId={done.at(-1)?.subjectId ?? session.selected[0]?.subjectId} onClose={() => setMistakeOpen(false)} />}
    </div>
  );
}

/* ---------- Detective briefing (about 60 seconds, habit prompt, not graded) ---------- */

function Briefing() {
  const s = useStore();
  const a = s.activeBlock!;
  const isMaths = subjectById(s, a.planned.subjectId)?.kind === 'maths';
  const checks = [
    'I will underline the keywords in each question',
    ...(isMaths ? ['I will circle the operation words and the numbers'] : []),
    'I will re-read the question before moving on',
    'I will audit my working before I call it done',
  ];
  const [ticked, setTicked] = useState<boolean[]>(checks.map(() => false));
  const [marks, setMarks] = useState<string>();
  const [confirmSkip, setConfirmSkip] = useState(false);
  const ready = ticked.every(Boolean) && marks;

  return (
    <div className="page briefing">
      <div className="card narrow">
        <p className="kicker">🕵️ Detective briefing</p>
        <h1>Eyes sharp, detective.</h1>
        <p className="muted">{lines.briefing}</p>
        <ul className="checklist">
          {checks.map((c, i) => (
            <li key={c}>
              <label>
                <input type="checkbox" checked={ticked[i]} onChange={() => { const t = [...ticked]; t[i] = !t[i]; setTicked(t); if (!ticked[i]) play('accept'); }} />
                <span>{c}</span>
              </label>
            </li>
          ))}
        </ul>
        <h3>How many marks is a typical question worth? So my answer should be…</h3>
        <div className="chips">
          {['1 mark → 1 line', '2-3 marks → 3-4 lines', '4-5 marks → a paragraph'].map((m) => (
            <button key={m} className={`chip ${marks === m ? 'on' : ''}`} onClick={() => setMarks(m)}>{m}</button>
          ))}
        </div>
        <div className="row">
          <button className="btn primary big" disabled={!ready} onClick={() => { s.finishBriefing(true); play('start'); }}>Case open, start the timer</button>
          {confirmSkip
            ? <button className="btn ghost" onClick={() => s.finishBriefing(false)}>Yes, skip this time</button>
            : <button className="btn ghost" onClick={() => setConfirmSkip(true)}>Skip</button>}
        </div>
      </div>
    </div>
  );
}

/* ---------- Focus timer ---------- */

function useNow(ms = 500) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

const fmt = (sec: number) => `${Math.floor(Math.max(0, sec) / 60)}:${String(Math.floor(Math.max(0, sec) % 60)).padStart(2, '0')}`;

function Timer() {
  const s = useStore();
  const a = s.activeBlock!;
  const now = useNow();
  const sub = subjectById(s, a.planned.subjectId);
  const pausedNow = a.pausedAt ? now - a.pausedAt : 0;
  const elapsed = (now - a.startedAt - a.pausedMs - pausedNow) / 1000;
  const total = a.planned.minutes * 60;
  const remaining = total - elapsed;
  const canLog = elapsed >= total * config.blocks.minFractionToLog;
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [mistakeOpen, setMistakeOpen] = useState(false);
  const rang = useRef(false);

  useEffect(() => {
    if (remaining <= 0 && !rang.current) {
      rang.current = true;
      play('end');
      s.finishFocus();
    }
  }, [remaining]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { document.title = `${fmt(remaining)} · ${sub?.name}`; return () => { document.title = "Raaga's Study Companion"; }; });

  const pct = Math.min(1, elapsed / total);
  return (
    <div className="page timer-page">
      <p className="kicker">{sub?.name}{a.planned.chapterId ? ` · ${chapterTitle(s, a.planned.chapterId)}` : ''}{a.extra ? ' · bonus block' : ''}</p>
      <div className="timer-ring" style={{ '--pct': pct } as React.CSSProperties}>
        <div className="timer-inner">
          <span className="timer-time" aria-live="off">{fmt(remaining)}</span>
          <span className="muted">{a.pausedAt ? 'Paused' : 'Focus'}</span>
        </div>
      </div>
      <p className="muted">{lines.blockStart}</p>
      <div className="row center-row">
        {a.pausedAt
          ? <button className="btn primary" onClick={s.resumeBlock}>Resume</button>
          : <button className="btn" onClick={s.pauseBlock}>Pause</button>}
        <button className="btn" disabled={!canLog} title={canLog ? '' : 'Available near the end of the block'} onClick={() => { play('end'); s.finishFocus(); }}>Finished, log it</button>
        <button className="btn" onClick={() => setMistakeOpen(true)}>I caught a mistake</button>
        {confirmQuit
          ? <button className="btn ghost" onClick={s.abandonBlock}>Yes, stop (won't count)</button>
          : <button className="btn ghost" onClick={() => setConfirmQuit(true)}>Stop block</button>}
      </div>
      {mistakeOpen && <MistakeLogger subjectId={a.planned.subjectId} onClose={() => setMistakeOpen(false)} />}
    </div>
  );
}

/* ---------- Takeaways + exercise log: the hard gate ---------- */

interface Draft { text: string; quiz: boolean; q: string; a: string; check?: TakeawayCheck }

function BlockLogForm() {
  const s = useStore();
  const today = todayKey();
  const a = s.activeBlock!;
  const session = s.sessions[today];
  const sub = subjectById(s, a.planned.subjectId)!;
  const need = session?.lightDay ? config.gate.takeawaysRequiredLightDay : config.gate.takeawaysRequired;
  const [drafts, setDrafts] = useState<Draft[]>(() => Array.from({ length: need }, () => ({ text: '', quiz: false, q: '', a: '' })));
  const [types, setTypes] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [pasteWarn, setPasteWarn] = useState(false);
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const previous = useMemo(() => Object.values(s.takeaways).map((t) => t.text), [s.takeaways]);
  const keyTerms = useMemo(() => keyTermsFrom(chapterTitle(s, a.planned.chapterId)), [s, a.planned.chapterId]);

  const runCheck = (i: number, list = drafts) => {
    const siblings = list.filter((_, j) => j !== i).map((d) => d.text);
    const check = list[i].text.trim() ? checkTakeaway(list[i].text, sub.kind, siblings, previous, keyTerms) : undefined;
    const next = list.map((d, j) => (j === i ? { ...d, check } : d));
    setDrafts(next);
    if (check?.ok && !drafts[i].check?.ok) play('accept');
    return check;
  };

  const allOk = drafts.every((d, i) => {
    const siblings = drafts.filter((_, j) => j !== i).map((x) => x.text);
    return checkTakeaway(d.text, sub.kind, siblings, previous, keyTerms).ok && (!d.quiz || (d.q.trim() && d.a.trim()));
  });
  const okCount = drafts.filter((d) => d.check?.ok).length;

  return (
    <div className="page log-page">
      <div className="launch-head">
        <Creature stage={s.creature.stage} world={s.profile!.world} mood="happy" size={110} cosmetics={s.creature.cosmetics} customArtId={s.creature.customArt[s.creature.stage]} />
        <Bubble>{lines.blockEnd}</Bubble>
      </div>
      <div className="card">
        <div className="row between">
          <h2>Top {need} takeaways · {sub.name}</h2>
          <span className="pill">{okCount}/{need}</span>
        </div>
        <p className="muted small">Each one needs about {config.gate.minWordsPerTakeaway}+ words and something concrete: a name, a number or year, a place, or a "because". Press Enter to check and move on.</p>
        {pasteWarn && <p className="hint">Pasting is switched off here. Typing it yourself is what makes it stick!</p>}
        <ol className="takeaways">
          {drafts.map((d, i) => (
            <li key={i} className={d.check ? (d.check.ok ? 'ok' : 'bad') : ''}>
              <textarea
                ref={(el) => { refs.current[i] = el; }}
                rows={2}
                value={d.text}
                autoFocus={i === 0}
                aria-label={`Takeaway ${i + 1}`}
                placeholder={i === 0 ? sub.kind === 'memory' ? 'e.g. Chandragupta Maurya founded the Mauryan Empire in 321 BC' : 'e.g. To divide fractions, flip the second one: 1/2 ÷ 1/4 = 2' : ''}
                onPaste={(e) => { e.preventDefault(); setPasteWarn(true); play('nudge'); }}
                onDrop={(e) => e.preventDefault()}
                onChange={(e) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, text: e.target.value, check: x.check?.ok ? undefined : x.check } : x)))}
                onBlur={() => runCheck(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const c = runCheck(i);
                    if (c?.ok) refs.current[i + 1]?.focus();
                  }
                }}
              />
              {d.check && !d.check.ok && d.check.coach && <p className="coach">🐾 {d.check.coach}</p>}
              {d.check?.ok && <p className="coach good">✓ {lines.takeawayGood}</p>}
              <label className="quiz-toggle">
                <input type="checkbox" checked={d.quiz} onChange={() => setDrafts(drafts.map((x, j) => (j === i ? { ...x, quiz: !x.quiz } : x)))} /> Quiz me on this
              </label>
              {d.quiz && (
                <div className="row wrap quiz-fields">
                  <input placeholder="Your question" value={d.q} onChange={(e) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
                  <input placeholder="Answer" value={d.a} onChange={(e) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
      <div className="card">
        <h3>What kind of work did you do?</h3>
        <div className="chips">
          {config.exerciseTypes.map((t) => (
            <button key={t} className={`chip ${types.includes(t) ? 'on' : ''}`} onClick={() => setTypes(types.includes(t) ? types.filter((x) => x !== t) : [...types, t])}>{t}</button>
          ))}
        </div>
        <input className="full" placeholder="Optional note (e.g. page 42, Q1-6)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="row">
        <button className="btn primary big" disabled={!allOk || !types.length} onClick={() => {
          s.submitBlock({ takeaways: drafts.map((d) => ({ text: d.text, ownQuestion: d.quiz ? d.q : undefined, ownAnswer: d.quiz ? d.a : undefined })), exerciseTypes: types, exerciseNote: note || undefined });
          play('sparkle');
        }}>Save and take a break</button>
        {(!allOk || !types.length) && <span className="muted small">{!allOk ? 'Finish all takeaways first.' : 'Pick at least one kind of work.'}</span>}
      </div>
    </div>
  );
}

/* ---------- Break ---------- */

function Break() {
  const s = useStore();
  const a = s.activeBlock!;
  const now = useNow(1000);
  const remaining = config.blocks.breakMinutes * 60 - (now - (a.breakStartedAt ?? now)) / 1000;
  const rang = useRef(false);
  useEffect(() => {
    if (remaining <= 0 && !rang.current) { rang.current = true; play('break'); }
  }, [remaining]);
  return (
    <div className="page timer-page">
      <p className="kicker">Break</p>
      <div className="timer-ring break" style={{ '--pct': 1 - Math.max(0, remaining) / (config.blocks.breakMinutes * 60) } as React.CSSProperties}>
        <div className="timer-inner"><span className="timer-time">{fmt(remaining)}</span><span className="muted">{remaining > 0 ? 'Rest' : "Break's over"}</span></div>
      </div>
      <p>{lines.breakTime}</p>
      <p className="muted small">Block saved. +{config.gp.block} GP for your creature.</p>
      <button className="btn primary big" onClick={s.endBreak}>{remaining > 0 ? "I'm ready, carry on" : 'Back to my session'}</button>
    </div>
  );
}

/* ---------- Recall quiz: answer first, then see the original, then self-rate ---------- */

function RecallQuiz() {
  const s = useStore();
  const today = todayKey();
  const items = s.sessions[today]!.recall!;
  const idx = items.findIndex((r) => !r.rating);
  const [guess, setGuess] = useState('');
  const [revealed, setRevealed] = useState(false);

  if (idx === -1) {
    const score = recallScore(items);
    return (
      <div className="page">
        <div className="card narrow center">
          <p className="kicker">Recall done</p>
          <h1>{Math.round(score * 100)}%</h1>
          <p>{score >= 0.8 ? 'Your memory is glowing! Bonus play time unlocked.' : score >= 0.6 ? 'Nice! Good recall earns a little bonus.' : 'The tricky ones will come back tomorrow, that is how memory gets strong.'}</p>
          <button className="btn primary big" autoFocus onClick={() => { s.completeRecall(); play('sparkle'); }}>Collect +{config.gp.recall} GP</button>
        </div>
      </div>
    );
  }
  const item = items[idx];
  const t = s.takeaways[item.takeawayId];
  const sub = t && subjectById(s, t.subjectId);
  const hint = revealed && item.kind !== 'free' && guess ? looksRight(guess, item.answer) : undefined;

  return (
    <div className="page">
      <div className="card narrow">
        <div className="row between"><p className="kicker">Recall quiz · {idx + 1} of {items.length}</p><span className="muted small">{sub?.name}{t?.chapterId ? ` · ${chapterTitle(s, t.chapterId)}` : ''}</span></div>
        <h2 className="recall-prompt">{item.prompt}</h2>
        <form onSubmit={(e) => { e.preventDefault(); setRevealed(true); }}>
          <textarea rows={2} className="full" autoFocus value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="Your answer, from memory…" disabled={revealed} onPaste={(e) => e.preventDefault()} />
          {!revealed && <button className="btn primary">Show me</button>}
        </form>
        {revealed && (
          <div className="stack">
            <div className="reveal">
              <p className="kicker">Answer</p>
              <p className="big">{item.answer}</p>
              {item.kind !== 'own' && t && <p className="muted small">Your note: {t.text}</p>}
              {hint !== undefined && <p className="muted small">{hint ? 'Looks like a match!' : 'Hmm, check carefully.'}</p>}
            </div>
            <p>How did you do?</p>
            <div className="row">
              {(['got', 'nearly', 'missed'] as const).map((r) => (
                <button key={r} className={`btn ${r === 'got' ? 'primary' : ''}`} onClick={() => { s.rateRecall(idx, r); setGuess(''); setRevealed(false); play(r === 'got' ? 'accept' : 'nudge'); }}>
                  {r === 'got' ? 'Got it' : r === 'nearly' ? 'Nearly' : 'Missed it'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Wrap-up ---------- */

function WrapUp({ onBack, go }: { onBack: () => void; go: (s: Screen) => void }) {
  const s = useStore();
  const today = todayKey();
  const session = s.sessions[today]!;
  const gate = gateStatus(s, today);
  const blocks = session.blockIds.map((id) => s.blocks[id]).filter(Boolean);
  const validMistakes = s.mistakes.filter((m) => m.date === today && isValidMistakeNote(m.note)).length;
  const { parts, total } = computeDayPlay({
    plannedCount: session.selected.length,
    gatedPlanned: blocks.filter((b) => !b.extra).length,
    extraBlocks: blocks.filter((b) => b.extra).length,
    validMistakes,
    recallScore: session.recallDone && session.recall?.length ? recallScore(session.recall) : null,
    gatePassed: gate.passed,
  });
  const [showReport, setShowReport] = useState(false);

  useEffect(() => { if (gate.passed) play('unlock'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (showReport) return <Report date={today} onDone={() => go('home')} onBack={() => setShowReport(false)} />;

  return (
    <div className="page">
      <div className="launch-head">
        <Creature stage={s.creature.stage} world={s.profile!.world} mood="radiant" size={150} cosmetics={s.creature.cosmetics} customArtId={s.creature.customArt[s.creature.stage]} />
        <Bubble tone="cheer">{lines.wrapUp(s.profile!.name)}</Bubble>
      </div>
      <div className="card">
        <h2>Today's haul</h2>
        <ul className="haul">
          <li><strong>{blocks.length}</strong> block{blocks.length !== 1 && 's'}, {blocks.reduce((x, b) => x + b.minutes, 0)} min</li>
          <li><strong>{blocks.reduce((x, b) => x + b.takeawayIds.length, 0)}</strong> takeaways in your treasure box</li>
          <li><strong>{s.mistakes.filter((m) => m.date === today).length}</strong> mistake{s.mistakes.filter((m) => m.date === today).length !== 1 && 's'} caught</li>
          <li><strong>+{session.gpEarned}</strong> GP for {s.creature.name ?? 'your creature'}</li>
        </ul>
        {gate.passed ? (
          <>
            <h3>Play time earned: {total} min</h3>
            <ul>{parts.map((p) => <li key={p.label}>{p.label}: +{p.minutes} min</li>)}</ul>
            {!parts.length && <p className="muted">Finish all your planned blocks to earn the base 15 minutes.</p>}
            {total >= config.playTime.dailyCeilingMinutes && <p className="muted small">That's the daily maximum ({config.playTime.dailyCeilingMinutes} min). Impressive!</p>}
          </>
        ) : (
          <><h3>Almost there</h3><ul className="todo">{gate.reasons.map((r) => <li key={r}>{r}</li>)}</ul></>
        )}
      </div>
      <div className="row wrap">
        {!session.reportSent
          ? <button className="btn primary big" onClick={() => setShowReport(true)}>Tell Mum how today went</button>
          : <span className="pill strong">Mum's report sent ✓</span>}
        <button className="btn" onClick={() => go('rooms')}>Go to rooms</button>
        <button className="btn ghost" onClick={onBack}>Back to session</button>
      </div>
    </div>
  );
}
