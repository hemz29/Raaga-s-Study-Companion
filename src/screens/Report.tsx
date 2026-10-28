import { useState } from 'react';
import type { DateKey } from '../types';
import { useStore } from '../store';
import { config } from '../config';
import { prettyDay, todayKey } from '../engine/dates';
import { buildReport } from '../engine/report';
import { topMistake } from '../engine/insights';
import { recallScore } from '../engine/recall';
import { spentOn } from '../engine/rewards';
import { chapterTitle, moodOf, MOOD_LABEL, subjectById, tomorrowRecallTopics } from '../store/selectors';
import { lines } from '../lib/voice';
import { play } from '../lib/sound';
import { Bubble } from '../components/Bubble';

export function Report({ date, onDone, onBack }: { date: DateKey; onDone: () => void; onBack?: () => void }) {
  const s = useStore();
  const session = s.sessions[date];
  const [note, setNote] = useState(session?.reportNote ?? '');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  if (!session) return null;
  const blocks = session.blockIds.map((id) => s.blocks[id]).filter(Boolean);
  const cat = (id: string) => config.mistakeCategories.find((c) => c.id === id)?.label ?? id;
  const top = topMistake(s.mistakes);
  const report = buildReport({
    name: s.profile!.name,
    dateLabel: prettyDay(date),
    blocks: blocks.map((b) => ({ subject: subjectById(s, b.subjectId)?.name ?? b.subjectId, chapter: chapterTitle(s, b.chapterId), minutes: b.minutes, exerciseTypes: b.exerciseTypes })),
    mistakes: s.mistakes.filter((m) => m.date === date).map((m) => ({ category: cat(m.category), note: m.note, subject: subjectById(s, m.subjectId)?.name ?? '' })),
    recallScore: session.recallDone && session.recall?.length ? recallScore(session.recall) : null,
    recallCount: session.recall?.length ?? 0,
    tomorrowRecall: tomorrowRecallTopics(s, date),
    creatureName: s.creature.name,
    stageName: config.stages.find((x) => x.id === s.creature.stage)!.name,
    moodLabel: MOOD_LABEL[moodOf(s, todayKey())],
    playEarned: session.playEarned,
    playUsed: spentOn(s.ledger, date),
    lightDay: session.lightDay,
    topMistake: top ? `${top.label} (${top.count}×)` : undefined,
    note,
  });

  const send = async () => {
    setStatus('sending');
    try {
      const res = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-report-secret': import.meta.env.VITE_REPORT_SHARED_SECRET ?? '' },
        body: JSON.stringify({ subject: report.subject, text: report.text, date }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Server said ${res.status}`);
      s.markReportSent(date, note);
      setStatus('sent');
      play('sparkle');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div className="page"><div className="card narrow center">
        <Bubble tone="cheer">{lines.reportSent}</Bubble>
        <button className="btn primary big" onClick={onDone} autoFocus>Done</button>
      </div></div>
    );
  }

  return (
    <div className="page">
      <div className="card narrow">
        <p className="kicker">Tell Mum how {date === todayKey() ? 'today' : prettyDay(date)} went</p>
        <p className="muted">Here's exactly what will be sent. Nothing else leaves your laptop.</p>
        <pre className="report-preview">{report.text}</pre>
        <label className="field">
          <span>Add a note of your own (optional)</span>
          <input value={note} maxLength={280} onChange={(e) => { setNote(e.target.value); s.setReportNote(date, e.target.value); }} placeholder="e.g. Fractions finally clicked!" />
        </label>
        {status === 'error' && (
          <div className="hint">
            <p>It didn't send ({error}). You can try again, or copy it and send it yourself.</p>
            <div className="row">
              <button className="btn small" onClick={() => navigator.clipboard.writeText(`${report.subject}\n\n${report.text}`)}>Copy text</button>
              <a className="btn small" href={`mailto:?subject=${encodeURIComponent(report.subject)}&body=${encodeURIComponent(report.text)}`}>Open in email app</a>
              <button className="btn small ghost" onClick={() => { s.markReportSent(date, note); onDone(); }}>I sent it myself</button>
            </div>
          </div>
        )}
        <div className="row">
          <button className="btn primary big" disabled={status === 'sending'} onClick={send}>{status === 'sending' ? 'Sending…' : 'Send to Mum'}</button>
          {onBack && <button className="btn ghost" onClick={onBack}>Back</button>}
        </div>
      </div>
    </div>
  );
}
