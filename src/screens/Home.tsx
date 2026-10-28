import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { config } from '../config';
import { todayKey, prettyDay } from '../engine/dates';
import { nextStage, stageProgress } from '../engine/creature';
import { topMistake, varietyNudge } from '../engine/insights';
import {
  balanceOf, consistencyFor, daysToTest, gateStatus, lightTokenAvailable, moodOf, MOOD_LABEL, unsentReportDay,
} from '../store/selectors';
import { Creature } from '../components/Creature';
import { Bubble } from '../components/Bubble';
import { ConsistencyDots } from '../components/ConsistencyDots';
import { TraitWheel } from '../components/TraitWheel';
import { MistakeLogger } from '../components/MistakeLogger';
import { lines } from '../lib/voice';
import { WORLDS } from '../lib/worlds';
import { useImage } from '../lib/useImage';
import type { Screen } from '../App';

export function Home({ go }: { go: (s: Screen) => void }) {
  const s = useStore();
  const today = todayKey();
  const profile = s.profile!;
  const c = s.creature;
  const mood = moodOf(s, today);
  const cons = consistencyFor(s, today);
  const gate = gateStatus(s, today);
  const balance = balanceOf(s, today);
  const session = s.sessions[today];
  const unsentPast = unsentReportDay(s, today);
  const nudge = varietyNudge(Object.values(s.blocks), today);
  const top = topMistake(s.mistakes);
  const next = nextStage(c.stage);
  const toTest = daysToTest(s, today);
  const [mistakeOpen, setMistakeOpen] = useState(false);
  const pinned = s.gallery.filter((g) => g.pinned).slice(0, 3);
  const planToday = s.plan.days[today] ?? [];
  const careful = Object.values(s.sessions).reduce((a, x) => a + x.briefingsDone, 0);

  useEffect(() => { s.prepareRecall(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  let say = c.stage === 'egg' ? lines.eggGreet(profile.name) : lines.greet(profile.name, mood);
  let tone: 'normal' | 'nudge' | 'cheer' = 'normal';
  if (unsentPast) { say = lines.reportReminderPast; tone = 'nudge'; }
  else if (session?.blockIds.length && !session.reportSent && gate.passed) { say = lines.reportReminder; tone = 'nudge'; }

  const studied = (session?.blockIds.length ?? 0) > 0;

  return (
    <div className="home">
      <section className="home-creature card">
        <p className="kicker">{WORLDS[profile.world].name} · {WORLDS[profile.world].home}</p>
        <Bubble tone={tone}>{say}</Bubble>
        <Creature stage={c.stage} world={profile.world} mood={mood} size={260} cosmetics={c.cosmetics} customArtId={c.customArt[c.stage]} />
        <h2 className="creature-name">{c.name ?? (c.stage === 'egg' ? 'Mystery egg' : 'Your creature')}</h2>
        <p className="muted">{config.stages.find((x) => x.id === c.stage)?.name} · {MOOD_LABEL[mood]} · {c.gp} GP</p>
        {next && (
          <div className="progress" aria-label={`Progress to ${next.name}`}>
            <div className="progress-bar" style={{ width: `${Math.round(stageProgress(c.gp, c.stage) * 100)}%` }} />
            <span>{c.stage === 'egg' ? `Hatches after ${config.hatchAfterBlocks} finished blocks` : `${next.gp - c.gp} GP to ${next.name}`}</span>
          </div>
        )}
        {pinned.length > 0 && <div className="pinned">{pinned.map((g) => <PinnedArt key={g.id} id={g.id} />)}</div>}
      </section>

      <section className="home-side">
        <div className="card today">
          <div className="row between">
            <h2>Today · {prettyDay(today)}</h2>
            {toTest !== undefined && <span className="pill">{toTest === 0 ? 'Test today!' : `${toTest} days to test`}</span>}
          </div>
          {s.settings.paused ? (
            <p>Everything is paused. Your creature is peacefully asleep, and nothing counts against you.</p>
          ) : s.activeBlock ? (
            <button className="btn primary big" onClick={() => go('session')}>Continue your block</button>
          ) : (
            <>
              <p className="muted">
                {studied
                  ? `${session!.blockIds.length} block${session!.blockIds.length > 1 ? 's' : ''} done today.`
                  : planToday.length ? `Your plan has ${planToday.length} block${planToday.length > 1 ? 's' : ''} for today.` : 'No plan for today yet. You can still pick subjects.'}
              </p>
              <button className="btn primary big" onClick={() => go('session')}>{studied ? 'Back to my session' : "Start today's session"}</button>
            </>
          )}
          {nudge && <p className="hint">💡 {nudge}</p>}
          {unsentPast && <button className="btn" onClick={() => go('report-past')}>Tell Mum about {prettyDay(unsentPast)}</button>}
        </div>

        <div className="card">
          <div className="row between">
            <h3>Play time</h3>
            <span className="pill strong">{balance} min</span>
          </div>
          {c.stage === 'egg'
            ? <p className="muted">Rooms open when your egg hatches.</p>
            : gate.passed
              ? <p className="muted">Gate passed. Your rooms are open.</p>
              : <ul className="todo">{gate.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
          <button className="btn" onClick={() => go('rooms')}>Go to rooms</button>
        </div>

        <div className="card">
          <h3>Consistency</h3>
          <ConsistencyDots c={cons} />
          <p className="muted small">5 of 7 days keeps your creature bright. Missed days only make it sleepy. You never lose GP.</p>
          <div className="row between">
            <span>{lightTokenAvailable(s, today) ? <span className="token">✨ Light-day token ready</span> : <span className="muted small">Light-day token used this week</span>}</span>
          </div>
        </div>

        <div className="card">
          <div className="row between">
            <h3>Detective's notebook</h3>
            <button className="btn small" onClick={() => setMistakeOpen(true)}>I caught a mistake</button>
          </div>
          <p className="muted small">{careful} careful-habit briefing{careful !== 1 && 's'} done · {s.mistakes.length} mistake{s.mistakes.length !== 1 && 's'} caught</p>
          {top ? <p>Your sneakiest slip so far: <strong>{top.icon} {top.label}</strong> ({top.count}×)</p> : <p className="muted">No mistakes caught yet. Catching one earns bonus play time!</p>}
          <button className="btn ghost small" onClick={() => go('insights')}>Open notebook</button>
        </div>

        {c.stage !== 'egg' && (
          <div className="card center">
            <h3>Trait wheel</h3>
            <TraitWheel subjects={s.subjects} traits={c.traits} />
          </div>
        )}
      </section>
      {mistakeOpen && <MistakeLogger onClose={() => setMistakeOpen(false)} />}
    </div>
  );
}

function PinnedArt({ id }: { id: string }) {
  const src = useImage(id);
  return src ? <img src={src} alt="Pinned artwork" className="pinned-art" /> : null;
}
