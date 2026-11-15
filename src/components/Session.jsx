import React, { useEffect, useMemo, useRef, useState } from 'react'
import Board from './Board'
import { recordAnswer, streakInfo, loadState, noteSeen } from '../lib/store'
import { seenKey } from '../lib/daily'

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

const KIND_TAG = {
  read: 'reading', play: 'board', square: 'grid', knight: 'knight', mental: 'mental',
  san: 'notation', dest: 'read & click'
}

// Board orientation: settings win, otherwise follow the side to move on real positions.
export function resolveOrientation(settings, item) {
  const o = settings.orientation
  if (o === 'white' || o === 'black') return o
  // default: the side the rep was dealt (a set mixes both sides), so notation is read from Black too
  if (o === 'random') return item.side || 'white'
  return item.kind === 'play' ? (item.task.color === 'w' ? 'white' : 'black') : 'white'
}

// Every square that matters for a rep, once the answer is known.
function revealMarks(item) {
  const m = {}
  if (item.kind === 'square') m[item.square] = 'hit'
  if (item.kind === 'san') { m[item.task.from] = 'target'; m[item.task.to] = 'hit' }
  if (item.kind === 'dest') { m[item.from] = 'target'; m[item.answer] = 'hit' }
  if (item.kind === 'knight') {
    m[item.from] = 'target'
    item.targets.forEach((t) => { m[t] = 'hit' })
  }
  if (item.kind === 'play') { m[item.task.from] = 'hit'; m[item.task.to] = 'hit' }
  if (item.kind === 'mental') {
    m[item.from] = 'target'
    item.moves.forEach((x) => { m[x.to] = 'hit' })
  }
  if (item.kind === 'read' && item.from && item.to) { m[item.from] = 'target'; m[item.to] = 'hit' }
  return m
}

function plainAnswer(item) {
  if (item.kind === 'read') return item.answer
  if (item.kind === 'mental') return item.answer
  if (item.kind === 'san') return `${item.answer} (${item.task.from} → ${item.task.to})`
  if (item.kind === 'dest') return `${item.answer} — ${item.task.san}`
  if (item.kind === 'square') return item.mode === 'color' ? item.color : item.square
  if (item.kind === 'knight') return item.targets.join(' ')
  if (item.kind === 'play') return `${item.task.san} — ${item.task.from} → ${item.task.to}`
  return ''
}

function questionText(item) {
  if (item.kind === 'square') {
    if (item.notation) return `${item.notation} — is ${item.square} light or dark?`
    return item.mode === 'color' ? `Is ${item.square} light or dark?` : `Click ${item.square}`
  }
  if (item.kind === 'san') return 'Which notation matches the highlighted move?'
  if (item.kind === 'dest') return `${item.task.san} — click the square it lands on`
  if (item.kind === 'knight') return `N from ${item.from} — click every square it can reach`
  if (item.kind === 'mental') return item.q
  if (item.kind === 'play') return `${item.task.san} (${item.task.color === 'w' ? 'White' : 'Black'} to move)`
  return item.prompt
}

// One board component for every drill kind, used live and in review.
function DrillBoard({ item, marked, onSquare, interactive = true, coords = false, side = 'white', size = 480 }) {
  if (item.kind === 'play') {
    return (
      <Board
        fen={item.task.fen} marked={marked} coords={coords} orientation={side}
        onSquare={interactive ? onSquare : null} selectable={interactive}
      />
    )
  }
  if (item.kind === 'square' && item.mode === 'click') {
    return <Board marked={marked} coords={coords} orientation={side} onSquare={interactive ? onSquare : null} selectable={interactive} />
  }
  if (item.kind === 'knight') {
    return <Board marked={marked} coords={true} orientation={side} onSquare={interactive ? onSquare : null} selectable={interactive} />
  }
  if (item.kind === 'mental') {
    return (
      <Board
        marked={marked} coords={true} selectable={false} size={size}
        pieces={{ [item.from]: { type: 'n', color: 'w' } }} orientation={side}
      />
    )
  }
  if (item.kind === 'san') {
    return <Board fen={item.task.fen} marked={marked} coords={coords} orientation={side} selectable={false} />
  }
  if (item.kind === 'dest') {
    return (
      <Board
        fen={item.fen} marked={marked} coords={coords} orientation={side}
        onSquare={interactive ? onSquare : null} selectable={interactive}
      />
    )
  }
  if (item.kind === 'read' && item.fen) {
    return <Board fen={item.fen} marked={marked} coords={coords} orientation={side} selectable={false} />
  }
  return null
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
  const [history, setHistory] = useState([]) // answered reps, newest last
  const [review, setReview] = useState(null) // null = live question, else index into history
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
    // remember what was served so tomorrow's set avoids it; silent, so the running set is not re-planned
    if (item) noteSeen([seenKey(item)])
    if (import.meta.env.DEV) window.__coachItem = item
  }, [pos, queue])

  useEffect(() => () => clearTimeout(timer.current), [])

  const rightAnswers = useMemo(() => log.filter((l) => l.correct).length, [log])

  // keyboard: ← steps back into the review, ←/→ walk it, Esc returns to the live question
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { setReview(null); return }
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (review === null && e.key === 'ArrowLeft' && history.length) {
        setReview(history.length - 1)
        return
      }
      if (review === null) return
      if (e.key === 'ArrowLeft') setReview((i) => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setReview((i) => (i >= history.length - 1 ? null : i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [review, history.length])

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
          {history.length > 0 && <button className="btn ghost" onClick={() => setReview(history.length - 1)}>Review {history.length} reps</button>}
        </div>
      </div>
    )
  }

  function commit(correct, detail = '', chosen = '') {
    const ms = Date.now() - itemStart.current
    setLog((l) => [...l, { type: item.type, correct, ms }])
    setHistory((h) => [...h, { item, correct, detail, chosen, ms, n: pos + 1 }])
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
    if (item.kind === 'san') {
      commit(right, right ? `✓ ${item.task.san}` : `✗ the move is ${item.task.san} (${item.task.from} → ${item.task.to})`, opt)
      return
    }
    if (item.kind === 'mental') {
      commit(right, right ? `✓ ${item.answer}` : `✗ answer: ${item.answer} (knight on ${item.from} reaches ${item.moves.map((m) => m.to).join(' ')})`, opt)
      return
    }
    commit(right, right ? `✓ ${item.prompt} = ${item.answer}` : `✗ ${item.prompt} means "${item.answer}"`, opt)
  }

  function onSquare(square) {
    if (phase !== 'ask') return
    if (item.kind === 'square') {
      commit(square === item.square, square === item.square ? `✓ ${item.square}` : `✗ you clicked ${square}; ${item.square} is highlighted`, square)
      return
    }
    if (item.kind === 'knight') {
      if (item.targets.includes(square)) {
        if (foundRef.current.includes(square)) return
        const next = [...foundRef.current, square]
        foundRef.current = next
        setFound(next)
        if (next.length === item.targets.length) {
          commit(true, `✓ all ${item.targets.length} knight squares: ${item.targets.join(' ')}`, next.join(' '))
        }
      } else {
        const tried = [...foundRef.current, square]
        commit(false, `✗ ${square} is not a knight move from ${item.from}. Answer: ${item.targets.join(' ')}`, tried.join(' '))
        foundRef.current = item.targets
        setFound(item.targets)
      }
      return
    }
    if (item.kind === 'dest') {
      const t = item.task
      commit(square === t.to, square === t.to ? `✓ ${t.san} lands on ${t.to}` : `✗ ${t.san} lands on ${t.to}, not ${square}`, square)
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
        commit(true, `✓ ${t.san}`, square)
      } else {
        setPick(null)
        commit(false, `✗ ${t.san} moves ${t.from} → ${t.to}`, square)
      }
    }
  }

  /* ------------------------------- review view ------------------------------- */

  if (review !== null && history[review]) {
    const h = history[review]
    const r = h.item
    const side = resolveOrientation(prefs, r)
    const marks = revealMarks(r)
    return (
      <div className="session review">
        <div className="session-head">
          <button className="btn ghost" onClick={() => setReview(null)}>Back to question</button>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${(review / Math.max(1, history.length)) * 100}%` }} /></div>
          <div className="session-meta">review {review + 1}/{history.length}</div>
        </div>

        <div className={`prompt-card ${h.correct ? 'right' : 'wrong'}`}>
          <div className="prompt-type">
            Review · rep {h.n} · {KIND_TAG[r.kind] || r.kind} · {side} board · {h.correct ? 'answered right' : 'missed'}
          </div>
          <div className={`prompt-main ${r.kind === 'mental' ? 'long' : ''}`}>{questionText(r)}</div>
          <div className="prompt-sub">
            answer: <b>{plainAnswer(r)}</b>
            {h.chosen && h.chosen !== plainAnswer(r) ? ` · you said: ${h.chosen}` : h.chosen ? ' · you said it right' : ''}
          </div>
        </div>

        <DrillBoard item={r} marked={marks} interactive={false} coords={prefs.coords} side={side} size={360} />

        {(r.kind === 'read' || r.kind === 'mental' || r.kind === 'san') && (
          <div className="options">
            {r.options.map((opt) => (
              <button
                key={opt}
                className={`btn option ${opt === r.answer ? 'right' : (opt === h.chosen ? 'picked' : 'dim')}`}
                disabled
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        <div className="session-foot">
          <button className="btn ghost" onClick={() => setReview(Math.max(0, review - 1))} disabled={review === 0}>◀ prev</button>
          <span>{review + 1} of {history.length}</span>
          <button
            className="btn ghost"
            onClick={() => setReview(review >= history.length - 1 ? null : review + 1)}
          >
            {review >= history.length - 1 ? 'live question ▶' : 'next ▶'}
          </button>
          <span className="review-hint">← → to walk, Esc to resume</span>
        </div>
      </div>
    )
  }

  /* ------------------------------- live question ------------------------------ */

  const blindKnight = !!prefs.blindKnight || !!item.blind
  const boardSide = resolveOrientation(prefs, item)
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
  if (item.kind === 'dest') {
    if (phase === 'wrong') { marked[item.from] = 'target'; marked[item.answer] = 'hit' }
    if (phase === 'right') { marked[item.from] = 'hit'; marked[item.answer] = 'hit' }
  }
  if (item.kind === 'play') {
    if (pick) marked[pick] = 'target'
    if (phase === 'wrong') { marked[item.task.from] = 'target'; marked[item.task.to] = 'hit' }
    if (phase === 'right') { marked[item.task.from] = 'hit'; marked[item.task.to] = 'hit' }
  }

  let prompt = ''
  let sub = ''
  if (item.kind === 'square') {
    if (item.notation) {
      prompt = `${item.notation} — is ${item.square} light or dark?`
      sub = 'Read the destination square out of the move, then the colour.'
    } else {
      prompt = item.mode === 'color' ? `Is ${item.square} light or dark?` : `Click ${item.square}`
      sub = item.mode === 'color' ? 'Colour is decided by file+rank parity.' : 'No coordinates shown. Use the anchors.'
    }
  } else if (item.kind === 'san') {
    prompt = 'Which notation matches the highlighted move?'
    sub = `${item.task.color === 'w' ? 'White' : 'Black'} to move · the move is marked on the board.`
  } else if (item.kind === 'dest') {
    prompt = item.task.san
    sub = `Click the square it lands on · ${item.task.color === 'w' ? 'White' : 'Black'} to move`
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

  const showBoard = item.kind === 'play' || item.kind === 'san' || item.kind === 'dest' ||
    (item.kind === 'square' && item.mode === 'click') ||
    item.kind === 'knight' || (item.kind === 'mental' && phase !== 'ask')

  return (
    <div className="session">
      <div className="session-head">
        <button className="btn ghost" onClick={onExit}>Exit</button>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${(pos / queue.length) * 100}%` }} /></div>
        <div className="session-meta">{pos + 1}/{queue.length} · {clocks(elapsed)}</div>
      </div>

      <div className={`prompt-card ${phase}`}>
        <div className="prompt-type">{title} · {KIND_TAG[item.kind] || item.kind} · {boardSide} board</div>
        <div className={`prompt-main ${item.kind === 'mental' ? 'long' : ''}`}>{prompt}</div>
        <div className="prompt-sub">{phase === 'ask' ? sub : feedback}</div>
      </div>

      {showBoard && (
        <DrillBoard
          item={item} marked={marked} onSquare={onSquare} interactive={phase === 'ask'}
          coords={prefs.coords} side={boardSide} size={480}
        />
      )}

      {item.kind === 'square' && item.mode === 'color' && (
        <div className="row">
          <button className="btn" onClick={() => commit(item.color === 'light', `✓ ${item.square} is ${item.color}`, 'Light')}>Light</button>
          <button className="btn" onClick={() => commit(item.color === 'dark', `✓ ${item.square} is ${item.color}`, 'Dark')}>Dark</button>
        </div>
      )}

      {(item.kind === 'read' || item.kind === 'mental' || item.kind === 'san') && (
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
        <span>·</span>
        <span>streak {streak.current}</span>
        <button
          className="btn ghost small-btn"
          onClick={() => history.length && setReview(history.length - 1)}
          disabled={!history.length}
          title="Look back at the reps you have already answered (←)"
        >
          ◀ review {history.length ? `(${history.length})` : ''}
        </button>
      </div>
    </div>
  )
}
