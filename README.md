# Notation Coach

Daily chess-notation practice with AI-assigned sets and a streak counter.
Forked from [mattjliu/Notation-Trainer](https://github.com/mattjliu/Notation-Trainer) (MIT) — positions still come
from 944 world championship games (1886–2018); everything around them is new.

Live: https://chess-notation-coach.vercel.app/

## What it does

- **One set per day.** Seven-day rotation of themes (grid, capture, knight, check, castle, full notation, speed),
  seeded by the date so the same link is always the same practice.
- **Adaptive coaching.** The weakest drill type (lifetime accuracy under 75%) gets extra reps appended, and the
  coach card explains why. Optional `src/data/coach-feed.json` lets an LLM/bot pin a day's headline and theme.
- **Four drill kinds:** grid recall (click the named square; light or dark), knight fans (click every destination),
  SAN reading in both directions, and real board moves you execute by clicking.
- **Streak tracking:** a day banks once you answer 10 reps (configurable). Wrong answers still count and are
  repeated at the end of the set. 16-week heatmap, per-drill accuracy, base64 export code for moving progress
  between browsers or letting a bot verify it.
- **`/llms.txt`** — a complete reminder contract: drop it into Muse, Grok or any assistant with a scheduler and it
  sends the daily nudge with the right deep link, and reads a real streak from your export code.

## Look

Visual system: Refero Styles' **Linear — "midnight precision instrument"**
(https://styles.refero.design/style/90ce5883-bb24-4466-93f7-801cd617b0d1). Near-black substrate
(`#08090a`), paper-white type at tight tracking, hairline borders instead of shadows, and a single
acid-lime accent (`#e4f222`) reserved for one primary action per view. The board is monochrome
(mist / smoke) with lime highlight rings so it never competes with the buttons.

Logo and hero art were generated with `google/gemini-nano-banana-2.1` via OpenRouter and live in
`public/logo.png` (512px), `public/favicon.png`, `public/logo.jpg` and `public/hero.jpg`.

## Give this to your AI

The homepage carries a big editable prompt block — the daily-reminder contract in one paste — with
copy buttons for the prompt, `llms.txt` and the practice link. Editing it saves to localStorage.

## Run it

```
npm install
npm run dev      # http://localhost:5173
npm run build    # regenerates drills, syncs builder-log.txt, builds to dist/
npm run preview
```

## Structure

```
scripts/build-drills.mjs   PGN corpus -> src/data/drills.json (position pools per move type + SAN reading items)
scripts/sync-log.mjs       builder-log.md -> public/builder-log.txt
src/lib/daily.js           coach: theme rotation, adaptive extras, set builder
src/lib/store.js           localStorage day log, streak math, goal, export/import
src/components/Session.jsx drill runner (grid / knight / read / play)
src/components/Today.jsx   coach card, streak strip, start set
src/components/StreakPanel.jsx  heatmap, accuracy, goal, export code
src/data/coach-feed.json   optional per-date overrides for a reminder bot
public/llms.txt            bot instructions (reminders, streak decoding, overrides)
```

## Deep links

```
/#/today                     today's set
/#/day/2026-11-16            the set for a date (deterministic)
/#/day/2026-11-16?theme=check  force a theme for one session
/#/streak                    history and export code
```

Notation conventions, drill data and streak math are documented in `public/llms.txt`.