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
- **Five drill kinds:** grid recall (click the named square; light or dark), knight fans (click every destination,
  every second rep blind), SAN reading in both directions, real board moves you execute by clicking, and mental geometry
  questions answered with no board at all ("knight on b5 — how many of its moves land to the left?").
- **Board side is randomised:** every rep deterministically picks White or Black, and on Black the whole board turns
  around while the prompt stays in algebraic notation, so notation is read from both sides. Every second knight rep
  is blind — the square is named but not marked, so it has to be pictured. (No settings panel; the defaults live in
  the store so they survive a reload and travel inside the export code.)
- **Streak tracking:** a day banks once you answer 10 reps (configurable). Wrong answers still count and are
  repeated at the end of the set. 16-week heatmap, per-drill accuracy, base64 export code for moving progress
  between browsers or letting a bot verify it.
- **`/skill.txt`** — the whole reminder contract, written as instructions to an assistant. The homepage hands over one
  line (`Read <site>/skill.txt and follow the instructions.`) instead of a wall of text to copy. It is generated from
  `llms.txt` at build time so the two can never drift; `/llms.txt` is the same material for agents that land on it.

## Look

Visual system: Refero Styles' **Linear — "midnight precision instrument"**
(https://styles.refero.design/style/90ce5883-bb24-4466-93f7-801cd617b0d1), inverted to a light
substrate: white canvas, `#f7f7f8` cards, hairline `#e3e3e6` borders instead of shadows, and a single
acid-lime accent (`#e4f222` fill with dark ink) reserved for one primary action per view. Because acid
lime is invisible on white, rings, bars and heatmap fills use a darker `--lime-deep` (`#a3ac12`). The
board is a cool monochrome pair with those rings so it never competes with the buttons.

Logo and hero art were generated with `google/gemini-nano-banana-2.1` via OpenRouter and live in
`public/logo.png` (512px), `public/favicon.png`, `public/logo.jpg` and `public/hero.jpg`.

## Give this to your AI

The homepage carries a big editable prompt block holding one line — `Read <site>/skill.txt and follow the
instructions.` — with copy buttons for the prompt, `skill.txt` and the practice link. Editing it saves to
localStorage, so a user can name their own assistant or their own time without touching the app.

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