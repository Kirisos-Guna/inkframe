// Test stand-in for Claude, used when INKFRAME_FAKE_AGENT=1. It answers each kind of prompt the pipeline sends
// and writes real scenes with the kit, so bundling, rendering, checks and assembly can be tested without an AI.
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { AgentOpts } from './agent'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function fakeAgent(o: AgentOpts): Promise<string> {
  await wait(300)
  const p = o.prompt
  if (p.includes('Plan it by splitting the voiceover')) {
    const dur = Number(p.match(/Voiceover length: ([\d.]+)/)?.[1] ?? 30)
    const n = Math.max(2, Math.round(dur / 9))
    const titles = ['You hit send', 'Into the air', 'Under the sea', 'The data center', 'Rows of servers', 'One GPU', 'Inside the chip', 'Word by word']
    const parts = Array.from({ length: n }, (_, i) => ({
      start: (dur * i) / n,
      end: (dur * (i + 1)) / n,
      title: titles[i % titles.length],
      idea: `A pen draws ${titles[i % titles.length].toLowerCase()} as one clear picture.`
    }))
    return '```json\n' + JSON.stringify({ title: 'Where Your Prompt Actually Goes', parts }) + '\n```'
  }
  if (p.includes('before it ships')) return '{"ok": true, "notes": []}'
  if (p.includes('Design a cartoon character')) return '{"name":"Rosa","hair":"Curly","hairColour":"#b3423a","outfit":"Apron","outfitColour":"#2f9e6b","glasses":true,"expression":"Happy","pose":"Wave"}'
  if (p.includes('learning a visual style')) {
    writeFileSync(join(o.cwd, 'STYLE_GUIDE.md'), 'Thin white lines on deep blue-black. Things are drawn on as they are said.')
    return '{"name":"Pen on Black","tags":["Pen","Dark"],"description":"Glowing white pen lines on a deep blue-black board.","dim":"2D","palette":{"bg":"#06101c","ink":"#e8f2ff","accent":"#f5a623"},"stroke":{"width":2,"jitter":0.3,"texture":"pen"}}'
  }
  const file = p.match(/scenes\/([\w-]+)\.tsx/)?.[1]
  if (!file) throw new Error('Fake agent: unknown prompt')
  const target = join(o.cwd, 'scenes', `${file}.tsx`)
  mkdirSync(dirname(target), { recursive: true })
  o.onStep?.('Reading the method')
  o.onStep?.('Reading the style')
  const title = p.match(/: "([^"]+)" \(/)?.[1] ?? p.match(/line, in this style:\n"([^"]+)"/)?.[1]?.slice(0, 30) ?? 'Test'
  const bigger = /bigger|label/i.test(p) && existsSync(target)
  o.onStep?.(existsSync(target) ? `Changing ${file}` : `Drawing ${file}`)
  writeFileSync(
    target,
    `import { useScene, Board, Draw, shape, Write, Pop, Travel } from '@kit'

export default function Scene() {
  const { dur, palette } = useScene()
  const a = Math.round(dur * 0.05)
  const b = Math.round(dur * 0.35)
  const c = Math.round(dur * 0.6)
  const s = ${bigger ? 1.5 : 1}
  const path = shape.curve(420, 640, 1500, 640, 0.3)
  return (
    <Board>
      <Draw d={shape.rect(960 - 260 * s, 300, 520 * s, 300 * s, 30)} start={a} dur={Math.round(dur * 0.25)} />
      <Write text=${JSON.stringify(title)} x={960} y={250} size={84} start={a + 4} align="middle" />
      <Draw d={path} start={b} dur={Math.round(dur * 0.2)} color={palette.accent} dashed />
      <Travel d={path} start={b + 10} dur={Math.round(dur * 0.4)} />
      <Pop start={c} x={960} y={860}>
        <Write text="one idea at a time" x={960} y={880} size={52} start={c} align="middle" color={palette.accent} />
      </Pop>
    </Board>
  )
}
`
  )
  return bigger ? 'Made the box bigger and labelled it.' : `Drew ${title}.`
}

export const fakeEnabled = () => process.env.INKFRAME_FAKE_AGENT === '1'
