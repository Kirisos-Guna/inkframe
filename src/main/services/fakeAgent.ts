// Test stand-in for Claude, used when INKFRAME_FAKE_AGENT=1. It answers each kind of prompt the pipeline sends
// and writes real scenes with the kit, so bundling, rendering, checks and assembly can be tested without an AI.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { AgentOpts } from './agent'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
let limitHit = false
let fixLimitHit = false
let skipped = false
/** INKFRAME_FAKE_LOG=file: one line per check or fix call, so tests can count what ran. */
const log = (line: string) => process.env.INKFRAME_FAKE_LOG && appendFileSync(process.env.INKFRAME_FAKE_LOG, line + '\n')

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
  if (p.includes('before it ships')) {
    const nums = [...p.matchAll(/^Part (\d+) "/gm)].map((m) => +m[1])
    log(`check ${nums.join(',')}`)
    // INKFRAME_FAKE_LIMIT=1: the first check hits the usage limit, which resets 5 seconds later.
    if (process.env.INKFRAME_FAKE_LIMIT === '1' && !limitHit) {
      limitHit = true
      throw new Error(`Claude AI usage limit reached|${Math.floor(Date.now() / 1000) + 5}`)
    }
    // INKFRAME_FAKE_NOTES=2,3: those parts always get a note.
    const noted = (process.env.INKFRAME_FAKE_NOTES ?? '').split(',').filter(Boolean).map(Number)
    // INKFRAME_FAKE_SKIP=1: the checker forgets that part in its first answer.
    const skip = Number(process.env.INKFRAME_FAKE_SKIP ?? 0)
    const answer = nums.filter((n) => !(n === skip && !skipped && (skipped = true)))
    return JSON.stringify({ parts: answer.map((n) => (noted.includes(n) ? { part: n, ok: false, notes: ['Text is too small'] } : { part: n, ok: true, notes: [] })) })
  }
  // Finding a style: the searches, then the picks from the list of results.
  if (p.includes('Write 3 YouTube searches')) return JSON.stringify({ topic: 'Cloud and Kubernetes', queries: ['kubernetes explained tamil', 'cloud computing eppadi velai seikirathu tamil'] })
  if (p.includes('Pick the 4 best to learn')) {
    const ids = [...p.matchAll(/^(\S+) · [\d,]+ views/gm)].map((m) => m[1])
    return JSON.stringify({ picks: ids.slice(0, 2) })
  }
  if (p.includes('A reviewer found')) {
    const n = Number(p.match(/Part (\d+) of \d+/)?.[1])
    log(`fix ${n}`)
    // INKFRAME_FAKE_FIXFAIL=3: the automatic fix of that part fails.
    if (String(n) === process.env.INKFRAME_FAKE_FIXFAIL) throw new Error('The model stopped half way (test)')
    // INKFRAME_FAKE_FIXLIMIT=3: the first fix of that part hits the session limit (worded as Claude Code does).
    if (String(n) === process.env.INKFRAME_FAKE_FIXLIMIT && !fixLimitHit) {
      fixLimitHit = true
      throw new Error("You've hit your session limit · resets 2pm")
    }
  }
  if (p.includes('Design a cartoon character')) return '{"name":"Rosa","hair":"Curly","hairColour":"#b3423a","outfit":"Apron","outfitColour":"#2f9e6b","glasses":true,"expression":"Happy","pose":"Wave"}'
  if (p.includes('learning a visual style')) {
    writeFileSync(join(o.cwd, 'STYLE_GUIDE.md'), 'Thin white lines on deep blue-black. Things are drawn on as they are said.')
    return '{"name":"Pen on Black","tags":["Pen","Dark"],"description":"Glowing white pen lines on a deep blue-black board.","dim":"2D","palette":{"bg":"#06101c","ink":"#e8f2ff","accent":"#f5a623"},"stroke":{"width":2,"jitter":0.3,"texture":"pen"}}'
  }
  // Scripts: a deliberately weak first draft (a tired opening, the wrong length), so the app's check and its one
  // revision run; the revision fixes both.
  const filler = (n: number) => Array.from({ length: Math.max(0, n) }, (_, i) => (i % 11 === 10 ? 'waves.' : 'radio')).join(' ')
  if (p.includes('This voiceover script needs a revision')) {
    log('script revision')
    const n = Number(p.match(/Stay at about (\d+) words/)?.[1] ?? 150)
    return JSON.stringify({ script: `Your question never reaches the cloud. It walks.\n\n${filler(n - 8)}` })
  }
  if (p.includes('voiceover scripts for faceless explainer')) {
    log('script')
    return JSON.stringify({
      title: 'Where Your Prompt Actually Goes',
      hooks: ['Every question you type takes a longer trip than your last holiday.', 'There is a building that hears your question before your friends do.'],
      script: 'In this video, let us dive in.\n\nYou type a question and hit send.',
      sources: ['example.com']
    })
  }
  if (p.includes('make their own version of a YouTube video')) {
    return JSON.stringify({
      analysis: { concept: 'Follow one prompt from phone to chip', audience: 'Curious beginners', hook: 'Opens on the moment you hit send', structure: [{ at: '0:00', beat: 'You hit send', purpose: 'Hook' }, { at: '0:30', beat: 'The data center', purpose: 'Reveal' }], devices: ['A journey', 'A reveal'] },
      title: 'The Secret Trip of Your Question',
      hooks: ['A question about cats once crossed an ocean twice.'],
      script: 'You press send.\n\nYour words fly off as radio waves.',
      direction: 'A pen follows the question from phone to tower to cable to server.'
    })
  }
  if (p.includes('YouTube upload text')) {
    return JSON.stringify({
      titles: ['Where Your Prompt Really Goes', 'The Trip Your Prompt Takes'],
      description: 'Your prompt travels further than you think.\n\nChapters\n0:00 You hit send\n\n#AI #explained',
      tags: ['how ai works', 'chatgpt explained'],
      hashtags: ['#AI']
    })
  }
  if (p.includes('caption lines from a speech-to-text')) {
    const n = Number(p.match(/exactly (\d+) lines/)?.[1] ?? 0)
    const lines = JSON.parse(p.slice(p.indexOf('Lines (JSON):') + 13, p.indexOf('Reply with JSON only')).trim()) as string[]
    return JSON.stringify({ lines: lines.slice(0, n).map((l) => l.charAt(0).toUpperCase() + l.slice(1)) })
  }
  // HTML (HyperFrames) parts: fill the starter.
  const html = p.match(/(scenes\/[\w-]+\/index\.html)/)?.[1]
  if (html) {
    const target = join(o.cwd, html)
    o.onStep?.('Reading the method')
    o.onStep?.(`Drawing ${html}`)
    let doc = readFileSync(target, 'utf8')
    const dur = Number(doc.match(/data-duration="([\d.]+)"/)?.[1] ?? 5)
    const title = p.match(/: "([^"]+)" \(/)?.[1] ?? 'Part'
    doc = doc.replace(
      /<!-- elements:[^>]*-->/,
      `<div id="t" class="clip" data-start="0" data-duration="${dur}" style="left:0;width:1920px;top:380px;text-align:center;font-size:120px;opacity:0;font-family:'Inter';font-weight:800">${title}</div>
  <div id="bar" class="clip" data-start="0" data-duration="${dur}" style="left:460px;top:640px;width:0;height:28px;background:var(--accent);border-radius:14px"></div>`
    )
    doc = doc.replace(
      "// tl.to('#id', { opacity: 1, duration: 0.5 }, seconds);",
      `tl.to('#t', { opacity: 1, y: -30, duration: 0.6 }, 0.2);\n  tl.to('#bar', { width: 1000, duration: ${Math.max(0.5, dur * 0.5).toFixed(2)} }, 0.6);`
    )
    writeFileSync(target, doc)
    return 'Drew the HTML part.'
  }
  // Real 3D styles get a three.js scene.
  const style3d = existsSync(join(o.cwd, 'STYLE.md')) && readFileSync(join(o.cwd, 'STYLE.md'), 'utf8').includes('This style is real 3D')
  const file3d = p.match(/scenes\/([\w-]+)\.tsx/)?.[1]
  if (style3d && file3d && !file3d.startsWith('thumb-')) {
    o.onStep?.('Reading the method')
    o.onStep?.(`Drawing ${file3d}`)
    writeFileSync(
      join(o.cwd, 'scenes', `${file3d}.tsx`),
      `import { useScene, AbsoluteFill } from '@kit'
import { Stage3D, useProgress, usePop, Clay, PaperPlane } from '@kit/three'

export default function Scene() {
  const { dur, palette } = useScene()
  const fly = useProgress(0, Math.round(dur * 0.8))
  const pop = usePop(Math.round(dur * 0.3))
  return (
    <AbsoluteFill>
      <Stage3D light="paper" camera={[{ at: 0, pos: [0, 4, 12], look: [0, 1, 0] }, { at: dur, pos: [3, 3, 8], look: [0, 1, 0] }]}>
        <group position={[-6 + fly * 8, 2.2, 0]} rotation={[0, -Math.PI / 2, 0.1]}><PaperPlane /></group>
        <mesh position={[2, 0.75, -2]} scale={pop} castShadow><boxGeometry args={[1.5, 1.5, 1.5]} /><Clay color={palette.accent} /></mesh>
      </Stage3D>
    </AbsoluteFill>
  )
}
`
    )
    return 'Drew a 3D part.'
  }
  // The Dark Systems Diagram style is drawn with its building blocks (Steps is left out of the import on purpose).
  const tamil = !!o.system?.includes('is in Tamil')
  const systems = existsSync(join(o.cwd, 'STYLE.md')) && readFileSync(join(o.cwd, 'STYLE.md'), 'utf8').includes('@kit/systems')
  const sysFiles = [...new Set([...p.matchAll(/scenes\/([\w-]+)\.tsx/g)].map((m) => m[1]))].filter((f) => !f.startsWith('thumb-'))
  if (systems && sysFiles.length) {
    for (const file of sysFiles) {
      o.onStep?.(`Drawing ${file}`)
      writeFileSync(
        join(o.cwd, 'scenes', `${file}.tsx`),
        `import { useScene, Board } from '@kit'
import { SIGNAL, Browser, Server, Connector, Packet, Pill, SectionTitle, Focus, Layer } from '@kit/systems'

export default function Scene() {
  const { dur } = useScene()
  const q = Math.round(dur * 0.55)
  return (
    <Board>
      <Focus start={q} end={q + 30}>
        <Browser x={160} y={210} w={640} h={330} url="google.com" secure start={0} />
        <Connector x1={480} y1={560} x2={480} y2={760} color={SIGNAL.cyan} start={12} />
        <Pill x={330} y={660} text="TCP" color={SIGNAL.cyan} start={20} />
        <Pill x={630} y={660} text="${tamil ? 'இணையம்' : 'HTTP'}" color={SIGNAL.amber} start={26} />
        <Packet x1={480} y1={570} x2={480} y2={740} text="<html>" start={34} dur={30} />
        <Server x={330} y={780} logo={[SIGNAL.cyan, SIGNAL.pink, SIGNAL.amber]} start={8} />
        <Layer x={980} y={260} w={780} name="HTTP" color={SIGNAL.amber} start={10} />
        <Layer x={980} y={350} w={780} name="TLS" color={SIGNAL.pink} start={14} />
        <Layer x={980} y={440} w={780} name="TCP" color={SIGNAL.cyan} start={18} />
        <Pill x={1520} y={475} text="port 443" color={SIGNAL.amber} size={22} mono start={30} />
      </Focus>
      <SectionTitle text="${tamil ? 'TCP மற்றும் HTTP எப்படி இணைகின்றன?' : 'How do TCP and HTTP work together?'}" words={{ TCP: SIGNAL.cyan, HTTP: SIGNAL.amber }} start={q} />
      <Steps x={1370} y={900} count={4} current={2} label="TCP, then HTTP" start={Math.round(dur * 0.4)} />
    </Board>
  )
}
`
      )
    }
    return `Drew ${sysFiles.length} part${sysFiles.length > 1 ? 's' : ''} with the building blocks.`
  }
  // Every scene file the prompt names (a batch names several).
  const files = [...new Set([...p.matchAll(/scenes\/([\w-]+)\.tsx/g)].map((m) => m[1]))]
  if (!files.length) throw new Error('Fake agent: unknown prompt')
  o.onStep?.('Reading the method')
  o.onStep?.('Reading the style')
  for (const file of files) {
    const target = join(o.cwd, 'scenes', `${file}.tsx`)
    mkdirSync(dirname(target), { recursive: true })
    const title = p.match(/: "([^"]+)" \(/)?.[1] ?? p.match(/line, in this style:\n"([^"]+)"/)?.[1]?.slice(0, 30) ?? 'Test'
    const bigger = /bigger|label/i.test(p) && existsSync(target)
    o.onStep?.(existsSync(target) ? `Changing ${file}` : `Drawing ${file}`)
    // Pop is left out of the import on purpose: the app must add it back by itself (see sceneFix.ts).
    writeFileSync(
      target,
      `import { useScene, Board, Draw, shape, Write, Travel } from '@kit'

export default function Scene() {
  const { dur, palette } = useScene()
  const a = Math.round(dur * 0.05)
  const b = Math.round(dur * 0.35)
  const c = Math.round(dur * 0.6)
  const s = ${bigger ? 1.5 : 1}
  const path = shape.curve(420, 640, 1500, 640, 0.3)
  return (
    <Board>
      {/* On purpose, the box runs off the left and bottom edges: the kit must fit it back in. */}
      <Draw d={shape.rect(-120, 560, 520 * s, 620, 30)} start={a} dur={Math.round(dur * 0.25)} />
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
  }
  return `Drew ${files.length} part${files.length > 1 ? 's' : ''}.`
}

export const fakeEnabled = () => process.env.INKFRAME_FAKE_AGENT === '1'
