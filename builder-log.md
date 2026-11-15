# builder log — 404-chess-notation

Append-only. One line per decision: what was chosen, and what it beat.

2026-11-15 Cloned mattjliu/Notation-Trainer (946 world-championship PGNs, 944 parsed) as the position source instead of writing new games data — real positions already classified by move type.
2026-11-15 Replaced react-scripts 3.4.1 (CRA, webpack 4) with Vite 5 + React 18 — CRA cannot build on Node 26 (openssl legacy, dead webpack 4); Vite build is 270ms and one config file.
2026-11-15 Wrote a 60-line board component instead of keeping chessboardjsx — chessboardjsx is unmaintained since 2020 and fights React 18; our board also needs marked/ hit/ target states and click-to-move.
2026-11-15 Click-to-move drill instead of drag-and-drop — drag adds motor work to a reading exercise and hides which square was chosen; click also works one-handed on a phone.
2026-11-15 Precomputed drill pools at build time (scripts/build-drills.mjs → src/data/drills.json, 241KB) instead of parsing PGN in the browser — parsing 944 games on load costs seconds and blocks first paint.
2026-11-15 Daily set = deterministic 7-day theme rotation seeded by the date, not a random set — the same link is always the same practice, so a reminder bot can deep-link a day and repetition builds recognition.
2026-11-15 Adaptive block: weakest drill type (<75% lifetime accuracy) gets 4-6 extra reps appended, and the coach card says why — beats a fixed syllabus because it follows the actual error profile.
2026-11-15 Streak counts answered reps (goal 10/day), not perfect answers, and wrong reps requeue at the end of the set — a punitive streak dies in week one; this one survives a bad day.
2026-11-15 Progress in localStorage with a base64 export code, no accounts — a static Vercel site is the whole backend; the export code is what lets a bot verify a streak.
2026-11-15 coach-feed.json + ?theme= deep link for overrides instead of an API — an LLM can pin tomorrow's set by editing one JSON file, or skip deploying entirely with a query param.
2026-11-15 public/llms.txt as the reminder contract instead of a cron service — any assistant with a scheduler (Muse, Grok) can run the daily nudge; no OAuth, no tokens, no server to keep alive.
2026-11-15 Four drill kinds only (grid, knight, read, play) — more variety tested worse: the three reading tricks map 1:1 onto the drills, which is the point of the app.
2026-11-15 Deployed to Vercel as chess-notation-coach (static, no framework preset) — GitHub Pages of the fork would not be under this account's control and gh-pages adds a branch dance.
2026-11-15 Adopted Refero Styles' Linear "midnight precision instrument" DESIGN.md as the visual system (void #08090a, paper type at -0.022em, hairline borders instead of shadows, one acid-lime #e4f222 primary per view) — beat keeping the ad-hoc green/amber theme because the token set was written for exactly this kind of dense tool UI and the single-accent rule stops the board highlights competing with buttons.
2026-11-15 Board recoloured monochrome (mist light squares, smoke dark squares) with -webkit-text-stroke piece outlines and lime highlight rings — beat the classic green chess board because a saturated board fights the one-primary-action rule; outline stroke beats shadow-only for white-on-light contrast.
2026-11-15 Logo and hero generated with google/gemini-nano-banana-2.1 via OpenRouter, two logo passes, picked the flat orthographic 8x8 grid over the perspective one — beat stock art because the icon has to carry the app palette and no third-party licence.
2026-11-15 Homepage "Give this to your AI" block: big editable monospace prompt with copy buttons, draft persisted in localStorage — beats only linking llms.txt because Muse/Grok users paste a prompt into a chat, they do not read a spec file.
2026-11-15 Inter loaded from rsms.me with system-ui fallback — beat bundling font files: one line, no build step, and the app still reads fine offline.
2026-11-15 Hero gradient overlay doubles as text scrim (void to transparent left-to-right) so the headline sits on the image without a separate panel — beats putting the art in a side column, which pushed the set details below the fold on phones.