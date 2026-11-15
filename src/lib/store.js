// Persistent progress: per-day logs, streak, per-drill accuracy, goal.
// Everything lives in localStorage so the app stays a static site (no account, no server).
const KEY = 'notation-coach-v1'
const DEFAULT_GOAL = 10

// Drill preferences. `orientation` flips the board so notation can be read from Black's side.
export const DEFAULT_SETTINGS = {
  orientation: 'auto', // auto = the side to move | white | black | random
  blindKnight: false,  // hide the knight's square: you must picture where it stands
  coords: false        // show file/rank labels on the board
}

function normaliseSettings(s = {}) {
  const o = ['auto', 'white', 'black', 'random'].includes(s.orientation) ? s.orientation : 'auto'
  return { orientation: o, blindKnight: !!s.blindKnight, coords: !!s.coords }
}

export function todayKey(d = new Date()) {
  const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return t.toISOString().slice(0, 10)
}

export function shiftDay(key, delta) {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + delta)
  return dt.toISOString().slice(0, 10)
}

export function emptyDay() {
  return { attempted: 0, correct: 0, ms: 0, sets: 0, types: {}, started: Date.now() }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { version: 1, days: {}, best: 0, goal: DEFAULT_GOAL, name: '', settings: normaliseSettings() }
    const s = JSON.parse(raw)
    return {
      version: 1, days: s.days || {}, best: s.best || 0, goal: s.goal || DEFAULT_GOAL,
      name: s.name || '', settings: normaliseSettings(s.settings)
    }
  } catch (e) {
    return { version: 1, days: {}, best: 0, goal: DEFAULT_GOAL, name: '', settings: normaliseSettings() }
  }
}

export function saveState(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch (e) { /* private mode */ }
  return state
}

export function dayOf(state, key = todayKey()) {
  return state.days[key] || emptyDay()
}

// A day keeps the streak once it reaches the daily rep goal.
export function dayCounts(day, goal) {
  return (day.attempted || 0) >= goal
}

export function streakInfo(state, goal = state.goal) {
  const today = todayKey()
  let current = 0
  let cursor = dayCounts(dayOf(state, today), goal) ? today : shiftDay(today, -1)
  while (dayCounts(dayOf(state, cursor), goal)) {
    current++
    cursor = shiftDay(cursor, -1)
    if (current > 5000) break
  }
  const todayDone = dayCounts(dayOf(state, today), goal)
  const yesterdayDone = dayCounts(dayOf(state, shiftDay(today, -1)), goal)
  // best streak ever, recomputed from history so imports/edits stay honest
  let best = 0, run = 0
  Object.keys(state.days).sort().forEach((k, i, arr) => {
    if (!dayCounts(state.days[k], goal)) { run = 0; return }
    const prev = arr[i - 1]
    run = prev && shiftDay(prev, 1) === k ? run + 1 : 1
    best = Math.max(best, run)
  })
  return {
    current, best: Math.max(best, state.best || 0), todayDone, yesterdayDone,
    todayReps: dayOf(state, today).attempted || 0, goal
  }
}

export function recordAnswer(type, correct, ms, extra = {}) {
  const state = loadState()
  const key = todayKey()
  const day = state.days[key] || emptyDay()
  day.attempted += 1
  if (correct) day.correct += 1
  day.ms += ms
  day.types[type] = day.types[type] || { attempted: 0, correct: 0 }
  day.types[type].attempted += 1
  if (correct) day.types[type].correct += 1
  if (extra.setDone) day.sets = (day.sets || 0) + 1
  state.days[key] = day
  const info = streakInfo(state)
  state.best = Math.max(state.best || 0, info.current, info.best)
  saveState(state)
  try { window.dispatchEvent(new Event('coach:progress')) } catch (e) { /* non-browser */ }
  return state
}

export function setSetting(key, value) {
  const s = loadState()
  s.settings = normaliseSettings({ ...s.settings, [key]: value })
  saveState(s)
  try { window.dispatchEvent(new Event('coach:progress')) } catch (e) { /* non-browser */ }
  return s
}

export function setGoal(goal) {
  const s = loadState()
  s.goal = Math.max(1, Math.min(999, Number(goal) || DEFAULT_GOAL))
  saveState(s)
  return s
}

// Lifetime accuracy per drill type, used to pick what today's set should hammer.
export function typeStats(state) {
  const out = {}
  Object.values(state.days).forEach((d) => {
    Object.entries(d.types || {}).forEach(([t, v]) => {
      out[t] = out[t] || { attempted: 0, correct: 0 }
      out[t].attempted += v.attempted
      out[t].correct += v.correct
    })
  })
  return out
}

export function lastPracticed(state, type) {
  const keys = Object.keys(state.days).filter((k) => state.days[k].types && state.days[k].types[type]).sort()
  return keys.length ? keys[keys.length - 1] : null
}

export function exportCode(state = loadState()) {
  return btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, days: state.days, goal: state.goal, settings: state.settings }))))
}

export function importCode(code) {
  const data = JSON.parse(decodeURIComponent(escape(atob(String(code).trim()))))
  const s = loadState()
  s.days = { ...s.days, ...(data.days || {}) }
  if (data.goal) s.goal = data.goal
  if (data.settings) s.settings = normaliseSettings(data.settings)
  saveState(s)
  return s
}

export { DEFAULT_GOAL }