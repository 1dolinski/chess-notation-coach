import React from 'react'

const KIND_LABEL = {
  square: 'grid recall',
  knight: 'knight jumps',
  read: 'read the move',
  play: 'make the move'
}

function prettyDate(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

export default function Hero({ plan, info, dateKey, isToday, onStart, onExtra, coords, setCoords }) {
  const breakdown = plan.items.reduce((acc, it) => {
    acc[it.kind] = (acc[it.kind] || 0) + 1
    return acc
  }, {})

  return (
    <section className="hero">
      <div className="hero-media" aria-hidden="true" />
      <div className="hero-body">
        <img className="hero-logo" src="./logo.png" alt="Notation Coach" width="64" height="64" />
        <div className="kicker">
          {isToday ? 'Today' : prettyDate(dateKey)} · {plan.label}
        </div>
        <h1>Read chess notation at a glance.</h1>
        <p className="hero-sub">{plan.why}</p>
        <div className="chips">
          {Object.entries(breakdown).map(([k, v]) => (
            <span className="chip" key={k}>{v} × {KIND_LABEL[k]}</span>
          ))}
          <span className="chip ghost">{plan.items.length} reps · ≈ {Math.max(3, Math.round(plan.items.length * 0.35))} min</span>
          <span className={`badge ${plan.source === 'bot' ? 'bot' : ''}`}>{plan.source === 'bot' ? 'bot feed' : 'coach pick'}</span>
        </div>
        <div className="hero-cta">
          <button className="btn primary big" onClick={onStart}>Start {plan.items.length}-rep set</button>
          <button className="btn ghost" onClick={onExtra}>Extra reps</button>
          <label className="toggle">
            <input type="checkbox" checked={coords} onChange={(e) => setCoords(e.target.checked)} />
            show coordinates
          </label>
        </div>
        <p className="small">{plan.tip}</p>
        {!isToday && <p className="small">Set for {dateKey} — reps still count toward today’s streak.</p>}
      </div>
    </section>
  )
}