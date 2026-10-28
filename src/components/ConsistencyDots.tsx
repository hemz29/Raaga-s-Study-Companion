import { prettyDay } from '../engine/dates';
import type { Consistency } from '../engine/creature';

export function ConsistencyDots({ c }: { c: Consistency }) {
  return (
    <div className="dots" aria-label={`${c.active} study days in the last ${c.window.length}`}>
      {c.window.map((d) => (
        <span key={d.date} title={prettyDay(d.date)} className={`dot ${d.active ? 'on' : ''} ${d.beforeStart ? 'pre' : ''}`} />
      ))}
      <span className="dots-label">{c.active} of {c.window.length} days</span>
    </div>
  );
}
