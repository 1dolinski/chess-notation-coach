# Notation Coach

Daily chess-notation practice with AI-assigned sets and a streak counter.

Built on [Notation-Trainer](https://github.com/mattjliu/Notation-Trainer) by **Matthew Liu**
([@mattjliu](https://github.com/mattjliu), MIT, 2020) — the original React notation trainer this fork grew out of.
The 944 world championship games (1886–2018) and the board/notation groundwork are his; the daily sets, adaptive
coach, streak tracking, drill variety and AI reminder contract are new here. See [Credits](#credits).

Live: https://chess-notation-coach.vercel.app/
Source: https://github.com/1dolinski/chess-notation-coach (MIT)

## What it does

- **One set per day.** Seven-day rotation of themes (grid, capture, knight, check, castle, full notation, speed),
  seeded by the date so the same link is always the same practice.
- **Adaptive coaching.** The weakest drill type (lifetime accuracy under 75%) gets extra reps appended, and the
  coach card explains why. Optional `src/data/coach-feed.json` lets an LLM/bot pin a day's headline and theme.
- **Seven drill kinds:** grid recall (click the named square; light or dark; or read the square out of real notation),
  knight fans (click every destination, every second rep blind), SAN reading in both directions, real board moves you
  execute by clicking, choose-the-notation (the move is highlighted, you pick the SAN), read-and-click (the notation is
  given, you click the destination), and mental geometry answered with no board at all — knight-move counts, which /
  NOT-which knight moves, total moves from a square, 2+1 vs 1+2 directions, rank/file distance, and
  "which square is 2 files right and 1 rank up?".
- **No repeats:** ~5,800 bundled positions and moves from 944 world championship games, grouped by kind so a theme day
  shows that kind of move, and the daily draw skips anything served on an earlier day (600-entry seen map). Measured
  over 60 simulated days: 5.4% of reps repeat, none in the first four.
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

The homepage carries a single-line prompt field holding `Read <site>/skill.txt and follow the instructions.`,
with the copy button inside the field and an "open the instructions" link underneath. It is editable and saves
to localStorage, so a user can name their own assistant or their own time without touching the app.

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
src/components/Session.jsx drill runner (all seven kinds + in-session review)
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

## Credits

- **Matthew Liu ([@mattjliu](https://github.com/mattjliu)) — [Notation-Trainer](https://github.com/mattjliu/Notation-Trainer), MIT.**
  The original app this is forked from, and the source of the 946 PGN files (944 parsed) from world championship
  games 1886–2018 that every drill position comes from. The copyright notice in [LICENSE](LICENSE) is his.
- **World championship games** — the PGN corpus shipped in the original repo; positions and moves are quoted from
  real games, so the drill material is historical record rather than invented.
- Everything else (daily set builder, adaptive coach, seven drill kinds, streak/heatmap, review, `skill.txt`) is
  this fork's work, released under the same MIT licence.

If you build on this, keep the upstream credit and the MIT notice — that is the whole ask of the licence.