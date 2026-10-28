import { useStore } from '../store';

// Every sound is synthesised with Web Audio: no audio files, nothing to license.
let ctx: AudioContext | null = null;
function ac() {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.15) {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.05);
}

const SOUNDS = {
  start: () => { tone(523, 0, 0.3); tone(784, 0.12, 0.5); },
  end: () => { tone(784, 0, 0.4, 'triangle'); tone(659, 0.18, 0.4, 'triangle'); tone(1047, 0.36, 0.8, 'triangle'); },
  break: () => { tone(440, 0, 0.5, 'sine', 0.1); tone(554, 0.25, 0.6, 'sine', 0.1); },
  accept: () => { tone(880, 0, 0.12, 'triangle', 0.1); tone(1320, 0.07, 0.18, 'triangle', 0.08); },
  nudge: () => { tone(330, 0, 0.18, 'sine', 0.08); tone(294, 0.12, 0.25, 'sine', 0.08); },
  sparkle: () => { [1047, 1319, 1568, 2093, 2637].forEach((f, i) => tone(f, i * 0.06, 0.35, 'sine', 0.07)); },
  crack: () => { tone(180, 0, 0.08, 'square', 0.06); tone(120, 0.05, 0.1, 'square', 0.05); },
  hatch: () => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, i * 0.11, 0.9, 'triangle', 0.09)); },
  unlock: () => { [392, 523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.5, 'triangle', 0.1)); },
};

export type SoundName = keyof typeof SOUNDS;

export function play(name: SoundName) {
  if (useStore.getState().settings.muted) return;
  try { SOUNDS[name](); } catch { /* audio unavailable */ }
}
