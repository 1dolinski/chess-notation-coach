// builder-log.md is the source of truth; this mirrors it to public/builder-log.txt
// so the shipped site serves it at /builder-log.txt as plain text.
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const md = fs.readFileSync(path.join(root, 'builder-log.md'), 'utf8')
const body = md.replace(/^# .*\n/, '')
fs.mkdirSync(path.join(root, 'public'), { recursive: true })
fs.writeFileSync(
  path.join(root, 'public/builder-log.txt'),
  'chess-notation-coach — builder log (plain text mirror of builder-log.md)\n' + '='.repeat(72) + '\n' + body
)
console.log('synced builder-log.txt')