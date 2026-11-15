import React, { useEffect, useState } from 'react'
import Today from './components/Today'
import StreakPanel from './components/StreakPanel'
import Tricks from './components/Tricks'
import { streakInfo, loadState, todayKey } from './lib/store'

function parse(hash) {
  const raw = (hash || '').replace(/^#\/?/, '')
  const [path, query] = raw.split('?')
  const q = new URLSearchParams(query || '')
  const theme = q.get('theme') || null
  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'day' && /^\d{4}-\d{2}-\d{2}$/.test(parts[1] || '')) return { view: 'today', date: parts[1], theme }
  if (parts[0] === 'streak') return { view: 'streak' }
  if (parts[0] === 'tricks') return { view: 'tricks' }
  return { view: 'today', date: todayKey(), theme }
}

export default function App() {
  const [route, setRoute] = useState(() => parse(location.hash))
  const [state, setState] = useState(() => loadState())

  useEffect(() => {
    const sync = () => { setRoute(parse(location.hash)); setState(loadState()) }
    window.addEventListener('hashchange', sync)
    window.addEventListener('coach:progress', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('coach:progress', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const navigate = (hash) => { location.hash = hash; setState(loadState()) }
  const info = streakInfo(state)

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/today" onClick={() => setState(loadState())}>
          <img src="./logo.png" alt="" width="26" height="26" />
          <span className="brand-label">Notation Coach</span>
        </a>
        <nav>
          <a className={route.view === 'today' ? 'active' : ''} href="#/today">Today</a>
          <a className={route.view === 'streak' ? 'active' : ''} href="#/streak">Streak</a>
          <a className={route.view === 'tricks' ? 'active' : ''} href="#/tricks">Tricks</a>
        </nav>
        <div className={`streak-pill ${info.todayDone ? 'done' : ''}`} title={`${info.todayReps}/${info.goal} reps today`}>
          🔥 {info.current}
        </div>
      </header>

      {route.view === 'today' && <Today key={route.date + (route.theme || '')} dateKey={route.date} themeOverride={route.theme} onNavigate={navigate} />}
      {route.view === 'streak' && <StreakPanel onNavigate={navigate} />}
      {route.view === 'tricks' && <Tricks onNavigate={navigate} />}

      <footer className="foot">
        <span>Built on <a href="https://github.com/mattjliu/Notation-Trainer" target="_blank" rel="noreferrer">Notation-Trainer</a> by <a href="https://github.com/mattjliu" target="_blank" rel="noreferrer">Matthew Liu</a> (MIT) · positions from world championship games</span>
        <a href="./builder-log.txt" target="_blank" rel="noreferrer">builder log</a>
        <a href="./skill.txt" target="_blank" rel="noreferrer">skill.txt</a>
        <a href="./llms.txt" target="_blank" rel="noreferrer">llms.txt</a>
        <a href="https://github.com/1dolinski/chess-notation-coach" target="_blank" rel="noreferrer">source</a>
      </footer>
    </div>
  )
}