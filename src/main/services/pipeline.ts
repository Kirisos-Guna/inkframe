import { BrowserWindow } from 'electron'
import { copyFileSync, existsSync, rmSync, writeFileSync } from 'fs'
import { basename, join } from 'path'
import { randomUUID } from 'crypto'
import type { Comment, Part, Project } from '../../shared/types'
import { APP_NAME } from '../../shared/brand'
import { getProject, getStyle, listCharacters, saveProject, styleGuide } from './store'
import { extractJson, runAgent } from './agent'
import { transcribe } from './transcribe'
import { assemble, cutAudio } from './media'
import { bundleProject, checkScene, clipFile, methodFile, renderPart, sceneFile, stillPart, syncMaterial } from './render'
import { checkPrompt, designPrompt, fixPrompt, repairPrompt, splitPrompt, styleDoc } from './prompts'

// ---------- events ----------
const pendingEmit = new Map<string, NodeJS.Timeout>()
export function emit(p: Project, now = false) {
  saveProject(p)
  const send = () => {
    pendingEmit.delete(p.id)
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send('project:changed', p)
  }
  clearTimeout(pendingEmit.get(p.id))
  if (now) send()
  else pendingEmit.set(p.id, setTimeout(send, 120))
}

function step(p: Project, label: string, opts: { title?: string; detail?: string } = {}) {
  const last = p.job.steps[p.job.steps.length - 1]
  // Progress updates ('Getting X · 40%') replace the step they belong to instead of adding new ones.
  if (last && !last.done && last.label.split(' · ')[0] === label.split(' · ')[0]) last.label = label
  else {
    for (const s of p.job.steps) s.done = true
    p.job.steps.push({ id: randomUUID(), label, done: false, at: Date.now() })
  }
  if (p.job.steps.length > 400) p.job.steps = p.job.steps.slice(-400)
  if (opts.title !== undefined) p.job.title = opts.title
  if (opts.detail !== undefined) p.job.detail = opts.detail
  emit(p)
}

const part = (p: Project, id: string) => p.parts.find((x) => x.id === id)
function setPart(p: Project, id: string, patch: Partial<Part>) {
  const x = part(p, id)
  if (x) Object.assign(x, patch)
  emit(p)
}

const reindex = (p: Project) => p.parts.forEach((x, i) => (x.index = i))
const textOf = (p: Project, from: number, to: number) =>
  p.words
    .filter((w) => w.start >= from - 0.05 && w.start < to)
    .map((w) => w.w)
    .join(' ')

// ---------- transcription (starts as soon as the voiceover is dropped) ----------
const hearing = new Map<string, Promise<void>>()
export function startTranscription(id: string) {
  const p = getProject(id)
  if (!p?.voiceover) return
  const run = (async () => {
    p.transcribing = true
    p.transcribeError = undefined
    emit(p, true)
    try {
      p.words = await transcribe(p.voiceover!.file, join(p.dir, 'work'), (s) => {
        if (p.job.running) {
          p.job.detail = s
          emit(p)
        }
      })
    } catch (e) {
      p.words = []
      p.transcribeError = (e as Error).message
    } finally {
      p.transcribing = false
      emit(p, true)
    }
  })()
  hearing.set(id, run)
  run.finally(() => hearing.get(id) === run && hearing.delete(id))
}

// ---------- jobs ----------
const jobs = new Map<string, AbortController>()
// Parts drawn at the same time when "Helpers" is on.
const HELPERS = 4
export const isRunning = (id: string) => jobs.has(id)

export function stopJob(id: string) {
  jobs.get(id)?.abort()
}

function agentOpts(p: Project, signal: AbortSignal, extra: { onStep?: (s: string) => void } = {}) {
  return { provider: p.settings.provider, model: p.settings.model, effort: p.settings.effort, cwd: p.dir, signal, ...extra }
}

/** Starts (or continues) making the video. `force` designs every unlocked part again. */
export function startJob(id: string, force = false) {
  const p = getProject(id)
  if (!p || jobs.has(id)) return
  const ac = new AbortController()
  jobs.set(id, ac)
  p.job = { running: true, title: 'Getting ready', detail: '', stage: 'Voiceover', designDone: 0, renderDone: 0, steps: [], startedAt: Date.now() }
  if (force) for (const x of p.parts) if (!x.locked) x.status = 'Not designed yet'
  emit(p, true)
  runJob(p, ac.signal)
    .then(() => {
      p.job.running = false
      p.job.title = 'Your video is ready'
      p.job.detail = `${p.parts.length} parts, ${Math.round(p.voiceover?.duration ?? 0)} seconds. Click a part to change it.`
      for (const s of p.job.steps) s.done = true
    })
    .catch((e: Error) => {
      p.job.running = false
      for (const x of p.parts) if (['Designing', 'Rendering', 'Making it again'].includes(x.status)) x.status = existsSync(sceneFile(p, x)) ? 'Designed' : 'Not designed yet'
      for (const c of p.comments) if (c.state === 'Working') c.state = 'Waiting'
      if (ac.signal.aborted) {
        p.job.title = 'Stopped'
        p.job.detail = 'Nothing is lost. Press Make again, or send a change, to carry on.'
      } else {
        p.job.error = e.message
        p.job.title = 'Something went wrong'
      }
    })
    .finally(() => {
      jobs.delete(id)
      emit(p, true)
      // A change sent at the very end gets its own run.
      if (!ac.signal.aborted && p.comments.some((c) => c.state === 'Waiting')) startJob(id)
    })
}

export function addComment(id: string, c: Comment) {
  const p = getProject(id)
  if (!p) return
  p.comments.push({ ...c, state: 'Waiting' })
  for (const pid of c.partIds) setPart(p, pid, {})
  emit(p, true)
  if (!jobs.has(id)) startJob(id)
}

async function runJob(p: Project, signal: AbortSignal) {
  const style = getStyle(p.settings.styleId)
  const chars = listCharacters().filter((c) => p.settings.characterIds.includes(c.id))
  // Files the agent reads.
  copyFileSync(methodFile(), join(p.dir, 'METHOD.md'))
  writeFileSync(join(p.dir, 'STYLE.md'), styleDoc(style, styleGuide(style.id)))
  syncMaterial(p)

  // 1 · Voiceover
  p.job.stage = 'Voiceover'
  if (!p.words.length && !p.transcribeError) {
    step(p, 'Listening to the voiceover', { title: 'Listening to the voiceover', detail: 'Finding every word and when it is said.' })
    if (!hearing.has(p.id)) startTranscription(p.id)
    await hearing.get(p.id)
  }
  if (signal.aborted) throw new Error('Stopped')

  // 2 · Parts
  p.job.stage = 'Parts'
  if (!p.parts.length) {
    step(p, `Reading the ${APP_NAME} method`, { title: 'Planning the video', detail: `${style.name}. Reading your direction.` })
    step(p, 'Looking at the style')
    step(p, 'Splitting the voiceover into parts')
    const reply = await runAgent({ ...agentOpts(p, signal), prompt: splitPrompt(p, style) })
    const plan = extractJson<{ title?: string; parts: { start: number; end: number; title: string; text?: string; idea?: string }[] }>(reply)
    p.parts = normaliseParts(p, plan.parts)
    if (plan.title && (p.title === p.voiceover?.name.replace(/\.[^.]+$/, '') || p.title === 'Untitled video')) p.title = plan.title
    emit(p, true)
  }
  if (signal.aborted) throw new Error('Stopped')

  // 3 · Design
  p.job.stage = 'Design'
  const designed = () => p.parts.filter((x) => existsSync(sceneFile(p, x)) && x.status !== 'Not designed yet').length
  p.job.designDone = designed()
  const todo = p.parts.filter((x) => !x.locked && (x.status === 'Not designed yet' || !existsSync(sceneFile(p, x))))
  await pool(todo, p.settings.helpers ? HELPERS : 1, async (x) => {
    step(p, `Coming up with ideas for part ${x.index + 1}`, {
      title: `Coming up with ideas for part ${x.index + 1}`,
      detail: `${style.name}, ${p.parts.length} parts. Part ${x.index + 1}: ${x.idea || x.title}`.slice(0, 220)
    })
    setPart(p, x.id, { status: 'Designing' })
    await agentScene(p, x, designPrompt(p, x, chars), `First version`, signal)
    p.job.designDone = designed()
    emit(p)
  })

  // 4 · Changes from comments
  for (const c of p.comments.filter((c) => c.state === 'Waiting')) {
    if (signal.aborted) throw new Error('Stopped')
    c.state = 'Working'
    const parts = c.partIds.map((id) => part(p, id)).filter(Boolean) as Part[]
    for (const x of parts) setPart(p, x.id, { status: 'Making it again' })
    const attachments = c.attachments.map((a) => {
      const to = join(p.dir, 'public', basename(a))
      if (existsSync(a)) copyFileSync(a, to)
      return basename(a)
    })
    await pool(parts, p.settings.helpers ? HELPERS : 1, async (x) => {
      const others = p.parts.length - 1
      step(p, `Drawing part ${x.index + 1}`, {
        title: `Drawing part ${x.index + 1}`,
        detail: `One note, on part ${x.index + 1}: ${c.text.replace(/\.$/, '')}. The other ${others} part${others === 1 ? '' : 's'} stay exactly as they are.`
      })
      await agentScene(p, x, fixPrompt(p, x, chars, c, attachments), c.text, signal)
    })
    c.state = 'Done'
    emit(p)
  }

  // 5 · Render
  p.job.stage = 'Render'
  const needsRender = (x: Part) => x.status !== 'Up to date' || !x.video || !existsSync(x.video)
  p.job.renderDone = p.parts.filter((x) => !needsRender(x)).length
  const renderList = p.parts.filter(needsRender)
  if (renderList.length) {
    step(p, 'Putting the drawings together', { title: 'Rendering', detail: `${renderList.length} part${renderList.length > 1 ? 's' : ''} at ${p.settings.quality.height}p · ${p.settings.quality.fps} fps` })
    let serveUrl = await bundleProject(p, (s) => step(p, s))
    for (const x of renderList) {
      if (signal.aborted) throw new Error('Stopped')
      setPart(p, x.id, { status: 'Rendering' })
      step(p, `Rendering part ${x.index + 1}`, { title: `Rendering part ${x.index + 1}`, detail: `${x.title}. ${p.job.renderDone} of ${p.parts.length} done.` })
      try {
        await renderPart(p, x, serveUrl, { signal })
      } catch (e) {
        if (signal.aborted) throw e
        // A scene that renders as a still can still fail over time: let the agent repair it once.
        step(p, `Repairing part ${x.index + 1}`)
        await agentScene(p, x, repairPrompt(x, (e as Error).message), 'Repaired', signal, false)
        serveUrl = await bundleProject(p)
        await renderPart(p, x, serveUrl, { signal })
      }
      setPart(p, x.id, { video: clipFile(p, x) })

      // Checks
      if (p.settings.checks !== 'Off' && !x.locked) {
        const result = await runCheck(p, x, serveUrl, signal)
        if (!result.ok && p.settings.checks === 'High') {
          step(p, `Fixing part ${x.index + 1} after the check`, { detail: result.notes.join(' · ') })
          await agentScene(
            p,
            x,
            fixPrompt(p, x, chars, { id: '', partIds: [x.id], text: `A reviewer found: ${result.notes.join('; ')}`, mode: 'Fix just this', attachments: [], at: Date.now(), state: 'Working' }, []),
            'Fixed after the check',
            signal
          )
          serveUrl = await bundleProject(p)
          await renderPart(p, x, serveUrl, { signal })
          await runCheck(p, x, serveUrl, signal)
        }
      }
      setPart(p, x.id, { status: 'Up to date', video: clipFile(p, x) })
      p.job.renderDone = p.parts.filter((y) => !needsRender(y)).length
      emit(p)
    }
  }

  // 6 · Video
  p.job.stage = 'Video'
  step(p, 'Putting it together with your voiceover', { title: 'Putting the video together', detail: 'Joining the parts and laying the voiceover on top.' })
  const out = join(p.dir, 'renders', 'video.mp4')
  await assemble(p.parts.map((x) => x.video!), p.voiceover!.file, out, {}, signal)
  p.output = out
  emit(p, true)
}

/** Runs the agent on one scene, then checks it builds and draws; repairs it up to twice. */
async function agentScene(p: Project, x: Part, prompt: string, note: string, signal: AbortSignal, keepHistory = true) {
  const file = sceneFile(p, x)
  const onStep = (s: string) => {
    if (s.startsWith('Drawing ') || s.startsWith('Changing ')) s = `${s.startsWith('Drawing') ? 'Drawing' : 'Changing'} part ${x.index + 1}`
    const last = p.job.steps[p.job.steps.length - 1]
    if (last?.label !== s) step(p, s)
  }
  await runAgent({ ...agentOpts(p, signal, { onStep }), prompt, tools: true })
  if (!existsSync(file)) throw new Error(`Part ${x.index + 1}: the scene was not written`)
  for (let tries = 0; ; tries++) {
    const err = (await checkScene(file)) ?? (await stillOrError(p, x))
    if (!err) break
    if (tries >= 2) throw new Error(`Part ${x.index + 1} does not draw: ${err.slice(0, 300)}`)
    step(p, `Repairing part ${x.index + 1}`)
    await runAgent({ ...agentOpts(p, signal, { onStep }), prompt: repairPrompt(x, err), tools: true })
  }
  if (keepHistory) {
    const h = join(p.dir, 'scenes', 'history', `${x.id}-${Date.now()}.tsx`)
    copyFileSync(file, h)
    const cur = part(p, x.id)!
    cur.history = [...cur.history, { at: Date.now(), note, file: h }]
  }
  setPart(p, x.id, { status: 'Designed', thumb: join(p.dir, 'thumbs', `${x.id}.png`) })
}

// Bundling writes one shared entry; do it one at a time.
let bundleLock: Promise<unknown> = Promise.resolve()
function stillOrError(p: Project, x: Part): Promise<string | null> {
  const job = bundleLock.then(async () => {
    try {
      const url = await bundleProject(p, (s) => step(p, s))
      await stillPart(p, x, url)
      emit(p)
      return null
    } catch (e) {
      return (e as Error).message
    }
  })
  bundleLock = job.catch(() => {})
  return job
}

async function runCheck(p: Project, x: Part, serveUrl: string, signal: AbortSignal) {
  step(p, `Checking part ${x.index + 1}`)
  const frames: string[] = []
  for (const [i, at] of [0.2, 0.55, 0.97].entries()) {
    const f = join(p.dir, 'work', `check-${x.index + 1}-${i + 1}.png`)
    await stillPart(p, x, serveUrl, at, f)
    frames.push(`work/check-${x.index + 1}-${i + 1}.png`)
  }
  try {
    const reply = await runAgent({ ...agentOpts(p, signal), effort: 'Low', prompt: checkPrompt(x, frames, p.settings.checks) })
    const r = extractJson<{ ok: boolean; notes: string[] }>(reply)
    const checks = { ok: !!r.ok, notes: (r.notes ?? []).slice(0, 5), at: Date.now() }
    setPart(p, x.id, { checks })
    return checks
  } catch (e) {
    if (signal.aborted) throw e
    const checks = { ok: true, notes: ['The check could not run'], at: Date.now() }
    setPart(p, x.id, { checks })
    return checks
  }
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0
  let failed: Error | null = null
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length && !failed) {
        const x = items[i++]
        try {
          await fn(x)
        } catch (e) {
          failed = e as Error
        }
      }
    })
  )
  if (failed) throw failed
}

/** Makes the parts contiguous from 0 to the end and fills in their words. */
function normaliseParts(p: Project, raw: { start: number; end: number; title: string; text?: string; idea?: string }[]): Part[] {
  const dur = p.voiceover?.duration ?? raw[raw.length - 1]?.end ?? 60
  const sorted = raw.filter((r) => r.end > r.start).sort((a, b) => a.start - b.start)
  if (!sorted.length) throw new Error('Claude did not return any parts')
  return sorted.map((r, i) => {
    const start = i === 0 ? 0 : sorted[i].start
    const end = i === sorted.length - 1 ? dur : sorted[i + 1].start
    return {
      id: randomUUID(),
      index: i,
      title: r.title?.slice(0, 40) || `Part ${i + 1}`,
      start,
      end,
      text: textOf(p, start, end) || r.text || '',
      idea: r.idea,
      status: 'Not designed yet',
      locked: false,
      material: [],
      history: []
    }
  })
}

// ---------- editing parts ----------
function busy(p: Project) {
  if (jobs.has(p.id)) throw new Error('Wait until the current work is done, or stop it first.')
}

export function splitPart(id: string, partId: string, at: number) {
  const p = getProject(id)!
  busy(p)
  const i = p.parts.findIndex((x) => x.id === partId)
  const a = p.parts[i]
  // Snap to the nearest word start.
  const snap = p.words.filter((w) => w.start > a.start + 0.5 && w.start < a.end - 0.5).sort((x, y) => Math.abs(x.start - at) - Math.abs(y.start - at))[0]?.start ?? at
  const b: Part = { ...a, id: randomUUID(), title: `${a.title} (2)`, start: snap, text: textOf(p, snap, a.end), status: 'Not designed yet', locked: false, history: [], thumb: undefined, video: undefined, checks: undefined }
  Object.assign(a, { end: snap, text: textOf(p, a.start, snap), status: existsSync(sceneFile(p, a)) ? 'Designed' : 'Not designed yet' })
  p.parts.splice(i + 1, 0, b)
  reindex(p)
  emit(p, true)
  return p
}

export function mergePart(id: string, partId: string) {
  const p = getProject(id)!
  busy(p)
  const i = p.parts.findIndex((x) => x.id === partId)
  const a = p.parts[i]
  const b = p.parts[i + 1]
  if (!b) return p
  Object.assign(a, { end: b.end, text: textOf(p, a.start, b.end), title: a.title, idea: [a.idea, b.idea].filter(Boolean).join(' Then: '), status: 'Not designed yet', material: [...new Set([...a.material, ...b.material])] })
  p.parts.splice(i + 1, 1)
  reindex(p)
  emit(p, true)
  return p
}

/** Removes stretches of the voiceover; parts and words after them move up. */
export async function cutRanges(id: string, ranges: [number, number][]) {
  const p = getProject(id)!
  busy(p)
  ranges = ranges.sort((a, b) => a[0] - b[0])
  const src = p.voiceover!.file
  const out = join(p.dir, 'work', `voiceover-edit-${Date.now()}.wav`)
  await cutAudio(src, ranges, out)
  const shift = (t: number) => {
    let s = 0
    for (const [a, b] of ranges) {
      if (t >= b) s += b - a
      else if (t > a) s += t - a
    }
    return t - s
  }
  p.words = p.words.filter((w) => !ranges.some(([a, b]) => w.start >= a && w.end <= b + 0.05)).map((w) => ({ ...w, start: shift(w.start), end: shift(w.end) }))
  const removed = ranges.reduce((s, [a, b]) => s + (b - a), 0)
  for (const x of p.parts) {
    const touched = ranges.some(([a, b]) => a < x.end && b > x.start)
    x.start = shift(x.start)
    x.end = shift(x.end)
    if (touched || x.end - x.start < 0.01) {
      x.text = textOf(p, x.start, x.end)
      if (x.status === 'Up to date') x.status = 'Designed'
    }
  }
  p.parts = p.parts.filter((x) => x.end - x.start > 0.4)
  p.parts.forEach((x, i) => {
    if (i > 0 && Math.abs(x.start - p.parts[i - 1].end) > 0.001) {
      x.start = p.parts[i - 1].end
      if (x.status === 'Up to date') x.status = 'Designed'
    }
  })
  reindex(p)
  p.voiceover = { ...p.voiceover!, file: out, duration: p.voiceover!.duration - removed }
  if (p.parts.length) p.parts[p.parts.length - 1].end = p.voiceover.duration
  emit(p, true)
  return p
}

export async function removeParts(id: string, partIds: string[]) {
  const p = getProject(id)!
  const ranges = p.parts.filter((x) => partIds.includes(x.id)).map((x) => [x.start, x.end] as [number, number])
  for (const x of p.parts.filter((x) => partIds.includes(x.id))) rmSync(sceneFile(p, x), { force: true })
  return cutRanges(id, ranges)
}

export function restoreVersion(id: string, partId: string, file: string) {
  const p = getProject(id)!
  busy(p)
  const x = part(p, partId)!
  copyFileSync(file, sceneFile(p, x))
  const h = x.history.find((v) => v.file === file)
  x.history = [...x.history, { at: Date.now(), note: `Back to: ${h?.note ?? 'an earlier version'}`, file }]
  x.status = 'Designed'
  emit(p, true)
  startJob(id)
  return p
}

// ---------- export ----------
export async function exportVideo(id: string, opts: { height: number; fps: number }, to: string) {
  const p = getProject(id)!
  busy(p)
  const sameAsParts = opts.height === p.settings.quality.height && opts.fps === p.settings.quality.fps
  if (sameAsParts && p.output && existsSync(p.output)) {
    copyFileSync(p.output, to)
    return to
  }
  if (opts.height > p.settings.quality.height || opts.fps > p.settings.quality.fps) {
    // Draw again at the larger size so lines stay sharp.
    const serveUrl = await bundleProject(p)
    const clips: string[] = []
    for (const x of p.parts) {
      const out = join(p.dir, 'work', `export-${x.id}.mp4`)
      await renderPart(p, x, serveUrl, { ...opts, out })
      clips.push(out)
    }
    await assemble(clips, p.voiceover!.file, to)
    return to
  }
  await assemble(p.parts.map((x) => x.video!), p.voiceover!.file, to, opts)
  return to
}
