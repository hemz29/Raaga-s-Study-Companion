import type { Subject } from '../types';

/** A simple radar: a lopsided week shows as a lopsided shape. */
export function TraitWheel({ subjects, traits, size = 220 }: { subjects: Subject[]; traits: Record<string, number>; size?: number }) {
  const n = subjects.length;
  const max = Math.max(10, ...subjects.map((s) => traits[s.id] ?? 0));
  const c = size / 2, r = size / 2 - 34;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [c + Math.cos(a) * r * v, c + Math.sin(a) * r * v] as const;
  };
  const poly = subjects.map((s, i) => pt(i, Math.max(0.06, (traits[s.id] ?? 0) / max)).join(',')).join(' ');
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Trait wheel showing study balance across subjects" className="trait-wheel">
      {[0.33, 0.66, 1].map((k) => (
        <polygon key={k} points={subjects.map((_, i) => pt(i, k).join(',')).join(' ')} fill="none" stroke="var(--line)" />
      ))}
      <polygon points={poly} fill="var(--accent)" fillOpacity=".35" stroke="var(--accent)" strokeWidth="2" />
      {subjects.map((s, i) => {
        const [x, y] = pt(i, 1.22);
        return <text key={s.id} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="trait-label">{s.name.split(' ')[0].slice(0, 9)}</text>;
      })}
    </svg>
  );
}
