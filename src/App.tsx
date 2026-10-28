import { useEffect, useState } from 'react';
import { useStore } from './store';
import { todayKey } from './engine/dates';
import { unsentReportDay } from './store/selectors';
import { Setup } from './screens/Setup';
import { Home } from './screens/Home';
import { PlanBuilder } from './screens/PlanBuilder';
import { Session } from './screens/Session';
import { Rooms } from './screens/Rooms';
import { ArtRoom } from './screens/ArtRoom';
import { Insights } from './screens/Insights';
import { Parent } from './screens/Parent';
import { Report } from './screens/Report';
import { Celebration } from './components/Celebration';

export type Screen = 'home' | 'plan' | 'session' | 'rooms' | 'art' | 'insights' | 'parent' | 'report-past';

const NAV: { id: Screen; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'session', label: 'Study' },
  { id: 'plan', label: 'Plan' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'insights', label: 'Notebook' },
];

export default function App() {
  const hydrated = useStore((s) => s.hydrated);
  const profile = useStore((s) => s.profile);
  const muted = useStore((s) => s.settings.muted);
  const setMuted = useStore((s) => s.setMuted);
  const activeBlock = useStore((s) => s.activeBlock);
  const [screen, setScreen] = useState<Screen>('home');

  useEffect(() => { void navigator.storage?.persist?.(); }, []);
  useEffect(() => { if (activeBlock) setScreen('session'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { document.documentElement.dataset.world = profile?.world ?? 'emberwick'; }, [profile?.world]);

  if (!hydrated) return <div className="loading">Opening the door…</div>;
  if (!profile) return <Setup />;

  const go = (s: Screen) => { setScreen(s); window.scrollTo(0, 0); };
  const inRoom = screen === 'art';

  return (
    <div className="app">
      <header className="topbar no-print">
        <button className="brand" onClick={() => go('home')}>Study Companion</button>
        {!inRoom && (
          <nav aria-label="Main">
            {NAV.map((n) => (
              <button key={n.id} className={screen === n.id ? 'on' : ''} aria-current={screen === n.id ? 'page' : undefined} onClick={() => go(n.id)}>{n.label}</button>
            ))}
          </nav>
        )}
        <div className="topbar-right">
          <button className="btn ghost small" onClick={() => setMuted(!muted)} aria-label={muted ? 'Turn sound on' : 'Mute sound'}>{muted ? '🔇' : '🔊'}</button>
          {!inRoom && <button className="btn ghost small" onClick={() => go('parent')}>Parent</button>}
        </div>
      </header>
      <main>
        {screen === 'home' && <Home go={go} />}
        {screen === 'session' && <Session go={go} />}
        {screen === 'plan' && <PlanBuilder />}
        {screen === 'rooms' && <Rooms go={go} />}
        {screen === 'art' && <ArtRoom go={go} />}
        {screen === 'insights' && <Insights />}
        {screen === 'parent' && <Parent go={go} />}
        {screen === 'report-past' && <PastReport go={go} />}
      </main>
      <Celebration />
    </div>
  );
}

function PastReport({ go }: { go: (s: Screen) => void }) {
  const s = useStore();
  const day = unsentReportDay(s, todayKey());
  if (!day) return <div className="page"><div className="card narrow center"><p>All caught up, Mum has every report.</p><button className="btn" onClick={() => go('home')}>Home</button></div></div>;
  return <Report date={day} onDone={() => go('home')} onBack={() => go('home')} />;
}
