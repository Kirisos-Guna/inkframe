import { BrowserWindow } from 'electron'
import { copyFileSync, existsSync, rmSync, writeFileSync } from 'fs'
import { basename, dirname, join } from 'path'
import { randomUUID } from 'crypto'
import type { Comment, Part, Project } from '../../shared/types'
import { APP_NAME } from '../../shared/brand'
import { getProject, getStyle, listCharacters, saveProject, styleGuide } from './store'
import { extractJson, runAgent } from './agent'
import { transcribe } from './transcribe'
import { cutAudio, finishVideo } from './media'
import { bundleProject, clipFile, hfMethodFile, methodFile, syncMaterial, thumbFile } from './render'
import { checkAny, engineOf, renderAny, scenePath, sceneRel, stillAny, writeHfStarter } from './engines'
import { captionFilters, linesFromWords, prepareCaptionFonts } from './captions'
import { createRequire } from 'module'

const req = createRequire(__filename)
import { checkPrompt, designPrompt, fixPrompt, repairPrompt, splitPrompt, styleDoc, type SceneTarget } from './prompts'

// ---------- events ----------
const pendingEmit = new Map<string, NodeJS.Timeout>()
export function emit(p: Project, now = false) {
  saveProject(p)
  const send = () => {
    pendingEmit.delete(p.id)
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send('project:changed', p)
  }
  // At most one update every 120 ms, but never postponed forever by a steady stream of events.
  if (now) {
    clearTimeout(pendingEmit.get(p.id))
    send()
  } else if (!pendingEmit.has(p.id)) pendingEmit.set(p.id, setTimeout(send, 120))
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

/** Shortens text at a word boundary, with an ellipsis. */
const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n)).replace(/[,;:.]?$/, '…'))

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
  const p = getProject(id)
  if (p?.job.paused) resumeJob(id)
  jobs.get(id)?.abort()
}

// ---------- pause / resume ----------
// Pausing stops the step that is running right now (an agent call or a render) and holds the job; Resume does
// that one step again and carries on. Finished parts are kept.
const stepControllers = new Map<string, Set<AbortController>>()
const resumeWaiters = new Map<string, (() => void)[]>()

export function pauseJob(id: string) {
  const p = getProject(id)
  if (!p || !jobs.has(id) || p.job.paused) return
  p.job.paused = true
  step(p, 'Paused', { detail: 'Paused. Press Resume to carry on from here; finished parts are kept.' })
  for (const ac of stepControllers.get(id) ?? []) ac.abort()
  emit(p, true)
}

export function resumeJob(id: string) {
  const p = getProject(id)
  if (!p || !p.job.paused) return
  p.job.paused = false
  step(p, 'Carrying on')
  emit(p, true)
  for (const go of resumeWaiters.get(id) ?? []) go()
  resumeWaiters.delete(id)
}

function waitWhilePaused(p: Project, job: AbortSignal) {
  if (!p.job.paused) return Promise.resolve()
  return new Promise<void>((resolve, reject) => {
    const list = resumeWaiters.get(p.id) ?? []
    list.push(resolve)
    resumeWaiters.set(p.id, list)
    job.addEventListener('abort', () => reject(new Error('Stopped')), { once: true })
  })
}

/** Runs one step so that Pause can interrupt it; after Resume the step runs again from the start. */
async function guarded<T>(p: Project, job: AbortSignal, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  for (;;) {
    await waitWhilePaused(p, job)
    if (job.aborted) throw new Error('Stopped')
    const ac = new AbortController()
    const onJobAbort = () => ac.abort()
    job.addEventListener('abort', onJobAbort, { once: true })
    const set = stepControllers.get(p.id) ?? new Set()
    set.add(ac)
    stepControllers.set(p.id, set)
    try {
      return await fn(ac.signal)
    } catch (e) {
      if (p.job.paused && !job.aborted) continue
      throw e
    } finally {
      set.delete(ac)
      job.removeEventListener('abort', onJobAbort)
    }
  }
}

function agentOpts(p: Project, signal: AbortSignal, extra: { onStep?: (s: string) => void } = {}) {
  return { provider: p.settings.provider, model: p.settings.model, effort: p.settings.effort, cwd: p.dir, signal, ...extra }
}

const target = (p: Project, x: Part): SceneTarget => ({ file: sceneRel(p, x), engine: engineOf(p, x) })

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
      for (const x of p.parts) if (['Designing', 'Rendering', 'Making it again'].includes(x.status)) x.status = existsSync(scenePath(p, x)) ? 'Designed' : 'Not designed yet'
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
      p.job.paused = false
      jobs.delete(id)
      stepControllers.delete(id)
      resumeWaiters.delete(id)
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

/** Files the agent reads in the project folder. */
function writeGuides(p: Project) {
  const style = getStyle(p.settings.styleId)
  copyFileSync(methodFile(), join(p.dir, 'METHOD.md'))
  copyFileSync(hfMethodFile(), join(p.dir, 'HYPERFRAMES.md'))
  writeFileSync(join(p.dir, 'STYLE.md'), styleDoc(style, styleGuide(style.id)))
  syncMaterial(p)
}

async function runJob(p: Project, signal: AbortSignal) {
  const style = getStyle(p.settings.styleId)
  const chars = listCharacters().filter((c) => p.settings.characterIds.includes(c.id))
  writeGuides(p)

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
    const reply = await guarded(p, signal, (s) => runAgent({ ...agentOpts(p, s), prompt: splitPrompt(p, style) }))
    const plan = extractJson<{ title?: string; parts: { start: number; end: number; title: string; text?: string; idea?: string }[] }>(reply)
    p.parts = normaliseParts(p, plan.parts)
    if (plan.title && (p.title === p.voiceover?.name.replace(/\.[^.]+$/, '') || p.title === 'Untitled video')) p.title = plan.title
    emit(p, true)
  }
  if (signal.aborted) throw new Error('Stopped')

  // 3 · Design
  p.job.stage = 'Design'
  const designed = () => p.parts.filter((x) => existsSync(scenePath(p, x)) && x.status !== 'Not designed yet').length
  p.job.designDone = designed()
  const todo = p.parts.filter((x) => !x.locked && (x.status === 'Not designed yet' || !existsSync(scenePath(p, x))))
  await pool(todo, p.settings.helpers ? HELPERS : 1, async (x) => {
    step(p, `Coming up with ideas for part ${x.index + 1}`, {
      title: `Coming up with ideas for part ${x.index + 1}`,
      detail: clip(`${style.name}, ${p.parts.length} parts. Part ${x.index + 1}: ${x.idea || x.title}`, 220)
    })
    setPart(p, x.id, { status: 'Designing' })
    if (engineOf(p, x) === 'hyperframes') writeHfStarter(p, x, true)
    await guarded(p, signal, (s) => agentScene(p, x, designPrompt(p, x, chars, target(p, x)), `First version`, s))
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
      if (engineOf(p, x) === 'hyperframes') writeHfStarter(p, x)
      await guarded(p, signal, (s) => agentScene(p, x, fixPrompt(p, x, chars, c, attachments, target(p, x)), c.text, s))
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
    let serveUrl = renderList.some((x) => engineOf(p, x) === 'remotion') ? await bundleProject(p, (s) => step(p, s)) : undefined
    for (const x of renderList) {
      if (signal.aborted) throw new Error('Stopped')
      setPart(p, x.id, { status: 'Rendering' })
      step(p, `Rendering part ${x.index + 1}`, { title: `Rendering part ${x.index + 1}`, detail: `${x.title}. ${p.job.renderDone} of ${p.parts.length} done.` })
      try {
        await guarded(p, signal, (s) => renderAny(p, x, { serveUrl, signal: s, onStatus: (t) => step(p, t) }))
      } catch (e) {
        if (signal.aborted) throw e
        // A scene that draws as a still can still fail over time: let the agent repair it once.
        step(p, `Repairing part ${x.index + 1}`)
        await guarded(p, signal, (s) => agentScene(p, x, repairPrompt(x, (e as Error).message, target(p, x)), 'Repaired', s, false))
        if (engineOf(p, x) === 'remotion') serveUrl = await bundleProject(p)
        await guarded(p, signal, (s) => renderAny(p, x, { serveUrl, signal: s }))
      }
      setPart(p, x.id, { video: clipFile(p, x) })

      // Checks
      if (p.settings.checks !== 'Off' && !x.locked) {
        const result = await guarded(p, signal, (s) => runCheck(p, x, serveUrl, s))
        if (!result.ok && p.settings.checks === 'High') {
          step(p, `Fixing part ${x.index + 1} after the check`, { detail: result.notes.join(' · ') })
          const note: Comment = { id: '', partIds: [x.id], text: `A reviewer found: ${result.notes.join('; ')}`, mode: 'Fix just this', attachments: [], at: Date.now(), state: 'Working' }
          await guarded(p, signal, (s) => agentScene(p, x, fixPrompt(p, x, chars, note, [], target(p, x)), 'Fixed after the check', s))
          if (engineOf(p, x) === 'remotion') serveUrl = await bundleProject(p)
          await guarded(p, signal, (s) => renderAny(p, x, { serveUrl, signal: s }))
          await guarded(p, signal, (s) => runCheck(p, x, serveUrl, s))
        }
      }
      setPart(p, x.id, { status: 'Up to date', video: clipFile(p, x) })
      p.job.renderDone = p.parts.filter((y) => !needsRender(y)).length
      emit(p)
    }
  }

  // 6 · Video
  p.job.stage = 'Video'
  step(p, 'Putting it together with your voiceover', { title: 'Putting the video together', detail: finishDetail(p) })
  const out = join(p.dir, 'renders', 'video.mp4')
  await guarded(p, signal, (s) => finish(p, out, { height: p.settings.quality.height, fps: p.settings.quality.fps }, s))
  p.output = out
  emit(p, true)
}

const finishDetail = (p: Project) =>
  [
    'Joining the parts and laying the voiceover on top',
    p.settings.transition && p.settings.transition !== 'None' ? `${p.settings.transition.toLowerCase()} between parts` : '',
    p.settings.captions && p.settings.captions !== 'Off' ? `${p.settings.captions.toLowerCase()} captions` : '',
    p.settings.music ? 'music under the voice' : ''
  ]
    .filter(Boolean)
    .join(', ') + '.'

/** The finishing pass: transitions, captions and music over the rendered parts. */
async function finish(p: Project, out: string, size: { height: number; fps: number }, signal?: AbortSignal, clips = p.parts.map((x) => x.video!)) {
  const workDir = join(p.dir, 'work')
  let captions: string[] | undefined
  if (p.settings.captions && p.settings.captions !== 'Off' && p.words.length) {
    const lines = p.captionLines?.length ? p.captionLines : linesFromWords(p.words)
    prepareCaptionFonts(workDir, (w) => join(dirname(req.resolve('@fontsource/inter/package.json')), 'files', `inter-latin-${w}-normal.woff`))
    const H = size.height
    captions = captionFilters(lines, p.settings.captions, { W: Math.round((H * 16) / 9 / 2) * 2, H, accent: getStyle(p.settings.styleId).palette.accent, workDir })
  }
  return finishVideo({
    clips: p.parts.map((x, i) => ({ file: clips[i], dur: x.end - x.start })),
    voice: p.voiceover!.file,
    out,
    workDir,
    height: size.height,
    fps: size.fps,
    transition: p.settings.transition,
    captions,
    music: p.settings.music && existsSync(p.settings.music.file) ? p.settings.music : null,
    signal
  })
}

/** Runs the agent on one scene, then checks it builds and draws; repairs it up to twice. */
async function agentScene(p: Project, x: Part, prompt: string, note: string, signal: AbortSignal, keepHistory = true) {
  const file = scenePath(p, x)
  const onStep = (s: string) => {
    if (s.startsWith('Drawing ') || s.startsWith('Changing ')) s = `${s.startsWith('Drawing') ? 'Drawing' : 'Changing'} part ${x.index + 1}`
    const last = p.job.steps[p.job.steps.length - 1]
    if (last?.label !== s) step(p, s)
  }
  await runAgent({ ...agentOpts(p, signal, { onStep }), prompt, tools: true })
  if (!existsSync(file)) throw new Error(`Part ${x.index + 1}: the scene was not written`)
  for (let tries = 0; ; tries++) {
    const err = (await checkAny(p, x)) ?? (await stillOrError(p, x, signal))
    if (!err) break
    if (signal.aborted) throw new Error('Stopped')
    if (tries >= 2) throw new Error(`Part ${x.index + 1} does not draw: ${err.slice(0, 300)}`)
    step(p, `Repairing part ${x.index + 1}`)
    await runAgent({ ...agentOpts(p, signal, { onStep }), prompt: repairPrompt(x, err, target(p, x)), tools: true })
  }
  if (keepHistory) {
    const ext = engineOf(p, x) === 'hyperframes' ? 'html' : 'tsx'
    const h = join(p.dir, 'scenes', 'history', `${x.id}-${Date.now()}.${ext}`)
    copyFileSync(file, h)
    const cur = part(p, x.id)!
    cur.history = [...cur.history, { at: Date.now(), note, file: h }]
  }
  setPart(p, x.id, { status: 'Designed', thumb: join(p.dir, 'thumbs', `${x.id}.png`) })
}

// Bundling writes one shared entry; do it one at a time.
let bundleLock: Promise<unknown> = Promise.resolve()
function stillOrError(p: Project, x: Part, signal?: AbortSignal): Promise<string | null> {
  const job = bundleLock.then(async () => {
    try {
      const url = engineOf(p, x) === 'remotion' ? await bundleProject(p, (s) => step(p, s)) : undefined
      await stillAny(p, x, 0.7, thumbFile(p, x), url, signal, (s) => step(p, s))
      emit(p)
      return null
    } catch (e) {
      return (e as Error).message
    }
  })
  bundleLock = job.catch(() => {})
  return job
}

async function runCheck(p: Project, x: Part, serveUrl: string | undefined, signal: AbortSignal) {
  step(p, `Checking part ${x.index + 1}`)
  const frames: string[] = []
  for (const [i, at] of [0.2, 0.55, 0.97].entries()) {
    const f = join(p.dir, 'work', `check-${x.index + 1}-${i + 1}.png`)
    await stillAny(p, x, at, f, serveUrl, signal)
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
  Object.assign(a, { end: snap, text: textOf(p, a.start, snap), status: existsSync(scenePath(p, a)) ? 'Designed' : 'Not designed yet' })
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
  for (const x of p.parts.filter((x) => partIds.includes(x.id))) rmSync(scenePath(p, x), { force: true })
  return cutRanges(id, ranges)
}

export function restoreVersion(id: string, partId: string, file: string) {
  const p = getProject(id)!
  busy(p)
  const x = part(p, partId)!
  copyFileSync(file, scenePath(p, x))
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
  let clips = p.parts.map((x) => x.video!)
  if (opts.height > p.settings.quality.height || opts.fps > p.settings.quality.fps) {
    // Draw again at the larger size so lines stay sharp.
    const serveUrl = p.parts.some((x) => engineOf(p, x) === 'remotion') ? await bundleProject(p) : undefined
    clips = []
    for (const x of p.parts) {
      const out = join(p.dir, 'work', `export-${x.id}.mp4`)
      await renderAny(p, x, { serveUrl, ...opts, out })
      clips.push(out)
    }
  }
  await finish(p, to, opts, undefined, clips)
  return to
}

/** Builds the final video again from the rendered parts (after changing captions, music or transitions). */
export async function refinish(id: string) {
  const p = getProject(id)!
  busy(p)
  if (p.parts.some((x) => !x.video || !existsSync(x.video))) throw new Error('Make the video first.')
  const out = join(p.dir, 'renders', 'video.mp4')
  await finish(p, out, { height: p.settings.quality.height, fps: p.settings.quality.fps })
  p.output = out
  emit(p, true)
  return p
}
