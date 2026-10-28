import { useState } from 'react';
import { useStore } from '../store';
import { config } from '../config';
import { isValidMistakeNote } from '../engine/insights';
import { play } from '../lib/sound';
import { lines } from '../lib/voice';
import { Modal } from './Modal';

export function MistakeLogger({ subjectId, onClose }: { subjectId?: string; onClose: () => void }) {
  const subjects = useStore((s) => s.subjects);
  const logMistake = useStore((s) => s.logMistake);
  const [subject, setSubject] = useState(subjectId ?? subjects[0]?.id);
  const [cat, setCat] = useState<string>();
  const [note, setNote] = useState('');
  const [done, setDone] = useState<string>();
  const valid = isValidMistakeNote(note);

  if (done) {
    return (
      <Modal title="Mistake caught!" onClose={onClose}>
        <div className="sparkle-burst" aria-hidden="true">✦ ✧ ✦</div>
        <p className="big">{done}</p>
        <button className="btn primary" onClick={onClose} autoFocus>Back to work</button>
      </Modal>
    );
  }

  return (
    <Modal title="I caught a mistake" onClose={onClose}>
      <p className="muted">Catching your own slip is the most valuable thing you can do. What kind was it?</p>
      <div className="chips">
        {config.mistakeCategories.map((c) => (
          <button key={c.id} className={`chip ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>
            <span aria-hidden="true">{c.icon}</span> {c.label}
          </button>
        ))}
      </div>
      <label className="field">
        <span>Subject</span>
        <select value={subject} onChange={(e) => setSubject(e.target.value)}>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <label className="field">
        <span>What happened, and how did you fix it?</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. wrote 7 × 8 = 54, re-checked and fixed it to 56" />
      </label>
      {!valid && note.trim() && <p className="hint">A few more words please, at least {config.gate.minWordsMistakeNote}, so future-you remembers.</p>}
      <div className="row">
        <button className="btn primary" disabled={!cat || !valid || !subject} onClick={() => {
          logMistake(subject!, cat!, note);
          play('sparkle');
          setDone(lines.mistakeCaught(config.mistakeCategories.find((c) => c.id === cat)!.label.toLowerCase()));
        }}>Log it</button>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}
