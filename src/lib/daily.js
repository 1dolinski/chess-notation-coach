// The coach: turns the date + your history into one practice set per day.
// Deterministic (same date + same history => same set), adaptive (weak area gets extra reps),
// and anti-repetitive (nothing served on a previous day comes back until the seen buffer cycles).
import drills from '../data/drills.json'
import feed from '../data/coach-feed.json'
import { typeStats, lastPracticed, shiftDay, todayKey, seenBefore } from './store'

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

// Which reading pool a theme draws from, so "check day" shows checks instead of random moves.
const READING_FOR = {
  grid: ['quiet'],
  capture: ['capture'],
  knight: ['knight'],
  check: ['check'],
  castle: ['castle', 'promo'],
  full: ['disambig', 'quiet'],
  speed: ['capture', 'check', 'knight']
}

// Which board pool the generated notation drills (choose-the-SAN, click-the-destination) draw from.
const BOARD_FOR = {
  grid: ['quiet', 'knight'],
  capture: ['capture'],
  knight: ['knight'],
  check: ['check'],
  castle: ['castle', 'promo'],
  full: ['quiet', 'disambig', 'capture'],
  speed: ['capture', 'check', 'knight']
}

const READING_BY = drills.readingBy || {}
const readingPool = (kinds) => {
  const list = []
  ;(kinds || Object.keys(READING_BY)).forEach((k) => { if (READING_BY[k]) list.push(...READING_BY[k]) })
  return list.length ? list : Object.values(READING_BY).flat()
}

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
  return knightMoves(square).map((m) => m.to)
}

function squareColor(square) {
  const f = FILES.indexOf(square[0])
  const r = Number(square[1]) - 1
  return (f + r) % 2 === 0 ? 'dark' : 'light'
}

const randomSquare = (rng) => FILES[Math.floor(rng() * 8)] + (1 + Math.floor(rng() * 8))
const fileOf = (sq) => FILES.indexOf(sq[0])
const rankOf = (sq) => Number(sq[1]) - 1

function shuffle(arr, rng) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ------------------------------ anti-repetition ------------------------------ */

// Content-based key: what the rep actually asks, not the slot it happens to sit in.
export function seenKey(item) {
  if (!item) return ''
  switch (item.kind) {
    case 'play': return `play:${item.task.fen}|${item.task.san}`
    case 'read': return `read:${item.fen}|${item.san}`
    case 'san': return `san:${item.task.fen}|${item.task.san}`
    case 'dest': return `dest:${item.task.fen}|${item.task.san}`
    case 'square': return `grid:${item.square}|${item.mode}`
    case 'knight': return `knight:${item.from}|${item.blind ? 'blind' : 'open'}`
    case 'mental': return `mental:${item.shape}:${item.q}` // q, not just from+answer: two shapes can share a square and a number
    default: return `${item.kind}:${item.id}`
  }
}

// Draw n items, skipping anything already served on an earlier day; fall back to anything
// not already taken when the pool is smaller than the seen buffer.
function pickFrom(list, n, rng, seen, keyOf = (x) => x) {
  if (!list || !list.length || n <= 0) return []
  const start = Math.floor(rng() * list.length)
  const out = []
  const taken = new Set()
  const key = (it) => String(keyOf(it))
  for (let i = 0; i < list.length && out.length < n; i++) {
    const it = list[(start + i) % list.length]
    const k = key(it)
    if (taken.has(k) || seen.has(k)) continue
    taken.add(k)
    out.push(it)
  }
  for (let i = 0; i < list.length && out.length < n; i++) {
    const it = list[(start + i * 7) % list.length]
    const k = key(it)
    if (taken.has(k)) continue
    taken.add(k)
    out.push(it)
  }
  return out
}

/* ---------------------------------- items ---------------------------------- */

// Board side is randomised by default: every rep carries the side its board should be shown from,
// so a set mixes White and Black views instead of always reading from White's side.
const pickSide = (rng) => (rng() < 0.5 ? 'white' : 'black')

function poolTasks(name, count, rng, seen) {
  const pool = (drills.pools && drills.pools[name]) || []
  const keyOf = (t) => `play:${t.fen}|${t.san}`
  return pickFrom(pool, count, rng, seen, keyOf)
}

function playItem(task, type, rng, idx) {
  return { id: `p${idx}-${task.san}-${task.to}`, kind: 'play', type, task, side: pickSide(rng) }
}

function readItem(item, idx, reverse, rng) {
  const hasSquare = /[a-h][1-8]/.test(item.san)
  if (!reverse || !hasSquare) {
    // from/to ride along so the review view can show the position with the move highlighted
    return {
      id: `r${idx}-${item.san}`, kind: 'read', type: 'read', san: item.san, prompt: item.san,
      options: item.options, answer: item.answer, fen: item.fen, from: item.from, to: item.to, side: pickSide(rng)
    }
  }
  // reverse: English prompt -> pick the SAN. Build distractors by mutating the real move.
  const san = item.san
  const four = shuffle([san, ...sanVariants(san, rng).slice(0, 3)], rng)
  return {
    id: `r${idx}-${san}-rev`, kind: 'read', type: 'read',
    prompt: item.answer, options: four, answer: san, fen: item.fen, from: item.from, to: item.to, side: pickSide(rng)
  }
}

// Plausible ways to miswrite a move — the same mistakes a reader makes in reverse.
function sanVariants(san, rng) {
  const out = []
  const add = (v) => { if (v && v !== san && !out.includes(v)) out.push(v) }
  const dests = san.match(/[a-h][1-8]/g) || []
  const last = dests[dests.length - 1]

  if (last) add(san.replace(last, randomSquare(rng)))                  // wrong destination square
  if (/^[a-h]x/.test(san)) add(['N', 'B', 'R', 'Q'][Math.floor(rng() * 4)] + san.slice(1)) // exd5 -> Nxd5
  else if (/^[a-h][1-8]/.test(san)) add('N' + san)                     // e4 -> Ne4
  else if (/^[NBRQK]/.test(san)) {
    const others = ['N', 'B', 'R', 'Q'].filter((l) => l !== san[0])
    add(others[Math.floor(rng() * others.length)] + san.slice(1))      // wrong piece
  }
  if (/^[NBRQK][a-h1-8]/.test(san) && san.length > 3) add(san[0] + san.slice(2)) // Nbd2 -> Nd2
  add(san.includes('x') ? san.replace('x', '') : (last ? san.replace(last, 'x' + last) : '')) // x dropped/added
  add(san.includes('=') ? san.replace(/=./, '=N') : '')
  add(san.includes('+') ? san.replace('+', '') : san + '+')
  return out
}

// Reverse reading: the move is shown on the board, you pick its notation.
function sanItem(task, rng, idx) {
  const options = shuffle([task.san, ...sanVariants(task.san, rng).slice(0, 3)], rng)
  return {
    id: `n${idx}-${task.san}-${task.to}`, kind: 'san', type: 'read', task,
    options, answer: task.san, side: pickSide(rng)
  }
}

// Read the move, then click where it lands — the SAN-to-square step with a board under it.
function destItem(task, rng, idx) {
  return {
    id: `d${idx}-${task.san}-${task.to}`, kind: 'dest', type: 'read', task,
    answer: task.to, from: task.from, fen: task.fen, side: pickSide(rng)
  }
}

// The squares from trick #1 plus a few more anchors, rotated by day so grid day keeps moving.
const ANCHORS = ['a1', 'h8', 'e4', 'd5', 'h1', 'a8', 'd4', 'e5', 'c3', 'f6', 'b7', 'g2']

function squareItems(dateKey, rng, count, tasks = []) {
  const out = []
  const taskPool = [...tasks]
  for (let i = 0; i < count; i++) {
    // every fourth rep reads the square out of real notation instead of naming it
    if (i % 4 === 3 && taskPool.length) {
      const t = taskPool.shift()
      out.push({
        id: `s${i}-${t.to}-not`, kind: 'square', type: 'square', square: t.to, mode: 'color',
        notation: t.san, color: squareColor(t.to), side: pickSide(rng)
      })
      continue
    }
    const square = i < 4 ? ANCHORS[(i + dayIndex(dateKey)) % ANCHORS.length] : randomSquare(rng)
    const mode = i % 3 === 2 ? 'color' : 'click'
    out.push({ id: `s${i}-${square}-${mode}`, kind: 'square', type: 'square', square, mode, color: squareColor(square), side: pickSide(rng) })
  }
  return out
}

// Every other knight rep is blind: the square is named in the prompt but not marked on the board,
// so the position has to be pictured. Mixed in by design instead of behind a settings toggle.
function knightItems(rng, count, seen) {
  const out = []
  const taken = new Set()
  for (let i = 0; i < count; i++) {
    let from = randomSquare(rng)
    let targets = knightTargets(from)
    let guard = 0
    while ((targets.length < 2 || seen.has(`knight:${from}|${i % 2 === 1 ? 'blind' : 'open'}`) || taken.has(from)) && guard++ < 60) {
      from = randomSquare(rng)
      targets = knightTargets(from)
    }
    taken.add(from)
    const blind = i % 2 === 1
    out.push({ id: `k${i}-${from}`, kind: 'knight', type: 'knight', from, targets, blind, side: pickSide(rng) })
  }
  return out
}

const SIDES = {
  left: (m) => m.df < 0,
  right: (m) => m.df > 0,
  up: (m) => m.dr > 0,
  down: (m) => m.dr < 0
}

// Squares near `from` that a knight on `from` cannot reach — the false options.
function nonKnightSquares(from, rng, n = 8) {
  const moves = knightMoves(from).map((m) => m.to)
  const f = fileOf(from)
  const r = rankOf(from)
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

function numberOptions(answer, rng, lo = 0, hi = 8) {
  const opts = new Set([answer])
  let guard = 0
  while (opts.size < 4 && guard++ < 40) opts.add(lo + Math.floor(rng() * (hi - lo + 1)))
  return shuffle([...opts].slice(0, 4), rng).map(String)
}

// Pure mental-geometry questions: no board, you hold the square in your head.
// q/options are what the drill shows; from/moves are for the reveal board.
function mentalItem(rng, idx, seen) {
  let from = randomSquare(rng)
  let moves = knightMoves(from)
  let guard = 0
  while (moves.length < 3 && guard++ < 40) {
    from = randomSquare(rng)
    moves = knightMoves(from)
  }
  const sidesWithMoves = Object.keys(SIDES).filter((s) => moves.some(SIDES[s]))
  const shapes = ['count', 'which', 'notmove', 'relative', 'total', 'delta', 'distance', 'path']
  const usable = shapes.filter((s) => {
    if (s === 'total') return moves.length >= 3 && moves.length <= 8
    if (s === 'delta') return moves.length >= 4
    return true
  })
  // avoid asking the same shape on the same square as a previous day
  const fresh = usable.filter((s) => !seen.has(`mental:${s}:${from}|`) && !seen.has(`mental:${s}:${from}`))
  const shape = (fresh.length ? fresh : usable)[Math.floor(rng() * (fresh.length ? fresh.length : usable.length))]
  const id = `m${idx}-${from}-${shape}`

  if (shape === 'count') {
    const dir = sidesWithMoves[Math.floor(rng() * sidesWithMoves.length)]
    const n = moves.filter(SIDES[dir]).length
    return {
      id, kind: 'mental', type: 'mental', from, moves, shape, side: pickSide(rng),
      q: `Knight on ${from}: how many of its moves land to the ${dir}?`,
      sub: 'Answer without a board.',
      options: numberOptions(n, rng, 0, 5), answer: String(n)
    }
  }

  if (shape === 'total') {
    const n = moves.length
    return {
      id, kind: 'mental', type: 'mental', from, moves, shape, side: pickSide(rng),
      q: `Knight on ${from}: how many squares can it move to?`,
      sub: 'Edges and corners cut the number down.',
      options: numberOptions(n, rng, 2, 8), answer: String(n)
    }
  }

  if (shape === 'which') {
    const dir = sidesWithMoves[Math.floor(rng() * sidesWithMoves.length)]
    const inSide = moves.filter(SIDES[dir]).map((m) => m.to)
    const answer = inSide[Math.floor(rng() * inSide.length)]
    const wrongs = nonKnightSquares(from, rng, 6).slice(0, 3)
    return {
      id, kind: 'mental', type: 'mental', from, moves, shape, side: pickSide(rng),
      q: `Knight on ${from}: which of these is a knight move that goes ${dir}?`,
      sub: 'Answer without a board.',
      options: shuffle([answer, ...wrongs], rng), answer
    }
  }

  if (shape === 'delta') {
    // exactly one option is a knight move in the asked direction; the rest are not knight moves at all
    const dir = sidesWithMoves[Math.floor(rng() * sidesWithMoves.length)]
    const inSide = moves.filter(SIDES[dir])
    const two = inSide.filter((m) => Math.abs(m.df) === 2)
    const one = inSide.filter((m) => Math.abs(m.df) === 1)
    const kind = (two.length && (!one.length || rng() < 0.5)) ? 'two' : 'one'
    const pick = kind === 'two' ? two : one
    if (!pick.length) return mentalItem(rng, idx + 700, seen)
    const mv = pick[Math.floor(rng() * pick.length)]
    const wrongs = nonKnightSquares(from, rng, 6).slice(0, 3)
    const shapeTxt = kind === 'two'
      ? `2 files ${mv.df < 0 ? 'left' : 'right'} and 1 rank ${mv.dr < 0 ? 'down' : 'up'}`
      : `1 file ${mv.df < 0 ? 'left' : 'right'} and 2 ranks ${mv.dr < 0 ? 'down' : 'up'}`
    return {
      id, kind: 'mental', type: 'mental', from, moves, shape, side: pickSide(rng),
      q: `Knight on ${from}: which square is ${shapeTxt}?`,
      sub: 'The other options are not knight moves at all.',
      options: shuffle([mv.to, ...wrongs], rng), answer: mv.to
    }
  }

  if (shape === 'distance') {
    let b = randomSquare(rng)
    let g = 0
    while ((b === from || Math.abs(fileOf(b) - fileOf(from)) + Math.abs(rankOf(b) - rankOf(from)) === 0) && g++ < 40) b = randomSquare(rng)
    const df = Math.abs(fileOf(b) - fileOf(from))
    const dr = Math.abs(rankOf(b) - rankOf(from))
    const axis = df !== dr && rng() < 0.5 ? 'files' : 'ranks'
    const n = axis === 'files' ? df : dr
    return {
      id, kind: 'mental', type: 'mental', from, moves: [{ to: b, df: fileOf(b) - fileOf(from), dr: rankOf(b) - rankOf(from) }],
      shape, side: pickSide(rng),
      q: `How many ${axis} apart are ${from} and ${b}?`,
      sub: 'Files are letters (a–h), ranks are numbers (1–8).',
      options: numberOptions(n, rng, 0, 7), answer: String(n)
    }
  }

  if (shape === 'path') {
    let df = 0
    let dr = 0
    let g = 0
    while ((df === 0 || dr === 0) && g++ < 60) {
      df = Math.floor(rng() * 7) - 3
      dr = Math.floor(rng() * 7) - 3
    }
    const nf = fileOf(from) + df
    const nr = rankOf(from) + dr
    if (nf < 0 || nf > 7 || nr < 0 || nr > 7) return mentalItem(rng, idx + 900, seen)
    const answer = FILES[nf] + (nr + 1)
    const wrongs = nonKnightSquares(from, rng, 8).filter((s) => s !== answer).slice(0, 3)
    const txt = `${Math.abs(df)} file${Math.abs(df) === 1 ? '' : 's'} ${df > 0 ? 'right' : 'left'} and ${Math.abs(dr)} rank${Math.abs(dr) === 1 ? '' : 's'} ${dr > 0 ? 'up' : 'down'}`
    return {
      id, kind: 'mental', type: 'mental', from, moves: [{ to: answer, df, dr }], shape, side: pickSide(rng),
      q: `From ${from}: which square is ${txt}?`,
      sub: 'Count along the file first, then the rank.',
      options: shuffle([answer, ...wrongs], rng), answer
    }
  }

  const mv = moves[Math.floor(rng() * moves.length)]
  const answer = `${mv.df < 0 ? 'left' : 'right'} and ${mv.dr < 0 ? 'down' : 'up'}`
  return {
    id, kind: 'mental', type: 'mental', from, moves, reveal: mv.to, shape, side: pickSide(rng),
    q: `A knight jumps ${from} → ${mv.to}. Which way is that?`,
    sub: 'Left/right = file, up/down = rank.',
    options: shuffle(['left and up', 'left and down', 'right and up', 'right and down'], rng),
    answer
  }
}

/* --------------------------------- planning --------------------------------- */

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
  const seen = seenBefore(state, dateKey)
  const set = []

  const play = (pool, n, type) => poolTasks(pool, n, rng, seen).forEach((t) => set.push(playItem(t, type || 'play', rng, set.length)))
  const read = (n, kinds, reverseOdd = true) => {
    const items = pickFrom(readingPool(kinds), n, rng, seen, (it) => `read:${it.fen}|${it.san}`)
    items.forEach((it, i) => set.push(readItem(it, set.length + i, reverseOdd && i % 2 === 1, rng)))
  }
  const sans = (n) => {
    const kinds = BOARD_FOR[theme] || ['quiet']
    const tasks = pickFrom(kinds.flatMap((k) => (drills.pools && drills.pools[k]) || []), n, rng, seen, (t) => `san:${t.fen}|${t.san}`)
    tasks.forEach((t) => set.push(sanItem(t, rng, set.length)))
  }
  const dests = (n) => {
    const kinds = BOARD_FOR[theme] || ['quiet']
    const tasks = pickFrom(kinds.flatMap((k) => (drills.pools && drills.pools[k]) || []), n, rng, seen, (t) => `dest:${t.fen}|${t.san}`)
    tasks.forEach((t) => set.push(destItem(t, rng, set.length)))
  }
  const squares = (n) => {
    const tasks = poolTasks('capture', Math.ceil(n / 4), rng, seen)
    squareItems(dateKey, rng, n, tasks).forEach((s) => set.push({ ...s, id: `s${set.length}-${s.square}` }))
  }
  const knights = (n) => knightItems(rng, n, seen).forEach((k) => set.push({ ...k, id: `k${set.length}-${k.from}` }))
  const mentals = (n) => {
    for (let i = 0; i < n; i++) set.push(mentalItem(rng, set.length, seen))
  }

  switch (theme) {
    case 'grid': squares(7); knights(3); sans(3); read(3, READING_FOR.grid); mentals(3); break
    case 'capture': read(4, READING_FOR.capture); play('capture', 6); dests(3); squares(2); mentals(2); break
    case 'knight': knights(5); play('knight', 4); dests(3); read(3, READING_FOR.knight); mentals(3); break
    case 'check': read(5, READING_FOR.check); play('check', 6); dests(2); squares(2); mentals(2); break
    case 'castle': play('castle', 4); play('promo', 3); read(3, READING_FOR.castle); sans(2); mentals(2); break
    case 'full': play('quiet', 4); play('disambig', 4); play('capture', 2); read(3, READING_FOR.full); sans(3); mentals(2); break
    case 'speed': play('capture', 4); play('check', 3); play('knight', 2); play('castle', 2); sans(2); dests(2); mentals(2); break
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
      if (extra.kind === 'read') read(4, READING_FOR[theme])
      if (extra.kind === 'mental') mentals(4)
      coachNote = `You are at ${Math.round(diag.weak.accuracy * 100)}% on ${extra.label}, so 4 extra reps are appended.`
    } else if (extra && extra.kind === 'play') {
      play('capture', 4)
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
export function extraSet(seed = Date.now(), state = null) {
  const rng = mulberry32(hash('extra' + seed))
  const seen = seenBefore(state)
  const set = []
  const items = pickFrom(readingPool(), 4, rng, seen, (it) => `read:${it.fen}|${it.san}`)
  items.forEach((it, i) => set.push(readItem(it, i, i % 2 === 1, rng)))
  poolTasks('capture', 2, rng, seen).forEach((t) => set.push(playItem(t, 'play', rng, set.length)))
  poolTasks('check', 2, rng, seen).forEach((t) => set.push(playItem(t, 'play', rng, set.length)))
  poolTasks('quiet', 2, rng, seen).forEach((t) => set.push(playItem(t, 'play', rng, set.length)))
  pickFrom(drills.pools.knight, 2, rng, seen, (t) => `dest:${t.fen}|${t.san}`).forEach((t) => set.push(destItem(t, rng, set.length)))
  knightItems(rng, 2, seen).forEach((k) => set.push({ ...k, id: `ke${set.length}-${k.from}`, blind: k.blind }))
  for (let i = 0; i < 2; i++) set.push(mentalItem(rng, set.length, seen))
  return shuffle(set, rng)
}

// A mental-only set: geometry questions with no board, for the commute.
export function mentalSet(n = 10, seed = Date.now(), state = null) {
  const rng = mulberry32(hash('mental' + seed))
  const seen = seenBefore(state)
  const set = []
  for (let i = 0; i < n; i++) set.push(mentalItem(rng, i, seen))
  return set
}

export { drills }
export const meta = {
  generated: drills.generated,
  source: drills.source,
  games: drills.games,
  counts: drills.counts,
  readingCounts: drills.readingCounts || null,
  total: Object.values(drills.counts || {}).reduce((a, b) => a + b, 0) +
    Object.values(drills.readingCounts || {}).reduce((a, b) => a + b, 0)
}
