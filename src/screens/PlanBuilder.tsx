import { useState } from 'react';
import type { BlockType, DateKey, PlannedBlock, PortionStatus } from '../types';
import { useStore } from '../store';
import { addDays, prettyDay, range, todayKey } from '../engine/dates';
import { isOverPlanned } from '../engine/planner';
import { chapterTitle, subjectById } from '../store/selectors';
import { config } from '../config';
import { lines } from '../lib/voice';
import { Bubble } from '../components/Bubble';
import { Modal } from '../components/Modal';

const PORTION_LABEL: Record<PortionStatus, string> = { in: 'In portion', probably: 'Probably', out: 'Not in portion' };
const TYPE_LABEL: Record<BlockType, string> = { learn: 'New chapter', practice: 'Practice', revise: 'Quick revise', boss: 'Boss fight' };

export function PlanBuilder() {
  const [tab, setTab] = useState<'portions' | 'plan'>('portions');
  const [share, setShare] = useState(false);
  return (
    <div className="page">
      <div className="row between wrap">
        <h1>My plan</h1>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'portions'} className={tab === 'portions' ? 'on' : ''} onClick={() => setTab('portions')}>1. Portions & test dates</button>
          <button role="tab" aria-selected={tab === 'plan'} className={tab === 'plan' ? 'on' : ''} onClick={() => setTab('plan')}>2. Day-by-day plan</button>
        </div>
      </div>
      {tab === 'portions' ? <Portions onDone={() => setTab('plan')} /> : <Days onShare={() => setShare(true)} />}
      {share && <ShareView onClose={() => setShare(false)} />}
    </div>
  );
}

function Portions({ onDone }: { onDone: () => void }) {
  const s = useStore();
  const [open, setOpen] = useState<string | null>(s.subjects[0]?.id ?? null);
  const inCount = s.subjects.flatMap((x) => x.chapters).filter((c) => c.portionStatus !== 'out').length;

  return (
    <div className="stack">
      {!s.settings.chaptersReviewed && (
        <p className="hint">These chapter lists are a draft until Mum checks them against your textbooks. You can still start marking portions.</p>
      )}
      <div className="card row wrap">
        <label className="field inline">
          <span>Test date (all subjects)</span>
          <input type="date" value={s.plan.globalTestDate ?? ''} min={todayKey()} onChange={(e) => s.setTestDate('global', e.target.value || undefined)} />
        </label>
        <p className="muted small">Not announced yet? Leave it empty and we'll plan one week at a time.</p>
      </div>
      {s.subjects.map((sub) => {
        const counts = { in: 0, probably: 0, out: 0 };
        sub.chapters.forEach((c) => counts[c.portionStatus]++);
        const isOpen = open === sub.id;
        return (
          <div key={sub.id} className="card subject-card" style={{ borderLeftColor: sub.color }}>
            <button className="subject-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : sub.id)}>
              <span className="subject-name">{sub.name}</span>
              <span className="muted small">{counts.in} in · {counts.probably} probably · {sub.chapters.length} chapters</span>
              <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
            </button>
            {isOpen && (
              <div className="stack">
                <div className="row wrap">
                  <label className="field inline">
                    <span>{sub.name} test date</span>
                    <input type="date" value={sub.testDate ?? ''} min={todayKey()} onChange={(e) => s.setTestDate(sub.id, e.target.value || undefined)} />
                  </label>
                  <button className="btn small ghost" onClick={() => sub.chapters.forEach((c) => s.setPortion(c.id, 'in'))}>Mark all in</button>
                  <button className="btn small ghost" onClick={() => sub.chapters.forEach((c) => s.setPortion(c.id, 'out'))}>Clear all</button>
                </div>
                <ul className="chapter-list">
                  {sub.chapters.map((c) => (
                    <li key={c.id} className={`chapter portion-${c.portionStatus}`}>
                      <span className="chapter-title"><span className="muted">{c.number}.</span> {c.title}{c.doneDates.length > 0 && <span className="done-tick" title="Studied"> ✓</span>}</span>
                      <span className="seg" role="radiogroup" aria-label={`Portion status for ${c.title}`}>
                        {(['in', 'probably', 'out'] as PortionStatus[]).map((p) => (
                          <button key={p} role="radio" aria-checked={c.portionStatus === p} className={c.portionStatus === p ? `on ${p}` : ''} onClick={() => s.setPortion(c.id, p)}>
                            {PORTION_LABEL[p]}
                          </button>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
      <div className="row">
        <button className="btn primary big" disabled={!inCount} onClick={() => { s.regeneratePlan(); onDone(); }}>
          Make my draft plan ({inCount} chapters)
        </button>
        {!inCount && <span className="muted">Mark some chapters as In portion or Probably first.</span>}
      </div>
    </div>
  );
}

function Days({ onShare }: { onShare: () => void }) {
  const s = useStore();
  const today = todayKey();
  const planned = Object.keys(s.plan.days).filter((d) => d >= today).sort();
  const last = planned.at(-1) && planned.at(-1)! > addDays(today, 6) ? planned.at(-1)! : addDays(today, 6);
  const days = range(today, Math.round((Date.parse(last) - Date.parse(today)) / 86400000) + 1);
  const [drag, setDrag] = useState<{ id: string; from: DateKey } | null>(null);
  const [adding, setAdding] = useState<DateKey | null>(null);
  const over = days.find((d) => isOverPlanned(s.plan.days[d] ?? []));

  return (
    <div className="stack">
      <div className="row wrap between">
        <p className="muted">Drag a block to another day to move it. Moved blocks stay put when you re-make the plan.</p>
        <div className="row">
          <button className="btn" onClick={() => s.regeneratePlan()}>Re-spread plan</button>
          <button className="btn" onClick={onShare}>Want Mum to take a look?</button>
        </div>
      </div>
      {over && <Bubble tone="nudge">{lines.overPlanned} ({prettyDay(over)})</Bubble>}
      {!planned.length && <p className="hint">No plan yet. Go to Portions, mark chapters, and press "Make my draft plan".</p>}
      <div className="days-grid">
        {days.map((d) => {
          const blocks = s.plan.days[d] ?? [];
          return (
            <div
              key={d}
              className={`day-card ${d === today ? 'today' : ''} ${isOverPlanned(blocks) ? 'over' : ''} ${drag ? 'droppable' : ''}`}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); if (drag) s.movePlannedBlock(drag.id, drag.from, d); setDrag(null); }}
            >
              <div className="row between">
                <strong>{d === today ? 'Today' : prettyDay(d)}</strong>
                <span className="muted small">{blocks.length}/{config.blocks.maxPerDay}</span>
              </div>
              {blocks.map((b) => (
                <BlockChip key={b.id} b={b} date={d} days={days} onDragStart={() => setDrag({ id: b.id, from: d })} onDragEnd={() => setDrag(null)} />
              ))}
              <button className="btn ghost small add" onClick={() => setAdding(d)}>+ add</button>
            </div>
          );
        })}
      </div>
      {adding && <AddBlock date={adding} onClose={() => setAdding(null)} />}
    </div>
  );
}

function BlockChip({ b, date, days, onDragStart, onDragEnd }: { b: PlannedBlock; date: DateKey; days: DateKey[]; onDragStart: () => void; onDragEnd: () => void }) {
  const s = useStore();
  const sub = subjectById(s, b.subjectId);
  return (
    <div className="block-chip" draggable onDragStart={onDragStart} onDragEnd={onDragEnd} style={{ borderLeftColor: sub?.color }}>
      <div className="block-chip-main">
        <strong>{sub?.name ?? b.subjectId}</strong>
        <span className="small">{TYPE_LABEL[b.type]} · {b.minutes} min{b.manual ? ' · 📌' : ''}</span>
        {b.chapterId && <span className="small muted">{chapterTitle(s, b.chapterId)}</span>}
      </div>
      <div className="block-chip-actions">
        <select aria-label="Move to day" value={date} onChange={(e) => s.movePlannedBlock(b.id, date, e.target.value)}>
          {days.map((d) => <option key={d} value={d}>{prettyDay(d)}</option>)}
        </select>
        <button className="btn ghost small" aria-label="Remove block" onClick={() => s.removePlannedBlock(date, b.id)}>✕</button>
      </div>
    </div>
  );
}

function AddBlock({ date, onClose }: { date: DateKey; onClose: () => void }) {
  const s = useStore();
  const [subjectId, setSubjectId] = useState(s.subjects[0]?.id);
  const [type, setType] = useState<BlockType>('learn');
  const sub = s.subjects.find((x) => x.id === subjectId);
  const [chapterId, setChapterId] = useState<string>('');
  return (
    <Modal title={`Add a block · ${prettyDay(date)}`} onClose={onClose}>
      <div className="stack">
        <label className="field"><span>Subject</span>
          <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setChapterId(''); }}>
            {s.subjects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <label className="field"><span>Chapter (optional)</span>
          <select value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
            <option value="">Any / mixed</option>
            {sub?.chapters.map((c) => <option key={c.id} value={c.id}>{c.number}. {c.title}</option>)}
          </select>
        </label>
        <label className="field"><span>Kind of block</span>
          <select value={type} onChange={(e) => setType(e.target.value as BlockType)}>
            {(['learn', 'practice', 'revise'] as BlockType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
        </label>
        <button className="btn primary" onClick={() => {
          s.addPlannedBlock(date, { subjectId: subjectId!, chapterId: chapterId || undefined, type, minutes: type === 'revise' ? config.blocks.shortBlockMinutes : config.blocks.focusMinutes });
          onClose();
        }}>Add</button>
      </div>
    </Modal>
  );
}

function ShareView({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const today = todayKey();
  const days = Object.keys(s.plan.days).filter((d) => d >= today).sort();
  return (
    <Modal title={`${s.profile?.name}'s plan`} onClose={onClose} wide>
      <div className="print-area">
        <p className="muted">Read-only view. {s.plan.globalTestDate ? `Test date: ${prettyDay(s.plan.globalTestDate)}.` : 'No test date set yet.'}</p>
        <table className="plan-table">
          <thead><tr><th>Day</th><th>Blocks</th></tr></thead>
          <tbody>
            {days.map((d) => (
              <tr key={d}>
                <td>{prettyDay(d)}</td>
                <td>{s.plan.days[d].map((b) => `${subjectById(s, b.subjectId)?.name}${b.chapterId ? `: ${chapterTitle(s, b.chapterId)}` : ''} (${TYPE_LABEL[b.type]}, ${b.minutes} min)`).join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row no-print">
        <button className="btn primary" onClick={() => window.print()}>Print or save as PDF</button>
        <button className="btn ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
