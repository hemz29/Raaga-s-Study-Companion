import { useCallback, useEffect, useRef, useState } from 'react';
import type { StageId } from '../types';
import { useStore } from '../store';
import { config } from '../config';
import { todayKey } from '../engine/dates';
import { stageIndex } from '../engine/creature';
import { balanceOf } from '../store/selectors';
import { deleteImage, putImage } from '../lib/db';
import { useImage } from '../lib/useImage';
import { uid } from '../engine/planner';
import { lines } from '../lib/voice';
import { play } from '../lib/sound';
import { Bubble } from '../components/Bubble';
import type { Screen } from '../App';

type Brush = 'pen' | 'pencil' | 'marker' | 'eraser' | 'spray' | 'glow' | 'rainbow';
const BRUSHES: { id: Brush; label: string; stage: StageId }[] = [
  { id: 'pen', label: 'Pen', stage: 'hatchling' },
  { id: 'pencil', label: 'Pencil', stage: 'hatchling' },
  { id: 'marker', label: 'Marker', stage: 'hatchling' },
  { id: 'eraser', label: 'Eraser', stage: 'hatchling' },
  { id: 'spray', label: 'Spray', stage: 'juvenile' },
  { id: 'glow', label: 'Glow', stage: 'teen' },
  { id: 'rainbow', label: 'Rainbow', stage: 'adult' },
];
const BASE_COLORS = ['#1b1b1f', '#ffffff', '#e63946', '#f4a261', '#f6d55c', '#2a9d8f', '#3a86ff', '#8338ec', '#ff5fa2', '#8d5524', '#6ab04c', '#9aa0a6'];
const EXTRA_COLORS = ['#00b4d8', '#ffb4a2', '#cdb4db', '#b5e48c', '#ffd6a5', '#3d405b'];
const W = 960, H = 640;

export function ArtRoom({ go }: { go: (s: Screen) => void }) {
  const s = useStore();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [brush, setBrush] = useState<Brush>('pen');
  const [color, setColor] = useState('#1b1b1f');
  const [size, setSize] = useState(8);
  const [undo, setUndo] = useState<ImageData[]>([]);
  const [redo, setRedo] = useState<ImageData[]>([]);
  const [timeUp, setTimeUp] = useState(false);
  const [tab, setTab] = useState<'draw' | 'gallery'>('draw');
  const [saved, setSaved] = useState(false);
  const drawing = useRef<{ x: number; y: number } | null>(null);
  const hue = useRef(0);
  const stageIdx = stageIndex(s.creature.stage);
  const brushes = BRUSHES.filter((b) => stageIndex(b.stage) <= stageIdx);
  const colors = stageIdx >= stageIndex('juvenile') ? [...BASE_COLORS, ...EXTRA_COLORS] : BASE_COLORS;

  // Play-time meter: one minute is spent for each minute in the room.
  const [secs, setSecs] = useState(0);
  const balance = balanceOf(s, todayKey());
  useEffect(() => {
    if (timeUp) return;
    const t = setInterval(() => setSecs((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [timeUp]);
  useEffect(() => {
    if (secs > 0 && secs % 60 === 0) s.spendPlay(1, 'art');
  }, [secs]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (balance <= 0 && !timeUp) { setTimeUp(true); play('break'); }
  }, [balance, timeUp]);
  const leftSec = balance * 60 - (secs % 60);

  useEffect(() => {
    const ctx = canvas.current!.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
  }, []);

  const ctx = () => canvas.current!.getContext('2d')!;
  const snapshot = useCallback(() => {
    setUndo((u) => [...u.slice(-29), ctx().getImageData(0, 0, W, H)]);
    setRedo([]);
    setSaved(false);
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const stroke = (from: { x: number; y: number }, to: { x: number; y: number }, pressure: number) => {
    const c = ctx();
    c.save();
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.globalCompositeOperation = 'source-over';
    let col = color, width = size * (0.5 + pressure);
    if (brush === 'eraser') { col = '#ffffff'; width = size * 2; }
    if (brush === 'pencil') { width = Math.max(1, size / 3); c.globalAlpha = 0.7; }
    if (brush === 'marker') { width = size * 2.2; c.globalAlpha = 0.35; }
    if (brush === 'glow') { c.shadowColor = color; c.shadowBlur = size * 2; }
    if (brush === 'rainbow') { hue.current = (hue.current + 4) % 360; col = `hsl(${hue.current} 90% 55%)`; }
    if (brush === 'spray') {
      c.fillStyle = col;
      for (let i = 0; i < size * 3; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * size * 2;
        c.fillRect(to.x + Math.cos(a) * r, to.y + Math.sin(a) * r, 1.5, 1.5);
      }
    } else {
      c.strokeStyle = col;
      c.lineWidth = width;
      c.beginPath();
      c.moveTo(from.x, from.y);
      c.lineTo(to.x, to.y);
      c.stroke();
    }
    c.restore();
  };

  const doUndo = () => {
    const last = undo.at(-1);
    if (!last) return;
    setRedo((r) => [...r, ctx().getImageData(0, 0, W, H)]);
    ctx().putImageData(last, 0, 0);
    setUndo((u) => u.slice(0, -1));
  };
  const doRedo = () => {
    const last = redo.at(-1);
    if (!last) return;
    setUndo((u) => [...u, ctx().getImageData(0, 0, W, H)]);
    ctx().putImageData(last, 0, 0);
    setRedo((r) => r.slice(0, -1));
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const save = async () => {
    const id = uid('art');
    await putImage(id, canvas.current!.toDataURL('image/png'));
    s.addGalleryItem(id);
    setSaved(true);
    play('sparkle');
  };

  return (
    <div className="page art-room">
      <div className="row between wrap">
        <h1>Art studio</h1>
        <div className="row">
          <span className="pill strong" aria-live="polite">{Math.max(0, Math.floor(leftSec / 60))} min left</span>
          <div className="tabs">
            <button className={tab === 'draw' ? 'on' : ''} onClick={() => setTab('draw')}>Canvas</button>
            <button className={tab === 'gallery' ? 'on' : ''} onClick={() => setTab('gallery')}>Gallery ({s.gallery.length})</button>
          </div>
          <button className="btn ghost" onClick={() => go('rooms')}>Leave</button>
        </div>
      </div>

      <div hidden={tab !== 'draw'}>
        <div className="toolbar">
          <div className="seg">
            {brushes.map((b) => <button key={b.id} className={brush === b.id ? 'on' : ''} onClick={() => setBrush(b.id)}>{b.label}</button>)}
          </div>
          <div className="palette">
            {colors.map((c) => (
              <button key={c} aria-label={`Colour ${c}`} className={`swatch ${color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => { setColor(c); if (brush === 'eraser') setBrush('pen'); }} />
            ))}
            <input type="color" aria-label="Custom colour" value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
          <label className="row small">Size <input type="range" min={1} max={40} value={size} onChange={(e) => setSize(+e.target.value)} /></label>
          <div className="row">
            <button className="btn small" onClick={doUndo} disabled={!undo.length}>Undo</button>
            <button className="btn small" onClick={doRedo} disabled={!redo.length}>Redo</button>
            <button className="btn small" onClick={() => { snapshot(); const c = ctx(); c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); }}>Clear</button>
            <button className="btn small primary" onClick={save} disabled={saved}>{saved ? 'Saved ✓' : 'Save to gallery'}</button>
          </div>
        </div>
        <canvas
          ref={canvas}
          width={W}
          height={H}
          className="art-canvas"
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); snapshot(); const p = pos(e); drawing.current = p; stroke(p, p, e.pressure || 0.5); }}
          onPointerMove={(e) => { if (!drawing.current) return; const p = pos(e); stroke(drawing.current, p, e.pressure || 0.5); drawing.current = p; }}
          onPointerUp={() => { drawing.current = null; }}
          onPointerLeave={() => { drawing.current = null; }}
        />
        {stageIdx < stageIndex('juvenile') && <p className="muted small">New brushes and colours appear as your creature evolves.</p>}
      </div>

      {tab === 'gallery' && <Gallery />}

      {timeUp && (
        <div className="overlay">
          <div className="modal center">
            <Bubble>{lines.timeUp}</Bubble>
            <div className="row center-row">
              {!saved && <button className="btn" onClick={async () => { await save(); go('home'); }}>Save my picture and go</button>}
              <button className="btn primary" onClick={() => go('home')}>Back home</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Gallery() {
  const s = useStore();
  const [designFor, setDesignFor] = useState<string | null>(null);
  const stages = config.stages.filter((x) => x.id !== 'egg');

  const upload = async (file: File) => {
    const dataUrl = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(file); });
    const id = uid('art');
    await putImage(id, dataUrl);
    s.addGalleryItem(id);
  };

  return (
    <div className="stack">
      <div className="card">
        <h3>Design your creature</h3>
        <p className="muted small">Pick any drawing from your gallery to replace the placeholder creature art for a stage. Placeholders stay until you do.</p>
        <div className="row wrap">
          {stages.map((st) => (
            <div key={st.id} className="stage-slot">
              <strong>{st.name}</strong>
              <StageThumb id={s.creature.customArt[st.id]} />
              {s.creature.customArt[st.id] && <button className="btn ghost small" onClick={() => s.setCustomArt(st.id)}>Use placeholder</button>}
            </div>
          ))}
        </div>
        <label className="btn small">Upload a drawing <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
      </div>
      {!s.gallery.length && <p className="muted">Your saved drawings will appear here.</p>}
      <div className="gallery-grid">
        {s.gallery.map((g) => (
          <div key={g.id} className="card gallery-item">
            <StageThumb id={g.id} big />
            <div className="row wrap">
              <button className="btn small" onClick={() => s.togglePin(g.id)}>{g.pinned ? '📌 Pinned at home' : 'Pin at home'}</button>
              <button className="btn small" onClick={() => setDesignFor(designFor === g.id ? null : g.id)}>Use for creature…</button>
              <button className="btn small ghost" onClick={async () => { await deleteImage(g.id); s.removeGalleryItem(g.id); }}>Delete</button>
            </div>
            {designFor === g.id && (
              <div className="row wrap">
                {stages.map((st) => <button key={st.id} className="btn small" onClick={() => { s.setCustomArt(st.id, g.id); setDesignFor(null); play('unlock'); }}>{st.name}</button>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StageThumb({ id, big }: { id?: string; big?: boolean }) {
  const src = useImage(id);
  return src ? <img src={src} alt="" className={big ? 'thumb big' : 'thumb'} /> : <div className={`thumb empty ${big ? 'big' : ''}`}>placeholder</div>;
}
