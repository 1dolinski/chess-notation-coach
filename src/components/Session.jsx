import React, { useEffect, useMemo, useRef, useState } from 'react'
import Board from './Board'
import { recordAnswer, streakInfo, loadState } from '../lib/store'
import { knightTargets } from '../lib/daily'

const PIECE = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' }

function nudgeText(t) {
  const lead = /^[NBRQK]/.test(t.san) ? t.san[0] : null
  return lead ? `Not that one — ${t.san} starts with ${lead}.` : `Not that one — ${t.san} is a pawn move.`
}

function clocks(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const KIND_TAG = { read: 'reading', play: 'board', square: 'grid', knight: 'knight', mental: 'mental' }

function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

// Board orientation: settings win, otherwise follow the side to move on real positions.
export function resolveOrientation(settings, item, id = '') {
  const o = settings.orientation
  if (o === 'white' || o === 'black') return o
  if (o === 'random') return hash(id || item.id || '') % 2 === 0 ? 'white' : 'black'
  return item.kind === 'play' ? (item.task.color === 'w' ? 'white' : 'black') : 'white'
}

export default function Session({ items, title = 'Practice', onExit, onFinish, settings = null }) {
  const [queue, setQueue] = useState(items)
  const [pos, setPos] = useState(0)
  const [phase, setPhase] = useState('ask') // ask | right | wrong | done
  const [feedback, setFeedback] = useState('')
  const [found, setFound] = useState([])
  const foundRef = useRef([])
  const [pick, setPick] = useState(null)
  const [nudge, setNudge] = useState('')
  const [log, setLog] = useState([])
  const [elapsed, setElapsed] = useState(0)
  const [streak, setStreak] = useState(() => streakInfo(loadState()))
  const prefs = settings || loadState().settings
  const started = useRef(Date.now())
  const itemStart = useRef(Date.now())
  const timer = useRef(null)

  const item = queue[pos]

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    foundRef.current = []
    setFound([])
    setPick(null)
    setNudge('')
    itemStart.current = Date.now()
    if (import.meta.env.DEV) window.__coachItem = item
  }, [pos, queue])

  useEffect(() => () => clearTimeout(timer.current), [])

  const rightAnswers = useMemo(() => {
    if (!item) return 0
    return log.filter((l) => l.correct).length
  }, [log, item])

  if (!item || phase === 'done') {
    const attempts = log.length
    const correct = log.filter((l) => l.correct).length
    const avg = attempts ? Math.round(log.reduce((a, l) => a + l.ms, 0) / attempts / 100) / 10 : 0
    return (
      <div className="session done-screen">
        <h2>Set complete</h2>
        <div className="score-grid">
          <div><b>{correct}</b><span>correct</span></div>
          <div><b>{attempts ? Math.round((correct / attempts) * 100) : 0}%</b><span>accuracy</span></div>
          <div><b>{avg}s</b><span>per rep</span></div>
          <div><b>{clocks(elapsed)}</b><span>total time</span></div>
        </div>
        <p className="streak-line">
          Streak: <b>{streak.current} day{streak.current === 1 ? '' : 's'}</b>
          {streak.todayDone ? ' — today is banked.' : ` — ${Math.max(0, streak.goal - streak.todayReps)} reps to hold it today.`}
        </p>
        <div className="row">
          <button className="btn primary" onClick={onExit}>Back to today</button>
          {onFinish && <button className="btn" onClick={onFinish}>Extra reps</button>}
        </div>
      </div>
    )
  }

  function commit(correct, detail = '') {
    const ms = Date.now() - itemStart.current
    setLog((l) => [...l, { type: item.type, correct, ms }])
    recordAnswer(item.type, correct, ms)
    setStreak(streakInfo(loadState()))
    setPhase(correct ? 'right' : 'wrong')
    setFeedback(detail)
    if (!correct && !item.id.endsWith('-retry')) {
      setQueue((q) => [...q, { ...item, id: item.id + '-retry' }])
    }
    timer.current = setTimeout(() => {
      const next = pos + 1
      if (next >= queue.length + (correct ? 0 : 1)) {
        setPhase('done')
      } else {
        setPos(next)
        setPhase('ask')
        setFeedback('')
      }
    }, correct ? 700 : 1900)
  }

  function answerRead(opt) {
    if (phase !== 'ask') return
    const right = opt === item.answer
    if (item.kind === 'mental') {
      commit(right, right ? `✓ ${item.answer}` : `✗ answer: ${item.answer} (knight on ${item.from} reaches ${item.moves.map((m) => m.to).join(' ')})`)
      return
    }
    commit(right, right ? `✓ ${item.prompt} = ${item.answer}` : `✗ ${item.prompt} means "${item.answer}"`)
  }

  function onSquare(square) {
    if (phase !== 'ask') return
    if (item.kind === 'square') {
      commit(square === item.square, square === item.square ? `✓ ${item.square}` : `✗ you clicked ${square}; ${item.square} is highlighted`)
      return
    }
    if (item.kind === 'knight') {
      if (item.targets.includes(square)) {
        if (foundRef.current.includes(square)) return
        const next = [...foundRef.current, square]
        foundRef.current = next
        setFound(next)
        if (next.length === item.targets.length) {
          commit(true, `✓ all ${item.targets.length} knight squares: ${item.targets.join(' ')}`)
        }
      } else {
        commit(false, `✗ ${square} is not a knight move from ${item.from}. Answer: ${item.targets.join(' ')}`)
        foundRef.current = item.targets
        setFound(item.targets)
      }
      return
    }
    if (item.kind === 'play') {
      const t = item.task
      if (!pick) {
        if (square !== t.from) {
          // not scored yet — a nudge, not a fail, so a mis-click does not poison the rep
          setNudge(nudgeText(t))
          return
        }
        setPick(square)
        return
      }
      if (square === t.to) {
        commit(true, `✓ ${t.san}`)
      } else {
        setPick(null)
        commit(false, `✗ ${t.san} moves ${t.from} → ${t.to}`)
      }
    }
  }

  const blindKnight = !!prefs.blindKnight
  const marked = {}
  if (phase === 'wrong' && item.kind === 'square') marked[item.square] = 'hit'
  if (item.kind === 'knight') {
    if (!blindKnight || phase !== 'ask') marked[item.from] = 'target' // blind mode: no ring until the answer is revealed
    found.forEach((f) => { marked[f] = 'hit' })
    if (phase === 'wrong') item.targets.forEach((t) => { if (!found.includes(t)) marked[t] = 'hit' })
  }
  if (item.kind === 'mental' && phase !== 'ask') {
    marked[item.from] = 'target'
    item.moves.forEach((m) => { marked[m.to] = 'hit' })
  }
  if (item.kind === 'play') {
    if (pick) marked[pick] = 'target'
    if (phase === 'wrong') { marked[item.task.from] = 'target'; marked[item.task.to] = 'hit' }
    if (phase === 'right') { marked[item.task.from] = 'hit'; marked[item.task.to] = 'hit' }
  }

  let prompt = ''
  let sub = ''
  if (item.kind === 'square') {
    prompt = item.mode === 'color' ? `Is ${item.square} light or dark?` : `Click ${item.square}`
    sub = item.mode === 'color' ? 'Colour is decided by file+rank parity.' : 'No coordinates shown. Use the anchors.'
  } else if (item.kind === 'knight') {
    prompt = `N from ${item.from} — click every square it can reach`
    sub = blindKnight
      ? `${found.length}/${item.targets.length} found · knight not shown, picture where it stands`
      : `${found.length}/${item.targets.length} found`
  } else if (item.kind === 'mental') {
    prompt = item.q
    sub = item.sub
  } else if (item.kind === 'play') {
    prompt = item.task.san
    sub = item.task.color === 'w' ? 'White to move' : 'Black to move'
  } else {
    prompt = item.prompt
    sub = item.kind === 'read' ? 'What does this move say?' : ''
  }

  return (
    <div className={`session ${item.kind === 'play' ? 'with-board' : ''}`}>
      <div className="session-head">
        <button className="btn ghost" onClick={onExit}>Exit</button>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${(pos / queue.length) * 100}%` }} /></div>
        <div className="session-meta">{pos + 1}/{queue.length} · {clocks(elapsed)}</div>
      </div>

      <div className={`prompt-card ${phase}`}>
        <div className="prompt-type">{title} · {KIND_TAG[item.kind] || item.kind}{item.kind !== 'play' && prefs.orientation !== 'auto' ? ` · ${prefs.orientation} view` : ''}</div>
        <div className={`prompt-main ${item.kind === 'mental' ? 'long' : ''}`}>{prompt}</div>
        <div className="prompt-sub">{phase === 'ask' ? sub : feedback}</div>
      </div>

      {item.kind === 'play' && (
        <Board
          fen={item.task.fen} onSquare={onSquare} marked={marked}
          coords={prefs.coords} orientation={resolveOrientation(prefs, item)}
        />
      )}
      {(item.kind === 'square' && item.mode === 'click') && (
        <Board onSquare={onSquare} marked={marked} coords={prefs.coords} orientation={resolveOrientation(prefs, item)} />
      )}
      {item.kind === 'knight' && (
        <Board onSquare={onSquare} marked={marked} coords={true} orientation={resolveOrientation(prefs, item)} />
      )}

      {/* mental drills are answered from memory, then shown on the board */}
      {item.kind === 'mental' && phase !== 'ask' && (
        <Board
          marked={marked} coords={true} selectable={false} size={320}
          pieces={{ [item.from]: { type: 'n', color: 'w' } }}
          orientation={resolveOrientation(prefs, item)}
        />
      )}

      {item.kind === 'square' && item.mode === 'color' && (
        <div className="row">
          <button className="btn" onClick={() => commit(item.color === 'light', `✓ ${item.square} is ${item.color}`)}>Light</button>
          <button className="btn" onClick={() => commit(item.color === 'dark', `✓ ${item.square} is ${item.color}`)}>Dark</button>
        </div>
      )}

      {(item.kind === 'read' || item.kind === 'mental') && (
        <div className="options">
          {item.options.map((opt) => (
            <button
              key={opt}
              className={`btn option ${phase !== 'ask' ? (opt === item.answer ? 'right' : 'dim') : ''}`}
              onClick={() => answerRead(opt)}
              disabled={phase !== 'ask'}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {item.kind === 'play' && phase === 'ask' && (
        <p className="hint">
          {nudge || (pick ? 'Now click the destination square.' : `Read the move first: which ${PIECE[item.task.piece]} can make it?`)}
        </p>
      )}

      <div className="session-foot">
        <span>{rightAnswers} correct</span>
        <span className="dot-sep">·</span>
        <span>streak {streak.current}</span>
        {item.kind === 'read' && phase === 'ask' && item.fen && (
          <span className="fen-peek">{item.fen.split(' ')[1] === 'w' ? 'White' : 'Black'} to move</span>
        )}
      </div>
    </div>
  )
}