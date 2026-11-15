// The coach: turns the date + your history into one practice set per day.
// Deterministic (same date => same set), adaptive (weak area gets extra reps).
import drills from '../data/drills.json'
import feed from '../data/coach-feed.json'
import { typeStats, lastPracticed, shiftDay, todayKey } from './store'

export const FILES = 'abcdefgh'

export const THEMES = {
  grid: {
    label: 'Grid day',
    blurb: 'Files and ranks until squares become names, not coordinates.',
    tip: 'Trick 1: lock the four corners (a1, h1, a8, h8) and the centre (d4, e4, d5, e5) first.'
  },
  capture: {
    label: 'Capture day',
    blurb: 'The x in front of a target square is the single most-missed symbol.',
    tip: 'Read x as the word "takes", never as a separate symbol: Nxe5 = knight takes e5.'
  },
  knight: {
    label: 'Knight day',
    blurb: 'Knights are the fastest way to build automatic coordinate jumps.',
    tip: "Trick 2: a knight is always 2 files + 1 rank or 1 file + 2 ranks — learn the eight-square pattern once."
  },
  check: {
    label: 'Check day',
    blurb: 'Plus and hash change the whole meaning of the move.',
    tip: 'Read the tail of the move first: + means your king must answer, # means the game is over.'
  },
  castle: {
    label: 'Castle & promote',
    blurb: 'Two moves that look nothing like the rest of the notation.',
    tip: 'O-O is kingside (two squares), O-O-O is queenside (three). e8=Q is "promotes to queen".'
  },
  full: {
    label: 'Full notation day',
    blurb: 'Quiet moves, disambiguation, and the whole SAN grammar at once.',
    tip: 'Trick 3: read in chunks ("knight to f3"), never letter by letter.'
  },
  speed: {
    label: 'Speed day',
    blurb: 'Same moves, clock on. Recognition you can only do slowly is not recognition yet.',
    tip: 'Aim for under 4 seconds a move. Slowness here means the pattern is still being translated.'
  }
}

const ROTATION = ['grid', 'capture', 'knight', 'check', 'castle', 'full', 'speed']

function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function dayIndex(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}

export function themeFor(dateKey) {
  return ROTATION[dayIndex(dateKey) % ROTATION.length]
}

const KNIGHT_DELTAS = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]

// Knight moves with their direction deltas, used by the mental-geometry drills.
export function knightMoves(square) {
  const f = FILES.indexOf(square[0])
  const r = Number(square[1]) - 1
  return KNIGHT_DELTAS
    .map(([df, dr]) => {
      const nf = f + df
      const nr = r + dr
      if (nf < 0 || nf > 7 || nr < 0 || nr > 7) return null
      return { to: FILES[nf] + (nr + 1), df, dr }
    })
    .filter(Boolean)
}

export function knightTargets(square) {
  const f = FILES.indexOf(square[0])
  const r = Number(square[1]) - 1
  return KNIGHT_DELTAS
    .map(([df, dr]) => (f + df >= 0 && f + df < 8 && r + dr >= 0 && r + dr < 8) ? FILES[f + df] + (r + dr + 1) : null)
    .filter(Boolean)
}

function squareColor(square) {
  const f = FILES.indexOf(square[0])
  const r = Number(square[1]) - 1
  return (f + r) % 2 === 0 ? 'dark' : 'light'
}

function poolTasks(name, count, rng) {
  const pool = drills.pools[name] || []
  if (!pool.length) return []
  const start = Math.floor(rng() * pool.length)
  const out = []
  for (let i = 0; i < count; i++) out.push(pool[(start + i * 7) % pool.length])
  return out
}

function playItem(task, type, rng, idx) {
  return { id: `p${idx}-${task.san}-${task.to}`, kind: 'play', type, task }
}

function readItem(item, idx, reverse, rng) {
  const hasSquare = /[a-h][1-8]/.test(item.san)
  if (!reverse || !hasSquare) {
    return { id: `r${idx}-${item.san}`, kind: 'read', type: 'read', san: item.san, prompt: item.san, options: item.options, answer: item.answer, fen: item.fen }
  }
  // reverse: English prompt -> pick the SAN. Build distractors by mutating the real move.
  const san = item.san
  const randSq = () => FILES[Math.floor(rng() * 8)] + (1 + Math.floor(rng() * 8))
  const dest = san.match(/[a-h][1-8]/g) || []
  const last = dest[dest.length - 1]
  const variants = [
    san.replace(last, randSq()),
    san.replace(/^[NBRQK]/, ['N', 'B', 'R', 'Q'][Math.floor(rng() * 4)]),
    san.replace('x', '').replace('+', '')
  ]
  const options = [san, ...variants].filter((v, i, a) => a.indexOf(v) === i && v && v !== san.replace('x', '') && v !== '')
  while (options.length < 4) {
    const v = san.replace(last, randSq())
    if (!options.includes(v)) options.push(v)
  }
  const four = options.slice(0, 4)
  return {
    id: `r${idx}-${san}-rev`, kind: 'read', type: 'read',
    prompt: item.answer, options: four, answer: san, fen: item.fen
  }
}

function squareItems(dateKey, rng, count, startIdx) {
  // first reps are the anchors from trick #1, then random squares
  const anchors = ['a1', 'h8', 'e4', 'd5', 'h1', 'a8', 'd4', 'e5']
  const out = []
  for (let i = 0; i < count; i++) {
    const square = i < anchors.length && count >= anchors.length
      ? anchors[(i + dayIndex(dateKey)) % anchors.length]
      : FILES[Math.floor(rng() * 8)] + (1 + Math.floor(rng() * 8))
    const mode = i % 3 === 2 ? 'color' : 'click'
    out.push({ id: `s${startIdx + i}-${square}-${mode}`, kind: 'square', type: 'square', square, mode, color: squareColor(square) })
  }
  return out
}

function knightItems(rng, count, startIdx) {
  const out = []
  for (let i = 0; i < count; i++) {
    let from = FILES[Math.floor(rng() * 8)] + (1 + Math.floor(rng() * 8))
    let targets = knightTargets(from)
    while (targets.length < 2) {
      from = FILES[Math.floor(rng() * 8)] + (1 + Math.floor(rng() * 8))
      targets = knightTargets(from)
    }
    out.push({ id: `k${startIdx + i}-${from}`, kind: 'knight', type: 'knight', from, targets })
  }
  return out
}

const SIDES = {
  left: (m) => m.df < 0,
  right: (m) => m.df > 0,
  up: (m) => m.dr > 0,
  down: (m) => m.dr < 0
}

const randomSquare = (rng) => FILES[Math.floor(rng() * 8)] + (1 + Math.floor(rng() * 8))

// Squares near `from` that a knight on `from` cannot reach — the false options.
function nonKnightSquares(from, rng, n = 8) {
  const moves = knightMoves(from).map((m) => m.to)
  const f = FILES.indexOf(from[0])
  const r = Number(from[1]) - 1
  const out = []
  for (let i = 0; i < 200 && out.length < n; i++) {
    const df = Math.floor(rng() * 5) - 2
    const dr = Math.floor(rng() * 5) - 2
    const nf = f + df
    const nr = r + dr
    if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue
    const sq = FILES[nf] + (nr + 1)
    if (sq === from || moves.includes(sq) || out.includes(sq)) continue
    out.push(sq)
  }
  return out
}

// Pure mental-geometry questions: no board, you hold the square in your head.
// q/options are what the drill shows; from/moves/reveal are for the reveal board.
function mentalItem(rng, idx) {
  let from = randomSquare(rng)
  let moves = knightMoves(from)
  while (moves.length < 3) {
    from = randomSquare(rng)
    moves = knightMoves(from)
  }
  const sidesWithMoves = Object.keys(SIDES).filter((s) => moves.some(SIDES[s]))
  const pool = ['count', 'which', 'notmove', 'relative']
  const shape = pool[Math.floor(rng() * pool.length)]
  const id = `m${idx}-${from}-${shape}`

  if (shape === 'count') {
    const side = sidesWithMoves[Math.floor(rng() * sidesWithMoves.length)]
    const n = moves.filter(SIDES[side]).length
    const opts = new Set([n])
    let guard = 0
    while (opts.size < 4 && guard++ < 40) opts.add(Math.max(0, Math.min(5, n + Math.floor(rng() * 5) - 2)))
    const options = shuffle([...opts].slice(0, 4), rng).map(String)
    return {
      id, kind: 'mental', type: 'mental', from, moves,
      q: `Knight on ${from}: how many of its moves land to the ${side}?`,
      sub: 'Answer without a board.',
      options, answer: String(n)
    }
  }

  if (shape === 'which') {
    const side = sidesWithMoves[Math.floor(rng() * sidesWithMoves.length)]
    const inSide = moves.filter(SIDES[side]).map((m) => m.to)
    const answer = inSide[Math.floor(rng() * inSide.length)]
    const wrongs = nonKnightSquares(from, rng, 6).slice(0, 3)
    const options = shuffle([answer, ...wrongs], rng)
    return {
      id, kind: 'mental', type: 'mental', from, moves,
      q: `Knight on ${from}: which of these is a knight move that goes ${side}?`,
      sub: 'Answer without a board.',
      options, answer
    }
  }

  if (shape === 'notmove') {
    const wrongs = nonKnightSquares(from, rng, 6).slice(0, 3)
    if (wrongs.length < 3) return mentalItem(rng, idx + 1000)
    const answer = wrongs[0]
    const real = shuffle(moves.map((m) => m.to), rng).slice(0, 3)
    const options = shuffle([answer, ...real], rng)
    return {
      id, kind: 'mental', type: 'mental', from, moves,
      q: `Knight on ${from}: which of these is NOT a knight move?`,
      sub: 'Answer without a board.',
      options, answer
    }
  }

  const mv = moves[Math.floor(rng() * moves.length)]
  const answer = `${mv.df < 0 ? 'left' : 'right'} and ${mv.dr < 0 ? 'down' : 'up'}`
  return {
    id, kind: 'mental', type: 'mental', from, moves, reveal: mv.to,
    q: `A knight jumps ${from} → ${mv.to}. Which way is that?`,
    sub: 'Left/right = file, up/down = rank.',
    options: shuffle(['left and up', 'left and down', 'right and up', 'right and down'], rng),
    answer
  }
}

function shuffle(arr, rng) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// What is this player actually bad at right now?
export function diagnosis(state) {
  const stats = typeStats(state)
  const scored = Object.entries(stats)
    .filter(([, v]) => v.attempted >= 6)
    .map(([k, v]) => ({ type: k, accuracy: v.correct / v.attempted, attempted: v.attempted }))
    .sort((a, b) => a.accuracy - b.accuracy)
  const weak = scored[0] || null
  const stale = ['square', 'knight', 'mental', 'read', 'play'].filter((t) => {
    const last = lastPracticed(state, t)
    return !last || last <= shiftDay(todayKey(), -4)
  })
  return { weak, stale, stats }
}

const EXTRA_FOR_TYPE = {
  square: { kind: 'square', count: 6, label: 'square recognition' },
  knight: { kind: 'knight', count: 4, label: 'knight jumps' },
  read: { kind: 'read', count: 6, label: 'reading moves' },
  play: { kind: 'play', count: 6, label: 'executing moves' },
  mental: { kind: 'mental', count: 4, label: 'mental geometry' }
}

export function planForDate(dateKey = todayKey(), state = null, opts = {}) {
  const rng = mulberry32(hash(dateKey + (opts.extraReps ? ':x' : '')))
  const forced = opts.theme || (feed[dateKey] && feed[dateKey].theme)
  const theme = THEMES[forced] ? forced : themeFor(dateKey)
  const set = []

  const play = (pool, n, type) => poolTasks(pool, n, rng).forEach((t) => set.push(playItem(t, type || 'play', rng, set.length)))
  const read = (n, reverseOdd = true) => {
    const items = []
    const start = Math.floor(rng() * drills.reading.length)
    for (let i = 0; i < n; i++) items.push(drills.reading[(start + i * 11) % drills.reading.length])
    items.forEach((it, i) => set.push(readItem(it, set.length + i, reverseOdd && i % 2 === 1, rng)))
  }
  const squares = (n) => squareItems(dateKey, rng, n, 0).forEach((s) => set.push({ ...s, id: `s${set.length}-${s.square}` }))
  const knights = (n) => knightItems(rng, n, 0).forEach((k) => set.push({ ...k, id: `k${set.length}-${k.from}` }))
  const mentals = (n) => {
    for (let i = 0; i < n; i++) set.push(mentalItem(rng, set.length))
  }

  switch (theme) {
    case 'grid': squares(8); knights(4); read(4); mentals(3); break
    case 'capture': read(4); play('capture', 8); squares(3); mentals(2); break
    case 'knight': knights(6); play('knight', 6); read(3); mentals(3); break
    case 'check': read(5); play('check', 8); squares(2); mentals(2); break
    case 'castle': play('castle', 4); play('promo', 3); read(4); squares(2); mentals(2); break
    case 'full': play('quiet', 5); play('disambig', 4); play('capture', 3); read(3); mentals(3); break
    case 'speed': play('capture', 4); play('check', 4); play('knight', 2); play('castle', 2); squares(2); mentals(2); break
    default: break
  }

  // adaptive block: the weakest drill type gets extra reps on top of the day's theme
  const diag = state ? diagnosis(state) : { weak: null, stale: [] }
  let coachNote = ''
  if (diag.weak && diag.weak.accuracy < 0.75) {
    const extra = EXTRA_FOR_TYPE[diag.weak.type]
    if (extra && extra.kind !== 'play' && theme !== 'speed') {
      if (extra.kind === 'square') squares(4)
      if (extra.kind === 'knight') knights(3)
      if (extra.kind === 'read') read(4)
      if (extra.kind === 'mental') mentals(4)
      coachNote = `You are at ${Math.round(diag.weak.accuracy * 100)}% on ${extra.label}, so 4 extra reps are appended.`
    } else if (extra && extra.kind === 'play') {
      play(diag.weak.type === 'play' ? 'capture' : 'capture', 4)
      coachNote = `Your move-execution accuracy is ${Math.round(diag.weak.accuracy * 100)}% — 4 extra board reps appended.`
    }
  }

  const entry = feed[dateKey] || {}
  const t = THEMES[theme]
  const total = set.length
  return {
    date: dateKey,
    theme,
    label: t.label,
    blurb: entry.blurb || t.blurb,
    tip: entry.tip || t.tip,
    headline: entry.headline || `${t.label}: ${total} reps`,
    why: entry.why || coachNote || `Rotation day ${(dayIndex(dateKey) % 7) + 1} of 7 — ${t.blurb}`,
    source: entry.headline ? 'bot feed' : 'coach',
    items: set,
    targetReps: entry.targetReps || total
  }
}

// Endless extra reps: 12 mixed items, seeded by clock so it never repeats.
export function extraSet(seed = Date.now()) {
  const rng = mulberry32(hash('extra' + seed))
  const set = []
  const items = shuffle(drills.reading, rng).slice(0, 4)
  items.forEach((it, i) => set.push(readItem(it, i, i % 2 === 1, rng)))
  poolTasks('capture', 3, rng).forEach((t) => set.push(playItem(t, 'play', rng, set.length)))
  poolTasks('check', 3, rng).forEach((t) => set.push(playItem(t, 'play', rng, set.length)))
  knightItems(rng, 2, 0).forEach((k) => set.push({ ...k, id: `ke${set.length}-${k.from}` }))
  for (let i = 0; i < 2; i++) set.push(mentalItem(rng, set.length))
  return shuffle(set, rng)
}

// A mental-only set: geometry questions with no board, for the commute.
export function mentalSet(n = 10, seed = Date.now()) {
  const rng = mulberry32(hash('mental' + seed))
  const set = []
  for (let i = 0; i < n; i++) set.push(mentalItem(rng, i))
  return set
}

export { drills }
export const meta = { generated: drills.generated, source: drills.source, games: drills.games, counts: drills.counts }