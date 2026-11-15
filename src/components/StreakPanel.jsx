import React, { useMemo, useState } from 'react'
import {
  loadState, streakInfo, todayKey, shiftDay, dayOf, setGoal, exportCode, importCode, typeStats
} from '../lib/store'

const TYPE_LABEL = { square: 'Grid recall', knight: 'Knight jumps', read: 'Reading moves', play: 'Making moves' }

export default function StreakPanel({ onNavigate }) {
  const [state, setState] = useState(() => loadState())
  const [goalDraft, setGoalDraft] = useState(String(loadState().goal))
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')

  const info = streakInfo(state)
  const stats = useMemo(() => typeStats(state), [state.days])
  const days = Object.entries(state.days)
  const totalReps = days.reduce((a, [, d]) => a + (d.attempted || 0), 0)
  const totalCorrect = days.reduce((a, [, d]) => a + (d.correct || 0), 0)

  // 16 weeks of columns, ending on the current week
  const weeks = []
  const today = todayKey()
  const dow = (new Date(today + 'T00:00:00').getDay() + 6) % 7 // Monday-first, matching the labels
  let cursor = shiftDay(today, -(dow + 7 * 15))
  for (let w = 0; w < 16; w++) {
    const col = []
    for (let d = 0; d < 7; d++) {
      col.push(cursor)
      cursor = shiftDay(cursor, 1)
    }
    weeks.push(col)
  }

  const copyLink = () => {
    const url = `${location.origin}${location.pathname}#/day/${todayKey()}`
    navigator.clipboard?.writeText(url)
    setMsg('Copied today’s set link.')
  }

  return (
    <div className="page">
      <div className="score-grid wide">
        <div><b>{info.current}</b><span>current streak</span></div>
        <div><b>{info.best}</b><span>best streak</span></div>
        <div><b>{Object.keys(state.days).length}</b><span>days trained</span></div>
        <div><b>{totalCorrect}/{totalReps}</b><span>lifetime reps</span></div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Last 16 weeks</h3>
          <span className="small">a filled square = you hit the daily rep goal</span>
        </div>
        <div className="heatmap" role="img" aria-label="practice heatmap">
          <div className="hm-labels">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}
          </div>
          <div className="hm-grid">
            {weeks.map((col, ci) => (
              <div className="hm-col" key={ci}>
                {col.map((k) => {
                  const d = dayOf(state, k)
                  const hit = (d.attempted || 0) >= state.goal
                  const some = (d.attempted || 0) > 0
                  const future = k > today
                  return (
                    <div
                      key={k}
                      title={`${k}: ${d.attempted || 0} reps${hit ? ' (goal met)' : ''}`}
                      className={`hm-cell ${future ? 'future' : hit ? (info.current >= 7 ? 'hot' : 'on') : some ? 'partial' : ''} ${k === today ? 'now' : ''}`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Accuracy by drill</h3>
          <span className="small">lifetime, all days</span>
        </div>
        {Object.keys(TYPE_LABEL).map((t) => {
          const v = stats[t]
          const pct = v ? Math.round((v.correct / v.attempted) * 100) : 0
          return (
            <div className="acc-row" key={t}>
              <span className="acc-label">{TYPE_LABEL[t]}</span>
              <div className="bar"><div className={`bar-fill ${pct >= 75 ? 'ok' : pct >= 50 ? '' : 'low'}`} style={{ width: `${pct}%` }} /></div>
              <span className="acc-val">{v ? `${pct}%` : '—'}</span>
            </div>
          )
        })}
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Streak rule</h3></div>
        <p className="small">
          A day counts once you answer <b>{state.goal}</b> reps, right or wrong. Miss a day and the streak goes back to zero.
          Wrong answers get repeated at the end of the set, so a hard day still costs nothing but time.
        </p>
        <div className="row">
          <label className="field">
            daily rep goal
            <input
              type="number" min="1" max="999" value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value)}
            />
          </label>
          <button className="btn" onClick={() => { setState(setGoal(goalDraft)); setMsg('Goal saved.') }}>Save goal</button>
          <button className="btn" onClick={copyLink}>Copy today’s set link</button>
        </div>
        {msg && <p className="small ok-text">{msg}</p>}
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Move progress between devices / bots</h3></div>
        <p className="small">
          Progress lives in this browser only. Export a code, paste it into another browser (or into your reminder bot) and it can read your streak.
        </p>
        <div className="row">
          <button className="btn" onClick={() => { setCode(exportCode(state)); setMsg('Export code generated below.') }}>Generate export code</button>
          <input
            className="input grow" placeholder="paste an export code to import"
            value={code} onChange={(e) => setCode(e.target.value)}
          />
          <button className="btn primary" onClick={() => {
            try { setState(importCode(code)); setMsg('Imported.') } catch (e) { setMsg('That code did not parse.') }
          }}>Import</button>
        </div>
        {code && <textarea className="input code" readOnly value={code} rows={3} onClick={(e) => e.target.select()} />}
      </div>

      <div className="panel">
        <h3>Keep the streak alive with a bot</h3>
        <p className="small">
          Give <a href="./llms.txt" target="_blank" rel="noreferrer">/llms.txt</a> to Muse, Grok or any assistant with a scheduler.
          It contains the daily reminder prompt, the deep link for each date, and the coach-feed format for overriding tomorrow’s set.
        </p>
        <div className="row">
          <button className="btn" onClick={() => onNavigate('#/today')}>← back to today</button>
          <button className="btn ghost" onClick={() => onNavigate('#/tricks')}>cheat sheet</button>
        </div>
      </div>
    </div>
  )
}