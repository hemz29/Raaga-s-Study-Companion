import { useRef, useState } from 'react';
import { useStore, snapshot } from '../store';
import { config } from '../config';
import { toCsv } from '../engine/csv';
import { todayKey } from '../engine/dates';
import { allImages, clearImages, putImage } from '../lib/db';
import { hashPin } from '../lib/pin';
import { chapterTitle, subjectById } from '../store/selectors';
import { PinGate } from '../components/PinGate';
import type { AppState } from '../types';
import type { Screen } from '../App';

function download(name: string, content: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function Parent({ go }: { go: (s: Screen) => void }) {
  return <div className="page"><PinGate onCancel={() => go('home')}><ParentInner /></PinGate></div>;
}

function ParentInner() {
  const s = useStore();
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [newPin, setNewPin] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const today = todayKey();

  const backup = async () => {
    const data = { app: 'raagas-study-companion', exportedAt: new Date().toISOString(), state: snapshot(), images: await allImages() };
    download(`study-companion-backup-${today}.json`, JSON.stringify(data), 'application/json');
  };
  const restore = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'raagas-study-companion' || !data.state) throw new Error('Not a Study Companion backup file');
      if (!confirm('Replace everything on this laptop with this backup?')) return;
      await clearImages();
      for (const [id, url] of Object.entries(data.images ?? {})) await putImage(id, url as string);
      s.replaceAll(data.state as AppState);
      setMsg('Backup restored.');
    } catch (e) {
      setMsg(`Could not restore: ${e instanceof Error ? e.message : e}`);
    }
  };
  const csv = (kind: 'takeaways' | 'blocks' | 'mistakes') => {
    const rows =
      kind === 'takeaways' ? Object.values(s.takeaways).map((t) => ({ date: t.date, subject: subjectById(s, t.subjectId)?.name, chapter: chapterTitle(s, t.chapterId), text: t.text, ownQuestion: t.ownQuestion, ownAnswer: t.ownAnswer, nextDue: t.nextDue, ratings: t.history.map((h) => `${h.date}:${h.rating}`) }))
        : kind === 'blocks' ? Object.values(s.blocks).map((b) => ({ date: b.date, subject: subjectById(s, b.subjectId)?.name, chapter: chapterTitle(s, b.chapterId), type: b.type, minutes: b.minutes, exerciseTypes: b.exerciseTypes, note: b.exerciseNote, extra: b.extra }))
          : s.mistakes.map((m) => ({ date: m.date, subject: subjectById(s, m.subjectId)?.name, category: config.mistakeCategories.find((c) => c.id === m.category)?.label, note: m.note }));
    download(`${kind}-${today}.csv`, toCsv(rows as Record<string, unknown>[]), 'text/csv');
  };

  return (
    <div className="stack">
      <h1>Parent area</h1>
      {msg && <p className="hint">{msg}</p>}

      <div className="card">
        <h2>Pause</h2>
        <p className="muted">For illness, travel or school events. Freezes the consistency window; the creature sleeps peacefully. No penalty.</p>
        <label className="switch"><input type="checkbox" checked={s.settings.paused} onChange={(e) => s.setPaused(e.target.checked)} /> {s.settings.paused ? 'Paused' : 'Not paused'}</label>
      </div>

      <div className="card">
        <h2>Exam week</h2>
        <p className="muted">In the final 7 days before a test date, light-day tokens can be:</p>
        <div className="seg">
          {(['normal', 'half', 'off'] as const).map((v) => (
            <button key={v} className={s.settings.examWeekLightDay === v ? 'on' : ''} onClick={() => s.setExamWeekLightDay(v)}>
              {v === 'normal' ? 'Normal' : v === 'half' ? 'Half-block only' : 'Turned off'}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Chapter lists</h2>
        <p className="muted">Check each subject against the textbook contents page. Rename, add or remove chapters, and mark heavy chapters (they get more time).</p>
        <label className="switch"><input type="checkbox" checked={s.settings.chaptersReviewed} onChange={(e) => s.setChaptersReviewed(e.target.checked)} /> I've reviewed the chapter lists</label>
        {s.subjects.map((sub) => (
          <div key={sub.id} className="subject-edit">
            <button className="subject-head" aria-expanded={editing === sub.id} onClick={() => setEditing(editing === sub.id ? null : sub.id)}>
              <span className="subject-name">{sub.name}</span><span className="muted small">{sub.chapters.length} chapters</span><span aria-hidden="true">{editing === sub.id ? '▾' : '▸'}</span>
            </button>
            {editing === sub.id && (
              <div className="stack">
                <label className="field inline"><span>Subject name</span><input defaultValue={sub.name} onBlur={(e) => e.target.value.trim() && s.renameSubject(sub.id, e.target.value.trim())} /></label>
                {sub.chapters.map((c) => (
                  <div key={c.id} className="row chapter-edit">
                    <span className="muted">{c.number}.</span>
                    <input defaultValue={c.title} onBlur={(e) => e.target.value.trim() && s.updateChapter(sub.id, c.id, { title: e.target.value.trim() })} aria-label={`Chapter ${c.number} title`} />
                    <label className="small"><input type="checkbox" checked={c.weight > 1} onChange={(e) => s.updateChapter(sub.id, c.id, { weight: e.target.checked ? 2 : 1 })} /> heavy</label>
                    <button className="btn ghost small" onClick={() => confirm(`Remove "${c.title}"?`) && s.deleteChapter(sub.id, c.id)}>✕</button>
                  </div>
                ))}
                <form className="row" onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget.elements.namedItem('t') as HTMLInputElement; if (f.value.trim()) { s.addChapter(sub.id, f.value.trim()); f.value = ''; } }}>
                  <input name="t" placeholder="Add a chapter…" /><button className="btn small">Add</button>
                </form>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Data</h2>
        <p className="muted">Everything is stored only in this browser. <strong>Clearing browser data erases progress</strong>, so download a backup now and then.</p>
        <div className="row wrap">
          <button className="btn primary" onClick={backup}>Download backup (JSON)</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Restore from backup</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
        </div>
        <div className="row wrap">
          <button className="btn small" onClick={() => csv('takeaways')}>Takeaways CSV</button>
          <button className="btn small" onClick={() => csv('blocks')}>Study blocks CSV</button>
          <button className="btn small" onClick={() => csv('mistakes')}>Mistakes CSV</button>
        </div>
      </div>

      <div className="card">
        <h2>Parent PIN</h2>
        <form className="row" onSubmit={async (e) => { e.preventDefault(); if (!/^\d{4,6}$/.test(newPin)) return setMsg('PIN must be 4-6 digits.'); s.setPinHash(await hashPin(newPin)); setNewPin(''); setMsg('PIN updated.'); }}>
          <input type="password" inputMode="numeric" placeholder="New PIN" value={newPin} onChange={(e) => setNewPin(e.target.value)} />
          <button className="btn small">Change PIN</button>
        </form>
      </div>

      <div className="card">
        <h2>Game values</h2>
        <p className="muted small">GP, play time, recall intervals and mistake categories live in <code>src/config/config.json</code>. Tune them after the trial week.</p>
        <details><summary>Show current values</summary><pre className="report-preview">{JSON.stringify({ playTime: config.playTime, gp: config.gp, stages: config.stages, recall: config.recall }, null, 2)}</pre></details>
      </div>

      <div className="card danger">
        <h2>Start over</h2>
        <button className="btn ghost" onClick={async () => { if (confirm('Erase ALL progress on this laptop? Download a backup first!') && confirm('Really erase everything?')) { await clearImages(); s.resetAll(); } }}>Erase everything</button>
      </div>
    </div>
  );
}
