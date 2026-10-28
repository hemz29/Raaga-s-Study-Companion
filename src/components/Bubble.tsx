export function Bubble({ children, tone = 'normal' }: { children: React.ReactNode; tone?: 'normal' | 'nudge' | 'cheer' }) {
  return <div className={`bubble bubble-${tone}`} role="status">{children}</div>;
}
