import React, { useEffect, useState } from 'react'

const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
const FILES = 'abcdefgh'

export function parseFen(fen) {
  const board = {}
  const rows = (fen || '').split(' ')[0].split('/')
  rows.forEach((row, ri) => {
    let file = 0
    const rank = 8 - ri
    for (const ch of row) {
      if (/\d/.test(ch)) { file += Number(ch); continue }
      board[FILES[file] + rank] = { type: ch.toLowerCase(), color: ch === ch.toUpperCase() ? 'w' : 'b' }
      file++
    }
  })
  return board
}

export default function Board({
  fen = null, orientation = 'white', onSquare = null, marked = {}, selectable = true, size = 480, coords = false,
  pieces = {} // extra piece overlays for empty boards, e.g. { b5: { type: 'n', color: 'w' } }
}) {
  const [vp, setVp] = useState(() => (typeof window === 'undefined' ? { w: 900, h: 900 } : { w: window.innerWidth, h: window.innerHeight }))
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const board = fen ? parseFen(fen) : {}
  const ranks = orientation === 'white' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8]
  const files = orientation === 'white' ? [...FILES] : [...FILES].reverse()
  // never wider than the phone viewport, never taller than the remaining screen
  const fitted = Math.min(size, vp.w - 44, Math.max(240, vp.h - 300))
  const cell = Math.floor(fitted / 8)

  return (
    <div className="board" style={{ width: cell * 8, height: cell * 8 }}>
      {ranks.map((rank) => files.map((file) => {
        const square = file + rank
        const dark = (FILES.indexOf(file) + rank - 1) % 2 === 0
        const piece = board[square] || pieces[square]
        const mark = marked[square] || ''
        return (
          <div
            key={square}
            className={`sq ${dark ? 'dark' : 'light'} ${mark} ${selectable && onSquare ? 'clickable' : ''}`}
            style={{ width: cell, height: cell, fontSize: cell * 0.78 }}
            onClick={selectable && onSquare ? () => onSquare(square) : undefined}
            data-square={square}
          >
            {coords && file === files[0] && <span className="rank-label">{rank}</span>}
            {coords && rank === ranks[7] && <span className="file-label">{file}</span>}
            {piece && <span className={`piece ${piece.color === 'w' ? 'white-piece' : 'black-piece'}`}>{GLYPH[piece.type]}</span>}
            {mark === 'target' && <span className="dot" />}
            {mark === 'hit' && <span className="hit" />}
            {mark === 'bad' && <span className="bad" />}
          </div>
        )
      }))}
    </div>
  )
}