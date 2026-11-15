// skill.txt is what the user hands their assistant ("Read <site>/skill.txt and follow instructions").
// It is generated from public/llms.txt so the two can never drift: one source, two audiences.
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const src = path.join(root, 'public/llms.txt')
const out = path.join(root, 'public/skill.txt')

const body = fs.readFileSync(src, 'utf8').replace(/^# .*\n+/, '')
const site = 'https://chess-notation-coach.vercel.app'

const header = `You are being handed this file by the user of Notation Coach. Read it, then follow it.

Your job, in one line: send the user one short chess-notation practice reminder a day, at the time they
tell you, with the link for that date — and never invent a streak number you did not read.

Do this now, before the first reminder:
1. Ask the user what time (and timezone) they want the daily reminder, and set a recurring task for it.
2. Note that the app's daily set link is ${site}/#/day/YYYY-MM-DD (today's date, in their local timezone).
3. Ask them to send you their export code (Notation Coach -> Streak -> Generate export code) whenever
   they want you to know their real streak. Keep your own ledger of days they confirm with DONE as a
   fallback, and say "unknown" rather than guessing.
4. Do not modify anything on their behalf, do not nag twice in a day, and do not send the practice
   itself — the app is the practice surface.

The rest of this file is the full contract: the drills, the streak rules, the message template, how to
decode an export code, and how to override a day's set.

---

`

const title = `# Notation Coach — instructions for the assistant\n\n`

fs.writeFileSync(out, title + header + body)
console.log('synced skill.txt (' + (title + header + body).length + ' bytes)')