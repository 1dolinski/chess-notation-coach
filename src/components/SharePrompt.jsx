import React, { useEffect, useState } from 'react'

const SITE = 'https://chess-notation-coach.vercel.app'
const KEY = 'notation-coach-prompt-v1'

export const DEFAULT_PROMPT = `You are my chess notation coach. Remind me once a day at 19:00 my time to do today's set, and keep it to one short message.

Every day:
1. My current streak. If you don't know it, ask me for my export code (Notation Coach → Streak → Generate export code) and decode it. Never guess a streak number.
2. Today's set: ${SITE}/#/day/<TODAY as YYYY-MM-DD>
3. One coaching line, rotating by weekday:
   - Grid: corners a1, h1, a8, h8 first, then the centre d4 e4 d5 e5. Squares are names, not coordinates.
   - Knight: every knight move is 2 files + 1 rank, or 1 file + 2 ranks. Learn the eight-square fan once.
   - Chunks: read "knight to f3", never "N - f - 3". Read the tail first: + check, # mate, x takes.
4. Ask me to reply DONE. When I do, log the day. If I skip, don't nag twice — just tell me the streak resets to zero.

Full instructions, streak decoding and how to override a day's set: ${SITE}/llms.txt`

export default function SharePrompt() {
  const [text, setText] = useState(() => {
    try { return localStorage.getItem(KEY) || DEFAULT_PROMPT } catch (e) { return DEFAULT_PROMPT }
  })
  const [msg, setMsg] = useState('')

  useEffect(() => {
    try { localStorage.setItem(KEY, text) } catch (e) { /* private mode */ }
  }, [text])

  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(''), 2600)
    return () => clearTimeout(t)
  }, [msg])

  async function copy(value, label) {
    try {
      await navigator.clipboard.writeText(value)
      setMsg(label)
    } catch (e) {
      const ta = document.createElement('textarea')
      ta.value = value
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy'); setMsg(label) } catch (e2) { setMsg('Copy failed — select the text and copy manually.') }
      document.body.removeChild(ta)
    }
  }

  return (
    <section className="panel share" id="share">
      <div className="share-head">
        <h3>Give this to your AI</h3>
        <span className="small">paste it into Muse, Grok, ChatGPT or Claude — it sets the daily reminder for you</span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onClick={(e) => e.target.select()}
        spellCheck="false"
        aria-label="Reminder prompt to give your AI"
      />
      <div className="share-actions">
        <button className="btn primary big" onClick={() => copy(text, 'Prompt copied — paste it into your AI.')}>Copy this prompt</button>
        <button className="btn" onClick={() => copy(`${SITE}/llms.txt`, 'llms.txt link copied.')}>Copy llms.txt link</button>
        <button className="btn ghost" onClick={() => copy(`${SITE}/#/today`, 'Practice link copied.')}>Copy practice link</button>
        <button className="btn ghost" onClick={() => setText(DEFAULT_PROMPT)}>Reset</button>
        {msg && <span className="copied">{msg}</span>}
      </div>
      <p className="small">
        Editable — change the time and it is saved in this browser. The prompt points at{' '}
        <a href="./llms.txt" target="_blank" rel="noreferrer">llms.txt</a>, which carries the full reminder contract,
        the streak decoding rules and the JSON format for overriding a day’s set.
      </p>
    </section>
  )
}