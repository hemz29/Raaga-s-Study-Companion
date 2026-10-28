import { useState } from 'react';
import { useStore } from '../store';
import { hashPin } from '../lib/pin';

/** Parent-only area. If no PIN is set yet, it invites the parent to set one. */
export function PinGate({ children, onCancel }: { children: React.ReactNode; onCancel: () => void }) {
  const pinHash = useStore((s) => s.settings.parentPinHash);
  const setPinHash = useStore((s) => s.setPinHash);
  const [ok, setOk] = useState(false);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [err, setErr] = useState('');

  if (ok) return <>{children}</>;

  if (!pinHash) {
    return (
      <div className="card narrow">
        <h2>Parent area</h2>
        <p>Set a 4-6 digit parent PIN to protect pause, exam-week settings, chapter edits and exports.</p>
        <form className="stack" onSubmit={async (e) => {
          e.preventDefault();
          if (!/^\d{4,6}$/.test(pin)) return setErr('Use 4 to 6 digits.');
          if (pin !== pin2) return setErr('The two PINs do not match.');
          setPinHash(await hashPin(pin));
          setOk(true);
        }}>
          <input type="password" inputMode="numeric" placeholder="New PIN" value={pin} onChange={(e) => setPin(e.target.value)} autoFocus />
          <input type="password" inputMode="numeric" placeholder="Repeat PIN" value={pin2} onChange={(e) => setPin2(e.target.value)} />
          {err && <p className="error">{err}</p>}
          <div className="row">
            <button className="btn primary">Set PIN</button>
            <button type="button" className="btn ghost" onClick={() => setOk(true)}>Skip for now</button>
            <button type="button" className="btn ghost" onClick={onCancel}>Back</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="card narrow">
      <h2>Parent area</h2>
      <form className="stack" onSubmit={async (e) => {
        e.preventDefault();
        if ((await hashPin(pin)) === pinHash) setOk(true);
        else { setErr('That PIN is not right.'); setPin(''); }
      }}>
        <input type="password" inputMode="numeric" placeholder="Parent PIN" value={pin} onChange={(e) => setPin(e.target.value)} autoFocus />
        {err && <p className="error">{err}</p>}
        <div className="row">
          <button className="btn primary">Unlock</button>
          <button type="button" className="btn ghost" onClick={onCancel}>Back</button>
        </div>
      </form>
    </div>
  );
}
