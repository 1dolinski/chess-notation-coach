// Builds src/data/drills.json from the PGN corpus (world championship games).
// Pools of real positions, classified by what makes them hard to read in notation.
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
  history.forEach((mv, ply) => {
    const fen = replay.fen()
    const m = replay.move(mv.san)
    if (!m) return
    // skip moves that are trivially unreadable / noisy
    const quietish = !m.captured && !m.promotion && !m.san.includes('+') && !m.san.includes('#') &&
      !m.flags.includes('k') && !m.flags.includes('q')

    const task = {
      fen, san: m.san, from: m.from, to: m.to, piece: m.piece, color: m.color,
      ply, moveNo: Math.floor(ply / 2) + 1
    }

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

// deterministic, spread-out sample per pool so a year of daily sets never repeats
function sample(arr, n, step) {
  if (arr.length <= n) return arr
  const out = []
  const stride = arr.length / n
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * stride + (step % 7)) % arr.length])
  return out
}

// note: the corpus has almost no moves ending in '#' (games stop at resignation/before mate)
const sizes = { capture: 220, check: 160, castle: 70, promo: 60, knight: 220, disambig: 110, quiet: 200 }
const final = {}
for (const [k, n] of Object.entries(sizes)) final[k] = sample(pools[k], n, 3)

// --- reading drills: SAN -> plain English chunk, with 3 generated distractors
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

const readingPool = [...pools.capture, ...pools.knight, ...pools.check, ...pools.castle, ...pools.disambig, ...pools.promo]
const reading = []
const used = new Set()
for (const t of readingPool) {
  if (reading.length >= 400) break
  if (used.has(t.san + t.to)) continue
  used.add(t.san + t.to)
  const answer = plain(t)
  const wrongs = new Set()
  const files = 'abcdefgh'
  const randSq = () => files[Math.floor(Math.random() * 8)] + (1 + Math.floor(Math.random() * 8))
  wrongs.add(answer.replace(t.to, randSq()))
  wrongs.add(answer.replace(/^(Pawn|Knight|Bishop|Rook|Queen|King)/, ['Pawn', 'Knight', 'Bishop', 'Rook', 'Queen'][Math.floor(Math.random() * 5)]))
  wrongs.add(answer.replace(', checkmate', '').replace(', check', '') + (answer.includes('check') ? '' : (Math.random() < 0.5 ? ', check' : '')))
  const opts = [answer, ...wrongs].filter((v, i, a) => a.indexOf(v) === i && v !== '')
  while (opts.length < 4) opts.push('Pawn to ' + randSq())
  const four = opts.slice(0, 4)
  reading.push({ san: t.san, fen: t.fen, from: t.from, to: t.to, piece: t.piece, color: t.color, answer, options: four })
}

const out = {
  generated: new Date().toISOString().slice(0, 10),
  source: 'mattjliu/Notation-Trainer PGN corpus: 946 world championship games, 1886-2018',
  games,
  pools: final,
  counts: Object.fromEntries(Object.entries(final).map(([k, v]) => [k, v.length])),
  reading
}
fs.writeFileSync(outPath, JSON.stringify(out))
const kb = (fs.statSync(outPath).size / 1024).toFixed(0)
console.log('games parsed:', games, '| pools:', JSON.stringify(out.counts), '| reading:', reading.length, '| ' + kb + 'KB')