import React, { useEffect, useState } from 'react'

const SITE = 'https://chess-notation-coach.vercel.app'
// v2: the block used to hold the whole reminder prompt; bumping the key discards that stale draft
// from anyone's browser so the one-line pointer shows up instead of the old wall of text.
const KEY = 'notation-coach-prompt-v2'
const SKILL = `${SITE}/skill.txt`

export const DEFAULT_PROMPT = `Read ${SKILL} and follow the instructions.`

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
        <span className="small">paste it into Muse, Grok, ChatGPT or Claude — the file holds the instructions</span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onClick={(e) => e.target.select()}
        spellCheck="false"
        aria-label="Reminder prompt to give your AI"
      />
      <div className="share-actions">
        <button className="btn primary big" onClick={() => copy(text, 'Copied — paste it into your AI.')}>Copy this prompt</button>
        <button className="btn" onClick={() => copy(SKILL, 'skill.txt link copied.')}>Copy skill.txt link</button>
        <button className="btn ghost" onClick={() => copy(`${SITE}/#/today`, 'Practice link copied.')}>Copy practice link</button>
        <button className="btn ghost" onClick={() => setText(DEFAULT_PROMPT)}>Reset</button>
        {msg && <span className="copied">{msg}</span>}
      </div>
      <p className="small">
        One line is all your assistant needs: it fetches <a href="./skill.txt" target="_blank" rel="noreferrer">skill.txt</a>,
        which carries the daily reminder task, the streak rules, how to read your export code and the JSON format for
        overriding a day’s set. Editable — change the wording (or the time) and it is saved in this browser.
      </p>
    </section>
  )
}