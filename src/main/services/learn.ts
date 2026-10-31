import { BrowserWindow } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { dirname, join, relative } from 'path'
import { randomUUID } from 'crypto'
import type { LearnSession, Part, Project, StyleDef } from '../../shared/types'
import { libDir, saveLearn, saveStyle } from './store'
import { extractJson, runAgent } from './agent'
import { cutsPerMinute, frames, run } from './media'
import { ensureYtDlp } from './recreate'
import { ffmpegPath } from './tools'
import { learnPrompt, styleDoc } from './prompts'
import { bundleProject, methodFile, renderPart, sceneFile, checkScene } from './render'

const running = new Map<string, AbortController>()

function emit(s: LearnSession) {
  saveLearn(s)
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('learn:changed', s)
}

export function stopLearn(id: string) {
  running.get(id)?.abort()
}

export function startLearn(input: Partial<LearnSession> & { source: string }): LearnSession {
  const s: LearnSession = {
    id: randomUUID(),
    name: input.name || '',
    source: input.source,
    mode: input.mode ?? 'The look',
    testLine: input.testLine,
    urls: input.urls,
    skipTest: input.skipTest,
    provider: input.provider ?? 'Claude Code',
    model: input.model ?? 'Opus 5.5',
    effort: input.effort ?? 'High',
    step: 0,
    status: 'Downloading',
    detail: 'starting',
    frames: [],
    at: Date.now()
  }
  emit(s)
  const ac = new AbortController()
  running.set(s.id, ac)
  learn(s, ac.signal)
    .catch((e: Error) => {
      s.status = 'Failed'
      s.error = e.message
    })
    .finally(() => {
      running.delete(s.id)
      emit(s)
    })
  return s
}

async function learn(s: LearnSession, signal: AbortSignal) {
  const styleId = 'learned-' + s.id.slice(0, 8)
  const dir = libDir('styles', styleId)
  const isLink = !!s.urls?.length || /^https?:\/\//i.test(s.source)

  // 1 · Getting the video(s). A channel or playlist link gives its latest 5 videos; only the first
  // 3 minutes of each are needed to learn the look.
  let videos = [s.source]
  if (isLink) {
    const yt = await ensureYtDlp((d) => {
      s.detail = d.toLowerCase()
      emit(s)
    })
    const many = /youtube\.com\/(@|channel\/|c\/|user\/|playlist)|[?&]list=/i.test(s.source)
    const total = s.urls?.length ?? (many ? 5 : 1)
    s.detail = `downloading · video 1 of ${total}`
    emit(s)
    const args = ['--ffmpeg-location', dirname(ffmpegPath()), '-f', 'bv*[height<=720]+ba/b[height<=720]/b', '--merge-output-format', 'mp4', '--download-sections', '*0-180', '-o', join(dir, s.urls ? 'source-%(id)s.%(ext)s' : 'source-%(playlist_index|1)s.%(ext)s')]
    args.push(...(many && !s.urls ? ['--playlist-items', `1:${total}`] : ['--no-playlist']))
    // A channel's home page has tabs; its videos tab is the list we want.
    const url = many && /youtube\.com\/(@|channel\/|c\/|user\/)[^/]+\/?$/i.test(s.source) ? s.source.replace(/\/?$/, '/videos') : s.source
    const r = await run(yt, [...args, ...(s.urls ?? [url])], {
      signal,
      onLine: (line) => {
        const m = line.match(/Downloading item (\d+) of (\d+)/)
        if (m) {
          s.detail = `downloading · video ${m[1]} of ${m[2]}`
          emit(s)
        }
      }
    })
    videos = readdirSync(dir)
      .filter((f) => /^source-.*\.(mp4|webm|mkv)$/.test(f))
      .map((f) => join(dir, f))
    if (!videos.length) throw new Error('Could not get the video: ' + r.stderr.split('\n').filter(Boolean).slice(-2).join(' '))
  } else if (!existsSync(s.source)) throw new Error('The video file is missing')

  // 2 · Measuring
  s.step = 1
  s.status = 'Measuring'
  s.detail = 'taking frames'
  emit(s)
  const files: string[] = []
  let duration = 0
  let cuts = 0
  const per = Math.max(3, Math.ceil(12 / videos.length))
  for (const [i, v] of videos.entries()) {
    s.detail = `taking frames · video ${i + 1} of ${videos.length}`
    emit(s)
    const out = join(dir, `v${i + 1}`)
    mkdirSync(out, { recursive: true })
    const f = await frames(v, out, per, signal)
    files.push(...f.files)
    duration += f.duration
    s.frames = [...files]
    emit(s)
    s.detail = `counting cuts · video ${i + 1} of ${videos.length}`
    emit(s)
    cuts += ((await cutsPerMinute(v, signal)) * f.duration) / 60
  }
  const cpm = duration ? (cuts / duration) * 60 : 0

  // 3 · Building and testing
  s.step = 2
  s.status = 'Building'
  s.detail = 'Claude is looking at the frames'
  emit(s)
  const reply = await runAgent({
    provider: s.provider!,
    model: s.model!,
    effort: s.effort!,
    cwd: dir,
    tools: true,
    signal,
    prompt: learnPrompt(files.map((f) => relative(dir, f).replace(/\\/g, '/')), { duration, cutsPerMinute: cpm }, s.mode, s.name),
    onStep: (label) => {
      s.detail = label.toLowerCase()
      emit(s)
    }
  })
  const got = extractJson<Omit<StyleDef, 'id'>>(reply)
  const guide = existsSync(join(dir, 'STYLE_GUIDE.md')) ? readFileSync(join(dir, 'STYLE_GUIDE.md'), 'utf8') : ''
  writeFileSync(join(dir, 'style.md'), guide)
  const style: StyleDef = {
    id: styleId,
    name: s.name || got.name || 'Learned style',
    tags: (got.tags ?? []).slice(0, 2),
    description: got.description ?? '',
    dim: got.dim === '3D' ? '3D' : '2D',
    palette: got.palette ?? { bg: '#0b0b0c', ink: '#f2f2f2', accent: '#f26b1d' },
    stroke: got.stroke ?? { width: 3, jitter: 0.5, texture: 'pen' },
    custom: true,
    source: files[Math.floor(files.length / 2)]
  }
  s.name = style.name
  saveStyle(style)
  s.styleId = styleId
  emit(s)

  // Test it on the user's line (unless the style was found for a video, which is its test).
  if (!s.skipTest) s.detail = 'testing it on your line'
  emit(s)
  try {
    if (!s.skipTest) s.testClip = await testClip(s, style, guide, signal)
  } catch (e) {
    if (signal.aborted) throw e
    s.error = `The style is saved, but the test clip failed: ${(e as Error).message.slice(0, 200)}`
  }

  s.step = 3
  s.status = 'Ready to check'
  s.detail = ''
}

/** Draws a 6-second scene of the test line in the new style. */
async function testClip(s: LearnSession, style: StyleDef, guide: string, signal: AbortSignal) {
  const dir = libDir('styles', style.id, 'test')
  for (const sub of ['scenes', 'public', 'work', 'renders', 'thumbs']) mkdirSync(join(dir, sub), { recursive: true })
  copyFileSync(methodFile(), join(dir, 'METHOD.md'))
  writeFileSync(join(dir, 'STYLE.md'), styleDoc(style, guide))
  const line = s.testLine || 'One prompt, followed from the phone to the chip and back.'
  const words = line.split(/\s+/).map((w, i, a) => ({ w, start: (i / a.length) * 5.2 + 0.3, end: ((i + 1) / a.length) * 5.2 + 0.3 }))
  const part: Part = { id: 'test', index: 0, title: 'Test', start: 0, end: 6, text: line, idea: 'Show the line as one clear drawing.', status: 'Designed', locked: false, material: [], history: [] }
  const p = {
    id: 'test-' + style.id,
    title: 'Test',
    dir,
    words,
    parts: [part],
    material: [],
    settings: { styleId: style.id, characterIds: [], quality: { height: 720, fps: 30 } }
  } as unknown as Project
  await runAgent({
    provider: s.provider!,
    model: s.model!,
    effort: s.effort!,
    cwd: dir,
    tools: true,
    signal,
    prompt: `First read METHOD.md and STYLE.md. Draw one 6-second test scene (180 frames at 30 fps) for this line, in this style:
"${line}"
Words and frames: ${words.map((w) => `${Math.round(w.start * 30)}:${w.w}`).join(' ')}
Write it to scenes/test.tsx. Reply with one short sentence.`
  })
  const err = await checkScene(sceneFile(p, part))
  if (err) throw new Error(err)
  const url = await bundleProject(p)
  return renderPart(p, part, url, { signal, out: join(dir, 'renders', 'test.mp4') })
}
