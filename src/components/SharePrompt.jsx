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
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    try { localStorage.setItem(KEY, text) } catch (e) { /* private mode */ }
  }, [text])

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch (e) {
      // clipboard is denied in some embedded browsers — select the line so a manual copy is one tap
      const el = document.getElementById('share-prompt')
      if (el) { el.focus(); el.select() }
      try { document.execCommand('copy'); setCopied(true) } catch (e2) { setCopied(false) }
    }
  }

  return (
    <section className="panel share" id="share">
      <div className="share-head">
        <h3>Give this to your AI</h3>
        <span className="small">paste it into Muse, Grok, ChatGPT or Claude</span>
      </div>

      <div className="share-field">
        <input
          id="share-prompt"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onClick={(e) => e.target.select()}
          spellCheck="false"
          aria-label="Reminder prompt to give your AI"
        />
        <button className={`share-copy ${copied ? 'done' : ''}`} onClick={copy} title="Copy the prompt">
          {copied ? 'copied ✓' : 'copy'}
        </button>
      </div>

      <p className="share-note">
        <a href="./skill.txt" target="_blank" rel="noreferrer">Open the instructions →</a>
        <span> skill.txt holds the daily reminder task, the streak rules and how to read your export code.</span>
      </p>
    </section>
  )
}
