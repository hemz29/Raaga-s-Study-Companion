import { useState } from 'react';
import { useStore } from '../store';
import { config } from '../config';
import { addDays, prettyDay, todayKey } from '../engine/dates';
import { mistakeCounts } from '../engine/insights';
import { subjectById } from '../store/selectors';
import { MistakeLogger } from '../components/MistakeLogger';

export function Insights() {
  const s = useStore();
  const today = todayKey();
  const [range, setRange] = useState<'14' | 'all'>('14');
  const [open, setOpen] = useState(false);
  const since = range === '14' ? addDays(today, -13) : undefined;
  const counts = mistakeCounts(s.mistakes, since);
  const max = Math.max(1, ...counts.map((c) => c.count));
  const recent = [...s.mistakes].reverse().slice(0, 20);
  const ratings = Object.values(s.takeaways).flatMap((t) => t.history);
  const recentRatings = ratings.filter((r) => r.date >= addDays(today, -6));
  const gotRate = (list: typeof ratings) => (list.length ? Math.round((list.filter((r) => r.rating === 'got').length / list.length) * 100) : null);
  const careful = Object.values(s.sessions).reduce((a, x) => a + x.briefingsDone, 0);

  return (
    <div className="page">
      <div className="row between wrap">
        <h1>Detective's notebook</h1>
        <button className="btn primary" onClick={() => setOpen(true)}>I caught a mistake</button>
      </div>
      <div className="stats">
        <div className="card stat"><span className="stat-num">{s.mistakes.length}</span><span>mistakes caught</span></div>
        <div className="card stat"><span className="stat-num">{careful}</span><span>detective briefings</span></div>
        <div className="card stat"><span className="stat-num">{Object.keys(s.takeaways).length}</span><span>takeaways collected</span></div>
        <div className="card stat"><span className="stat-num">{gotRate(recentRatings) ?? '–'}{gotRate(recentRatings) !== null && '%'}</span><span>"got it" in recall this week</span></div>
      </div>
      <div className="card">
        <div className="row between">
          <h2>Which slips cost you most?</h2>
          <div className="tabs">
            <button className={range === '14' ? 'on' : ''} onClick={() => setRange('14')}>Last 2 weeks</button>
            <button className={range === 'all' ? 'on' : ''} onClick={() => setRange('all')}>All time</button>
          </div>
        </div>
        <div className="bars">
          {counts.map((c) => (
            <div key={c.id} className="bar-row">
              <span className="bar-label">{c.icon} {c.label}</span>
              <span className="bar-track"><span className="bar-fill" style={{ width: `${(c.count / max) * 100}%` }} /></span>
              <span className="bar-num">{c.count}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <h2>Case files</h2>
        {!recent.length && <p className="muted">No mistakes logged yet. When you catch one, write what happened and how you fixed it.</p>}
        <ul className="case-list">
          {recent.map((m) => (
            <li key={m.id}>
              <span className="muted small">{prettyDay(m.date)} · {subjectById(s, m.subjectId)?.name} · {config.mistakeCategories.find((c) => c.id === m.category)?.label}</span>
              <span>{m.note}</span>
            </li>
          ))}
        </ul>
      </div>
      {open && <MistakeLogger onClose={() => setOpen(false)} />}
    </div>
  );
}
