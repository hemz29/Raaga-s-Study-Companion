# Raaga's Study Companion

A laptop-first, installable web app (PWA) that helps Raaga (Grade 6, ICSE) build a consistent, careful study habit on her own. She builds her plan and studies from her own books. The app is the coach and the game layer: finished study blocks and an honest written log grow a magical creature and earn play time in creative rooms.

**The app does not teach content.** It makes her show up, focus, work carefully and remember.

## What's in v1

| Area | What it does |
| --- | --- |
| First run | Greets Raaga, she picks a world (Emberwick Academy, Lumenwood Sanctuary, The Drift Isles) and receives an egg |
| Plan builder | 10 subjects with chapters, In portion / Probably / Not in portion, test dates, an auto-spread draft plan (max 3 blocks/day, Maths daily, memory-subject revision touches, light language touches, Sunday boss fight), drag-to-adjust (moved blocks survive a re-spread), and a read-only or printable "Want Mum to take a look?" view |
| Daily session | Recall quiz if due, then pick up to 3 blocks (free swaps), a detective briefing before practice blocks, 25-min focus timer (pause allowed, abandoning doesn't count), 5-min breaks, then wrap-up |
| The gate | 5 takeaways per block (3 on a light day), each ≥ 6 words with a concrete anchor (name, number/year, place, "because", unit, or a chapter key term). No pasting, no repeats or near-duplicates. Gentle creature coaching when a point is vague. Exercise-type log. Optional "Quiz me on this" with her own Q&A |
| Mistake log | Five categories (config file), a note of at least 5 words, bonus play time and GP (capped), rare cosmetics, and a "which slip costs you most" notebook |
| Recall | Spaced intervals of 1, 3, 7 and 21 days. Her own questions or auto fill-in-the-blank. Answer first, then self-rate Got it / Nearly / Missed it. Memory-heavy subjects are weighted higher |
| Creature | Egg → Hatchling → Juvenile → Teen → Adult → Mythic via Growth Points. Hatches after the first 2 gated blocks with a full crack-and-reveal sequence. Trait wheel. A 5-of-7 rolling consistency window. Missed days only make it sleepy, and GP is never lost |
| Rewards | 15 min base + bonus block + mistakes + strong recall, with a 40 min daily ceiling and 1-day carry-over. The art studio opens at hatch (brushes, palette, undo/redo, gallery, pin to home, replace the creature art per stage with her drawings) |
| Light days, swaps, pause | 1 light-day token per week (unused week → bonus GP), avoidance nudge after 3 swaps away from a subject, PIN-protected parent pause, exam-week light-day setting |
| Report | "Tell Mum how today went": she sees the exact text, can add a note, and it's sent through a Vercel function. Unsent reports make the creature sleepy and it reminds her |
| Data | Everything in IndexedDB on her laptop. JSON backup/restore and CSV exports in the parent area. No accounts, analytics, third-party scripts, web fonts or AI |

Phase-2 rooms (music corner, chess, runner) appear as locked teasers.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # rules-engine unit tests (vitest)
npm run build      # typecheck + production build with service worker
```

The report button needs the serverless function, which only runs on Vercel (or `vercel dev`). Locally it fails gracefully and offers "Copy text" / "Open in email app".

## Deploy (Vercel)

1. Import this repo in Vercel. The defaults work: framework Vite, build `npm run build`, output `dist`.
2. Create a free [Resend](https://resend.com) account and an API key.
3. In **Vercel → Project → Settings → Environment Variables**, add:
   - `RESEND_API_KEY`: the Resend key
   - `PARENT_EMAIL`: the parent's address (**set only here, never committed**)
   - `REPORT_SHARED_SECRET`: any random string
   - `VITE_REPORT_SHARED_SECRET`: the same string (used by the browser build)
   - optional `REPORT_FROM_EMAIL`: a sender on a domain verified in Resend. Without it, Resend's test sender `onboarding@resend.dev` is used, which only delivers to the email address that owns the Resend account.
4. Redeploy, open the site in Chrome or Edge on Raaga's laptop, and use **Install app** in the address bar.

The function (`api/send-report.ts`) always sends to `PARENT_EMAIL`, never to an address from the request, checks the shared-secret header, limits size and rate-limits per instance.

## Tuning

All game numbers (GP values, stage thresholds, play-time scale, recall intervals, block lengths, mistake categories, exercise types) are in [`src/config/config.json`](src/config/config.json). Change them after the trial week and redeploy.

## Chapter lists

`src/data/subjects.json` is currently a **draft** based on the typical ICSE Grade 6 syllabus. See [docs/SEED_DATA.md](docs/SEED_DATA.md) to replace it with Raaga's actual textbook contents. The parent area can also edit chapters in-app.

## Project layout

```
api/send-report.ts      Vercel function that emails the daily report
src/engine/             Pure TypeScript rules engine (tested): takeaways, recall, planner, rewards, creature, report
src/store/              Zustand store persisted to IndexedDB + derived selectors
src/screens/            Setup, Home, Plan, Session, Report, Rooms, Art, Notebook, Parent
src/components/         Creature art, celebration, trait wheel, mistake logger, PIN gate…
src/config/config.json  Every tunable value
src/data/subjects.json  Subjects and chapters (draft)
docs/                   Seed-data workflow and the manual test script
```

## Privacy

No accounts, no analytics, no third-party scripts or fonts, no AI. All data stays in the browser on Raaga's laptop. The only outbound data is the daily report she reviews and chooses to send. Clearing browser data erases progress, so use **Parent → Download backup** regularly.
