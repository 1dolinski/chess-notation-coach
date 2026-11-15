import React, { useEffect, useMemo, useState } from 'react'
import Session from './Session'
import Hero from './Hero'
import SharePrompt from './SharePrompt'
import { planForDate, extraSet, mentalSet, meta, diagnosis } from '../lib/daily'
import { loadState, streakInfo, todayKey, dayOf } from '../lib/store'

const KIND_LABEL = {
  square: 'grid recall',
  knight: 'knight jumps',
  read: 'read the move',
  play: 'make the move',
  mental: 'mental tricks'
}

export default function Today({ dateKey = todayKey(), themeOverride = null, onNavigate }) {
  const [state, setState] = useState(() => loadState())
  const [session, setSession] = useState(null) // 'set' | 'extra' | 'mental'

  const prefs = state.settings

  useEffect(() => {
    const sync = () => setState(loadState())
    window.addEventListener('coach:progress', sync)
    return () => window.removeEventListener('coach:progress', sync)
  }, [])

  const plan = useMemo(() => planForDate(dateKey, state, { theme: themeOverride }), [dateKey, themeOverride, state.days])
  const info = useMemo(() => streakInfo(state), [state])
  const diag = useMemo(() => diagnosis(state), [state])
  const day = dayOf(state, todayKey())

  const items = session === 'set' ? plan.items : session === 'extra' ? extraSet() : session === 'mental' ? mentalSet(10) : []

  if (session) {
    return (
      <Session
        key={session}
        items={items}
        title={session === 'set' ? plan.label : session === 'extra' ? 'Extra reps' : 'Mental tricks'}
        settings={prefs}
        onExit={() => { setSession(null); setState(loadState()) }}
        onFinish={session === 'set' ? () => setSession('extra') : () => setSession(null)}
      />
    )
  }

  const isToday = dateKey === todayKey()
  const target = info.goal
  const pct = Math.min(100, Math.round((day.attempted / target) * 100))

  return (
    <div className="page">
      <Hero
        plan={plan}
        info={info}
        dateKey={dateKey}
        isToday={isToday}
        onStart={() => setSession('set')}
        onExtra={() => setSession('extra')}
        onMental={() => setSession('mental')}
      />

      <div className="panel streak-strip">
        <div className="streak-big">
          <span className="flame">🔥</span>
          <b>{info.current}</b>
          <span>day streak</span>
        </div>
        <div className="goal-wrap">
          <div className="goal-line">
            <span>{day.attempted}/{target} reps today</span>
            <span className={info.todayDone ? 'ok' : 'warn'}>
              {info.todayDone ? 'banked ✓' : info.yesterdayDone || info.current > 0 ? 'keep it alive' : 'start the streak'}
            </span>
          </div>
          <div className="bar"><div className={`bar-fill ${info.todayDone ? 'ok' : ''}`} style={{ width: `${pct}%` }} /></div>
          <div className="goal-line small">
            <span>best {info.best} days</span>
            <button className="link" onClick={() => onNavigate('#/streak')}>full history →</button>
          </div>
        </div>
      </div>

      <SharePrompt />

      {diag.weak && (
        <div className="panel note">
          <b>Coach read:</b> weakest area is <b>{KIND_LABEL[diag.weak.type] || diag.weak.type}</b> at{' '}
          {Math.round(diag.weak.accuracy * 100)}% over {diag.weak.attempted} reps. The set grows extra reps there until it passes 75%.
        </div>
      )}

      <div className="panel">
        <h3>Three tricks (read these once, then live them)</h3>
        <ol className="tricks">
          <li><b>Grid, not letters.</b> Four corners + centre first: a1, h1, a8, h8, then d4 e4 d5 e5. Say the square name out loud as you click it in grid drills.</li>
          <li><b>Knight jumps.</b> Every knight move is 2 files + 1 rank or 1 file + 2 ranks. Learn the eight-square fan once and knight notation stops needing thought.</li>
          <li><b>Chunk, don’t spell.</b> “N - f - 3” is slow; “knight to f3” is one chunk. Read the piece letter, then the destination square, then the tail symbol (x + #).</li>
        </ol>
        <button className="link" onClick={() => onNavigate('#/tricks')}>full cheat sheet →</button>
      </div>

      <p className="footer-note">
        Positions from {meta.games} world championship games (1886–2018) · drill build {meta.generated} ·{' '}
        <a href="./skill.txt" target="_blank" rel="noreferrer">skill.txt</a> for your reminder bot
      </p>
    </div>
  )
}