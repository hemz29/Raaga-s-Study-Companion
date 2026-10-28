# Seeding the real chapter lists

The app ships with a draft chapter list (`src/data/subjects.json`) based on the typical ICSE Grade 6 syllabus. Replace it with Raaga's actual textbooks before the trial.

1. Photograph each textbook's contents page, one image per subject (or per book if History & Civics and Geography are separate books), named by subject: `maths.jpg`, `history.jpg`, `geography.jpg`, `biology.jpg`, `physics.jpg`, `chemistry.jpg`, `computers.jpg`, `english-lang.jpg`, `english-lit.jpg`, `second-lang.jpg`.
2. Put them in a `seed-photos/` folder at the repo root. It is git-ignored, so photos are never committed.
3. Ask Claude Code: *"Transcribe the contents pages in seed-photos/ into the subject lists in scripts/gen-subjects.mjs, then run it."* Mark long chapters with `weight: 2` if you like.
4. Run `node scripts/gen-subjects.mjs` to regenerate `src/data/subjects.json`.
5. Hema reviews the lists once, then sets `"reviewed": true` in the generated file (or ticks **Parent → Chapter lists → I've reviewed** in the app).

Notes:
- Subject `kind` drives planning: `maths` (daily practice), `memory` (History, Geography, Biology: frequent short revision and heavier recall weighting), `language` (light touches 2–3 times a week), `science` / `other` (rotation).
- If Raaga has already started using the app, chapter edits are easier in **Parent → Chapter lists**. The seed file only applies to a fresh install.
- If the second language isn't Hindi, rename it in the seed or in the parent area.
