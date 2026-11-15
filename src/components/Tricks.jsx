import React from 'react'

const PIECES = [
  ['K', 'King'], ['Q', 'Queen'], ['R', 'Rook'], ['B', 'Bishop'], ['N', 'Knight'], ['(none)', 'Pawn']
]

const SYMBOLS = [
  ['x', 'takes (capture)'],
  ['+', 'check'],
  ['#', 'checkmate'],
  ['O-O', 'kingside castle'],
  ['O-O-O', 'queenside castle'],
  ['=Q', 'promotes to queen'],
  ['e.p.', 'en passant'],
  ['Nbd2', 'which knight (file disambiguation)'],
  ['R1e2', 'which rook (rank disambiguation)']
]

export default function Tricks({ onNavigate }) {
  return (
    <div className="page">
      <div className="panel">
        <h2>Three tricks that make notation fast</h2>
        <p className="small">
          Translating every square one at a time is the slow path — it never gets faster with repetition because the work is
          in the translation, not the board. These three remove the translation.
        </p>

        <h3>1. Memorise the grid, corners first</h3>
        <p>
          Files are a–h left to right, ranks 1–8 bottom up from White's side. Anchor the four corners
          (<b>a1, h1, a8, h8</b>) and the centre (<b>d4, e4, d5, e5</b>), then fill in from those anchors instead of counting
          from the edge.
        </p>
        <p className="small">
          Colour check, for free: a square is dark when file-index + rank is even (a1 dark, h1 light). The colour mode in the
          grid drill trains this without you thinking about it.
        </p>

        <h3>2. Learn the knight's eight-square fan</h3>
        <p>
          A knight is always 2 files + 1 rank or 1 file + 2 ranks from where it stands — eight destinations in the middle of the
          board, fewer at the edge. Once the fan is automatic, <b>Nf3</b> becomes a shape you see instead of a letter to spell.
        </p>
        <p className="small">
          Knight squares are also the best coordinate test: they touch a file and rank that are both different from the origin,
          so you cannot get the answer right by guessing one axis.
        </p>

        <h3>3. Read in chunks, tail first</h3>
        <p>
          Instead of N - x - e - 5 - +, parse three chunks: <b>piece → destination → tail</b>.
          "Knight takes e5, check." The tail decides urgency, so read it early: <b>+</b> means your king is in the answer,
          <b>#</b> means the game is over. That is what makes the move readable at speed.
        </p>
      </div>

      <div className="panel">
        <h3>Piece letters</h3>
        <table className="cheat">
          <tbody>
            {PIECES.map(([s, n]) => (
              <tr key={s}><td className="mono">{s}</td><td>{n}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3>Symbols and edge cases</h3>
        <table className="cheat">
          <tbody>
            {SYMBOLS.map(([s, n]) => (
              <tr key={s}><td className="mono">{s}</td><td>{n}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="small">
          Disambiguation only appears when two identical pieces can reach the same square: the file, or the rank when the files
          match, is inserted before the destination. <b>Ngf3</b> = the knight from the g-file, not the other one.
        </p>
      </div>

      <div className="panel">
        <h3>The 10-minute daily loop</h3>
        <ol className="tricks">
          <li>4 minutes: today's set (grid or knight day when you are new).</li>
          <li>3 minutes: read every move of one game out loud, one chunk at a time.</li>
          <li>3 minutes: speed day — same moves, clock on.</li>
        </ol>
        <p className="small">Ten days of that and you stop translating.</p>
        <div className="row">
          <button className="btn primary" onClick={() => onNavigate('#/today')}>Start today's set</button>
          <button className="btn ghost" onClick={() => onNavigate('#/streak')}>my streak</button>
        </div>
      </div>
    </div>
  )
}