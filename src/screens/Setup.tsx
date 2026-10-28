import { useState } from 'react';
import type { WorldId } from '../types';
import { useStore } from '../store';
import { WORLDS } from '../lib/worlds';
import { Creature } from '../components/Creature';
import { play } from '../lib/sound';

export function Setup() {
  const setupProfile = useStore((s) => s.setupProfile);
  const [step, setStep] = useState(0);
  const [world, setWorld] = useState<WorldId>();
  const name = 'Raaga';

  if (step === 0) {
    return (
      <div className="setup">
        <div className="card narrow center">
          <p className="kicker">A new adventure begins</p>
          <h1>Hello, {name}.</h1>
          <p className="big">This is your study companion. You make the plan, you do the work, and a creature grows because of it. Careful work opens rooms for art, music and games.</p>
          <p className="muted">First, pick the world your creature will live in. It only changes how things look, so pick the one you love.</p>
          <button className="btn primary big" onClick={() => setStep(1)} autoFocus>Choose my world</button>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="setup">
        <h1 className="center">Where will your creature live?</h1>
        <div className="world-grid">
          {(Object.keys(WORLDS) as WorldId[]).map((id) => (
            <button key={id} className={`world-card world-${id} ${world === id ? 'on' : ''}`} onClick={() => { setWorld(id); play('accept'); }}>
              <span className="world-tag">{WORLDS[id].tagline}</span>
              <h2>{WORLDS[id].name}</h2>
              <p>{WORLDS[id].description}</p>
            </button>
          ))}
        </div>
        <div className="center">
          <button className="btn primary big" disabled={!world} onClick={() => { setStep(2); play('unlock'); }}>This one</button>
        </div>
      </div>
    );
  }

  const w = WORLDS[world!];
  return (
    <div className={`setup world-${world}`}>
      <div className="card narrow center">
        <p className="kicker">{w.name}</p>
        <h1>You have received a {w.eggWord}.</h1>
        <Creature stage="egg" world={world!} wobble size={240} />
        <p className="big">It's warm, and something inside is humming. Finish two study blocks with honest notes and it will hatch.</p>
        <button className="btn primary big" onClick={() => { setupProfile(name, world!); play('start'); }} autoFocus>Take it to {w.home}</button>
      </div>
    </div>
  );
}
