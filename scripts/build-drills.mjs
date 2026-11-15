// Builds src/data/drills.json from the PGN corpus (world championship games).
// Pools of real positions, classified by what makes them hard to read in notation.
//
// Variety rules learned the hard way:
//  - sample with a stride across the whole corpus, never the first N moves (the first N are all
//    one opening), so a pool spans eras and openings instead of repeating the same game.
//  - keep every pool big enough that a daily set of 8 never exhausts it, and cut the per-item
//    payload (no ply/moveNo) because the whole file ships to the browser.
//  - reading items are grouped by kind so a theme day actually shows that kind of move.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ChessMod = require('chess.js')
const Chess = ChessMod.Chess || ChessMod

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const corpusPath = path.join(root, 'src/PGN/outfile.json')
const outPath = path.join(root, 'src/data/drills.json')
fs.mkdirSync(path.dirname(outPath), { recursive: true })

const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'))
const PIECE_NAMES = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' }
const FILES = 'abcdefgh'

const pools = {
  capture: [], check: [], castle: [], promo: [], knight: [], disambig: [], quiet: []
}
const seen = new Set()

function push(pool, task) {
  const key = pool + task.fen + task.san
  if (seen.has(key)) return
  seen.add(key)
  pools[pool].push(task)
}

let games = 0
for (const entry of corpus) {
  let game
  try {
    game = new Chess()
    game.load_pgn(entry.data)
  } catch (e) { continue }
  const history = game.history({ verbose: true })
  if (history.length < 12) continue
  games++

  const replay = new Chess()
  history.forEach((mv) => {
    const fen = replay.fen()
    const m = replay.move(mv.san)
    if (!m) return
    const quietish = !m.captured && !m.promotion && !m.san.includes('+') && !m.san.includes('#') &&
      !m.flags.includes('k') && !m.flags.includes('q')

    // only what the app renders: position, the move, and the squares involved
    const task = { fen, san: m.san, from: m.from, to: m.to, piece: m.piece, color: m.color }
    if (m.promotion) task.promotion = m.promotion // plain() reads it; without it promotions lose their tail

    if (m.flags.includes('k') || m.flags.includes('q')) push('castle', task)
    if (m.promotion) push('promo', task)
    if (m.san.includes('+')) push('check', task)
    if (m.captured) push('capture', task)
    if (m.piece === 'n') push('knight', task)
    // disambiguation: piece letter followed by file or rank disambiguator, e.g. Nbd2, R1e2, Qh4e1
    if (/^[NBRQK]([a-h]|[1-8])x?[a-h][1-8]/.test(m.san)) push('disambig', task)
    if (quietish && m.piece !== 'k') push('quiet', task)
  })
}

// deterministic, spread-out sample so a year of daily sets never repeats
function sample(arr, n, step) {
  if (arr.length <= n) return arr
  const out = []
  const stride = arr.length / n
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * stride + (step % 7)) % arr.length])
  return out
}

// Big enough that an 8-rep daily draw from one pool does not visibly cycle within weeks.
// Size cost is ~140 bytes per task; the file gzips to roughly a fifth of its raw size.
const caps = { capture: 1000, check: 400, castle: 200, promo: 120, knight: 1000, disambig: 500, quiet: 800 }
const final = {}
for (const [k, n] of Object.entries(caps)) final[k] = sample(pools[k], n, 3)

/* ------------------------------- reading drills ------------------------------- */
// SAN -> plain English chunk, with 3 generated distractors. Grouped by kind so a
// "check day" shows checks, a "capture day" shows captures, and so on.

function plain(task) {
  const p = PIECE_NAMES[task.piece] || 'Pawn'
  let s = p
  if (task.san.includes('x')) s += ' takes'
  else s += ' to'
  s += ' ' + task.to
  if (task.san.startsWith('O-O-O')) s = 'Queenside castle'
  if (task.san.startsWith('O-O')) s = 'Kingside castle'
  if (task.promotion) s += ', promotes to ' + PIECE_NAMES[task.promotion]
  if (task.san.endsWith('#')) s += ', checkmate'
  else if (task.san.includes('+')) s += ', check'
  return s
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function shuffle(arr, rng) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Four options with exactly one right answer, wrong in the ways notation is actually misread.
function optionsFor(task, rng) {
  const answer = plain(task)
  const randSq = () => FILES[Math.floor(rng() * 8)] + (1 + Math.floor(rng() * 8))
  const wrongs = []
  const add = (v) => { if (v && v !== answer && !wrongs.includes(v)) wrongs.push(v) }

  const isCastle = answer.includes('castle')
  add(answer.replace(task.to, randSq()))                       // wrong destination square
  if (!isCastle) {
    // piece swap — skipped for castles, where "Kingside" starts with "King" and would yield "Pawnside"
    add(answer.replace(/^(Pawn|Knight|Bishop|Rook|Queen|King)/,
      ['Pawn', 'Knight', 'Bishop', 'Rook', 'Queen'].filter((p) => p !== PIECE_NAMES[task.piece])[Math.floor(rng() * 4)]))
    add(answer.includes('takes') ? answer.replace('takes', 'to') : answer.replace(' to ', ' takes '))  // x confusion
  }
  add(answer.replace(', check', '').replace(', checkmate', '')) // dropped tail
  if (isCastle) add(answer.startsWith('Kingside') ? 'Queenside castle' : 'Kingside castle')
  if (task.promotion) {
    const others = ['Queen', 'Rook', 'Bishop', 'Knight'].filter((p) => p !== PIECE_NAMES[task.promotion])
    add(answer.replace(/promotes to \w+/, 'promotes to ' + others[Math.floor(rng() * others.length)]))
  }
  let guard = 0
  while (wrongs.length < 3 && guard++ < 30) add('Pawn to ' + randSq())

  const four = shuffle([answer, ...wrongs.slice(0, 3)], rng)
  return four
}

const readingBy = {}
for (const [kind, list] of Object.entries(final)) {
  const rng = mulberry32(hash('reading:' + kind))
  const out = []
  const used = new Set()
  for (const t of list) {
    if (out.length >= 320) break
    const key = t.fen + t.san // position + move: castles and promotions are unique per game
    if (used.has(key)) continue
    used.add(key)
    out.push({
      san: t.san, fen: t.fen, from: t.from, to: t.to,
      answer: plain(t), options: optionsFor(t, rng)
    })
  }
  readingBy[kind] = out
}

const out = {
  generated: new Date().toISOString().slice(0, 10),
  source: 'mattjliu/Notation-Trainer PGN corpus: 946 world championship games, 1886-2018',
  games,
  pools: final,
  counts: Object.fromEntries(Object.entries(final).map(([k, v]) => [k, v.length])),
  readingBy,
  readingCounts: Object.fromEntries(Object.entries(readingBy).map(([k, v]) => [k, v.length]))
}
fs.writeFileSync(outPath, JSON.stringify(out))
const kb = (fs.statSync(outPath).size / 1024).toFixed(0)
console.log('games parsed:', games)
console.log('pools:', JSON.stringify(out.counts))
console.log('reading:', JSON.stringify(out.readingCounts))
console.log('total items:', Object.values(out.counts).reduce((a, b) => a + b, 0) + Object.values(out.readingCounts).reduce((a, b) => a + b, 0), '|', kb + 'KB')