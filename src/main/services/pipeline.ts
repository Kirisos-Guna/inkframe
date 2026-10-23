import { BrowserWindow } from 'electron'
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { basename, dirname, join } from 'path'
import { randomUUID } from 'crypto'
import type { Comment, Part, Project } from '../../shared/types'
import { APP_NAME } from '../../shared/brand'
import { getProject, getStyle, listCharacters, saveProject, styleGuide } from './store'
import { extractJson, runAgent } from './agent'
import { transcribe } from './transcribe'
import { cutAudio, finishVideo, stripImage } from './media'
import { bundleProject, clearRenderBundles, clipFile, fixSceneImports, hfMethodFile, methodFile, syncMaterial, thumbFile } from './render'
import { checkAny, engineOf, renderAny, scenePath, sceneRel, stillAny, writeHfStarter } from './engines'
import { captionFilters, linesFromWords, prepareCaptionFonts } from './captions'
import { createRequire } from 'module'

const req = createRequire(__filename)
import { checkBatchPrompt, designBatchPrompt, designPrompt, drawingSystem, fixPrompt, repairPrompt, splitPrompt, styleDoc, type SceneTarget } from './prompts'

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
  // A new voiceover dropped while the old one is still being heard waits for it: both write the same work files.
  const prev = hearing.get(id)
  const run = (async () => {
    await prev?.catch(() => {})
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
// Parts drawn in one session, and parts checked in one call.
const DESIGN_BATCH = 4
const CHECK_BATCH = 6
// Parts rendered at the same time (each render already uses half the processor cores).
const RENDERS = 2
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
  p.job.pausedAt = Date.now()
  step(p, 'Paused', { detail: 'Paused. Press Resume to carry on from here; finished parts are kept.' })
  for (const ac of stepControllers.get(id) ?? []) ac.abort()
  emit(p, true)
}

export function resumeJob(id: string) {
  const p = getProject(id)
  if (!p || !p.job.paused) return
  p.job.paused = false
  if (p.job.pausedAt) p.job.pausedMs = (p.job.pausedMs ?? 0) + Date.now() - p.job.pausedAt
  p.job.pausedAt = undefined
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
  if (!p || jobs.has(id) || finishing.has(id)) return
  const ac = new AbortController()
  jobs.set(id, ac)
  p.job = { running: true, title: 'Getting ready', detail: '', stage: 'Voiceover', designDone: 0, renderDone: 0, steps: [], startedAt: Date.now() }
  if (force) for (const x of p.parts) if (!x.locked) x.status = 'Not designed yet'
  emit(p, true)
  let ok = false
  runJob(p, ac.signal)
    .then(() => {
      ok = true
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
      if (p.job.paused && p.job.pausedAt) p.job.pausedMs = (p.job.pausedMs ?? 0) + Date.now() - p.job.pausedAt
      p.job.paused = false
      p.job.pausedAt = undefined
      p.job.endedAt = Date.now()
      jobs.delete(id)
      stepControllers.delete(id)
      resumeWaiters.delete(id)
      emit(p, true)
      // A change sent at the very end gets its own run. Not after a failure: that would fail again, over and over;
      // the change waits for Try again instead.
      if (ok && p.comments.some((c) => c.state === 'Waiting')) startJob(id)
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

/** The method and style files in the project folder (for people, and for thumbnails), and the drawing instructions. */
const systems = new Map<string, string>()
function writeGuides(p: Project) {
  const style = getStyle(p.settings.styleId)
  const doc = styleDoc(style, styleGuide(style.id))
  copyFileSync(methodFile(), join(p.dir, 'METHOD.md'))
  copyFileSync(hfMethodFile(), join(p.dir, 'HYPERFRAMES.md'))
  writeFileSync(join(p.dir, 'STYLE.md'), doc)
  syncMaterial(p)
  // The HTML method only when this video can have HTML parts (decided once per job, so the text stays the same).
  const html = p.settings.engine === 'HyperFrames' || style.engine === 'hyperframes' || p.parts.some((x) => engineOf(p, x) === 'hyperframes')
  systems.set(p.id, drawingSystem(readFileSync(methodFile(), 'utf8'), html ? readFileSync(hfMethodFile(), 'utf8') : null, doc))
}

/** Options for a drawing session: the method and style come along as the (cached) system prompt. */
function drawOpts(p: Project, signal: AbortSignal, parts: Part[]) {
  return { ...agentOpts(p, signal, { onStep: batchSteps(p, parts) }), system: systems.get(p.id), tools: true }
}

/**
 * Repairs (a scene that does not build or draw) are small mechanical fixes: a quick model does them as well, for a
 * fraction of the tokens. New ideas and the user's changes still use the chosen model.
 */
function repairOpts(p: Project, signal: AbortSignal, x: Part) {
  const o = drawOpts(p, signal, [x])
  return p.settings.provider === 'Codex' ? { ...o, effort: 'Low' as const } : { ...o, model: 'Sonnet 5.5', effort: 'Low' as const }
}

async function runJob(p: Project, signal: AbortSignal) {
  const style = getStyle(p.settings.styleId)
  const chars = listCharacters().filter((c) => p.settings.characterIds.includes(c.id))
  writeGuides(p)

  // 1 · Voiceover
  p.job.stage = 'Voiceover'
  if (!p.words.length) {
    // Also tries again when hearing failed before (often a download that stopped).
    step(p, 'Listening to the voiceover', { title: 'Listening to the voiceover', detail: 'Finding every word and when it is said.' })
    if (!hearing.has(p.id)) startTranscription(p.id)
    await hearing.get(p.id)
    if (p.transcribeError) throw new Error(`Could not hear the voiceover: ${p.transcribeError}`)
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

  // Rendering runs alongside the drawing: a part is rendered as soon as it is designed, two at a time.
  clearRenderBundles(p)
  const renderedNow = new Set<string>()
  const bg = new AbortController()
  const stopBg = () => bg.abort()
  signal.addEventListener('abort', stopBg, { once: true })
  const renderSlot = limiter(RENDERS)
  const background: Promise<void>[] = []
  const needsRender = (x: Part) => !(x.status === 'Up to date' || x.status === 'Rendered') || !x.video || !existsSync(x.video)
  const countRendered = () => (p.job.renderDone = p.parts.filter((y) => !needsRender(y)).length)
  const bundleFor = (x: Part) => (engineOf(p, x) === 'remotion' ? bundleProject(p, (s) => step(p, s), 'render', { versioned: true, need: [x.id] }) : Promise.resolve(undefined))
  const renderOne = async (x: Part, sig: AbortSignal, foreground: boolean) => {
    if (sig.aborted) throw new Error('Stopped')
    setPart(p, x.id, { status: 'Rendering' })
    step(p, `Rendering part ${x.index + 1}`, foreground ? { title: `Rendering part ${x.index + 1}`, detail: `${x.title}. ${p.job.renderDone} of ${p.parts.length} done.` } : {})
    try {
      await guarded(p, sig, async (s) => renderAny(p, x, { serveUrl: await bundleFor(x), signal: s, onStatus: (t) => step(p, t) }))
    } catch (e) {
      if (sig.aborted) throw e
      // A scene that draws as a still can still fail over time: let the agent repair it once.
      step(p, `Repairing part ${x.index + 1}`)
      await guarded(p, sig, async (s) => {
        await runAgent({ ...repairOpts(p, s, x), prompt: repairPrompt(x, (e as Error).message, target(p, x)) })
        await finishScene(p, x, 'Repaired', s, false)
      })
      await guarded(p, sig, async (s) => renderAny(p, x, { serveUrl: await bundleFor(x), signal: s }))
    }
    renderedNow.add(x.id)
    setPart(p, x.id, { status: 'Rendered', video: clipFile(p, x), renderedAt: Date.now() })
    countRendered()
    emit(p)
  }
  const renderSoon = (x: Part) => {
    const job = renderSlot(() => renderOne(x, bg.signal, false))
    job.catch(() => {}) // collected below; not an unhandled rejection meanwhile
    background.push(job)
  }
  /** Waits for the background renders; a failure there fails the job. */
  const backgroundDone = async () => {
    const results = await Promise.allSettled(background)
    background.length = 0
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined
    if (failed) throw failed.reason
  }
  try {
    await designAndChange()
  } catch (e) {
    // Stop the renders too, and let them wind down before reporting.
    bg.abort()
    await Promise.allSettled(background)
    throw e
  } finally {
    signal.removeEventListener('abort', stopBg)
  }

  // 5 · Render what is left (changed parts, parts made earlier), then check everything rendered in this job
  p.job.stage = 'Render'
  countRendered()
  const renderList = p.parts.filter(needsRender)
  if (renderList.length) step(p, 'Putting the drawings together', { title: 'Rendering', detail: `${renderList.length} part${renderList.length > 1 ? 's' : ''} at ${p.settings.quality.height}p · ${p.settings.quality.fps} fps` })
  await pool(renderList, RENDERS, (x) => renderOne(x, signal, true))

  const toCheck = p.parts.filter((x) => renderedNow.has(x.id) && !x.locked)
  if (p.settings.checks !== 'Off' && toCheck.length) {
    // Checks: one small picture per part, several parts per call, on a quick model.
    const url = () => (toCheck.some((x) => engineOf(p, x) === 'remotion') ? bundleProject(p, (s) => step(p, s), 'render', { versioned: true }) : Promise.resolve(undefined))
    const results = await guarded(p, signal, async (s) => checkParts(p, toCheck, await url(), s))
    const bad = p.settings.checks === 'High' ? toCheck.filter((x) => results.get(x.id) && !results.get(x.id)!.ok) : []
    if (bad.length) {
      step(p, `Fixing ${bad.length} part${bad.length > 1 ? 's' : ''} after the check`, { title: 'Fixing after the check', detail: bad.map((x) => `Part ${x.index + 1}: ${results.get(x.id)!.notes.join('; ')}`).join(' · ') })
      await pool(bad, p.settings.helpers ? HELPERS : 1, async (x) => {
        const note: Comment = { id: '', partIds: [x.id], text: `A reviewer found: ${results.get(x.id)!.notes.join('; ')}`, mode: 'Fix just this', attachments: [], at: Date.now(), state: 'Working' }
        await guarded(p, signal, (s) => agentScene(p, x, fixPrompt(p, x, chars, note, [], target(p, x)), 'Fixed after the check', s))
      })
      await pool(bad, RENDERS, (x) => renderOne(x, signal, true))
      await guarded(p, signal, async (s) => checkParts(p, bad, await url(), s))
    }
  }
  for (const x of p.parts) if (renderedNow.has(x.id) || x.status === 'Rendered') setPart(p, x.id, { status: 'Up to date', video: clipFile(p, x) })
  p.job.renderDone = p.parts.length
  emit(p)
  clearRenderBundles(p)

  // 6 · Video
  p.job.stage = 'Video'
  step(p, 'Putting it together with your voiceover', { title: 'Putting the video together', detail: finishDetail(p) })
  const out = join(p.dir, 'renders', 'video.mp4')
  await guarded(p, signal, (s) => finish(p, out, { height: p.settings.quality.height, fps: p.settings.quality.fps }, s))
  p.output = out
  p.outputAt = Date.now()
  emit(p, true)

  async function designAndChange() {
    // 3 · Design, a few parts per session (the method and style come cached in the system prompt)
    p.job.stage = 'Design'
    const designed = () => p.parts.filter((x) => existsSync(scenePath(p, x)) && x.status !== 'Not designed yet').length
    p.job.designDone = designed()
    const todo = p.parts.filter((x) => !x.locked && (x.status === 'Not designed yet' || !existsSync(scenePath(p, x))))
    await pool(chunk(todo, DESIGN_BATCH), p.settings.helpers ? HELPERS : 1, async (batch) => {
      const label = batch.length > 1 ? `parts ${batch[0].index + 1}–${batch[batch.length - 1].index + 1}` : `part ${batch[0].index + 1}`
      step(p, `Coming up with ideas for ${label}`, {
        title: `Coming up with ideas for ${label}`,
        detail: clip(`${style.name}, ${p.parts.length} parts. ${batch.map((x) => `Part ${x.index + 1}: ${x.idea || x.title}`).join(' · ')}`, 220)
      })
      const finished = new Set<string>()
      for (const x of batch) {
        setPart(p, x.id, { status: 'Designing' })
        if (engineOf(p, x) === 'hyperframes') writeHfStarter(p, x, true)
      }
      await guarded(p, signal, async (s) => {
        // After a pause, only the parts of this batch that are not finished yet are drawn again.
        const left = batch.filter((x) => !finished.has(x.id))
        if (!left.length) return
        await runAgent({ ...drawOpts(p, s, left), prompt: designBatchPrompt(p, left, chars, left.map((x) => target(p, x))) })
        for (const x of left) {
          if (existsSync(scenePath(p, x)) && (engineOf(p, x) !== 'hyperframes' || !isBareStarter(scenePath(p, x)))) await finishScene(p, x, 'First version', s)
          // A part the batch did not get to is drawn on its own.
          else await agentScene(p, x, designPrompt(p, x, chars, target(p, x)), 'First version', s)
          finished.add(x.id)
          p.job.designDone = designed()
          emit(p)
          // Rendered right away, unless a change for it is waiting (then it is drawn again first).
          if (!p.comments.some((c) => c.state === 'Waiting' && c.partIds.includes(x.id))) renderSoon(x)
        }
      })
    })
    await backgroundDone()

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
  }
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

/** Runs the agent on one scene, then checks it builds and draws. */
async function agentScene(p: Project, x: Part, prompt: string, note: string, signal: AbortSignal, keepHistory = true) {
  await runAgent({ ...drawOpts(p, signal, [x]), prompt })
  if (!existsSync(scenePath(p, x))) throw new Error(`Part ${x.index + 1}: the scene was not written`)
  await finishScene(p, x, note, signal, keepHistory)
}

/** Checks a written scene builds and draws (repairing it up to twice), keeps a version, marks it designed. */
async function finishScene(p: Project, x: Part, note: string, signal: AbortSignal, keepHistory = true) {
  const file = scenePath(p, x)
  for (let tries = 0; ; tries++) {
    // Common slips (a kit name used but not imported, no default export) are fixed here, without a repair session.
    if (engineOf(p, x) === 'remotion') fixSceneImports(file)
    const err = (await checkAny(p, x)) ?? (await stillOrError(p, x, signal))
    if (!err) break
    if (signal.aborted) throw new Error('Stopped')
    if (tries >= 2) throw new Error(`Part ${x.index + 1} does not draw: ${err.slice(0, 300)}`)
    step(p, `Repairing part ${x.index + 1}`)
    await runAgent({ ...repairOpts(p, signal, x), prompt: repairPrompt(x, err, target(p, x)) })
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

/** Turns the agent's file steps into "Drawing part 7" style steps. */
function batchSteps(p: Project, parts: Part[]) {
  return (s: string) => {
    if (s.startsWith('Drawing ') || s.startsWith('Changing ')) {
      const verb = s.startsWith('Drawing') ? 'Drawing' : 'Changing'
      const x = parts.find((y) => s.includes(y.id)) ?? (parts.length === 1 ? parts[0] : undefined)
      s = x ? `${verb} part ${x.index + 1}` : `${verb} the parts`
    }
    const last = p.job.steps[p.job.steps.length - 1]
    if (last?.label !== s) step(p, s)
  }
}

/** An HTML starter nobody has filled in yet still has the placeholder comment. */
const isBareStarter = (file: string) => readFileSync(file, 'utf8').includes('<!-- elements: class="clip"')

const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))

/** The model that looks at check pictures: quick and cheap, a bit stronger on High. */
const checkModel = (p: Project) =>
  p.settings.provider === 'Codex' ? p.settings.model : p.settings.checks === 'High' ? 'Sonnet 5.5' : 'Haiku 5.5'

/** Checks several parts with one picture each (three moments side by side), a few parts per call. */
async function checkParts(p: Project, parts: Part[], serveUrl: string | undefined, signal: AbortSignal) {
  const results = new Map<string, { ok: boolean; notes: string[]; at: number }>()
  const items: { part: Part; sheet: string }[] = []
  for (const x of parts) {
    step(p, `Checking part ${x.index + 1}`)
    const frames: string[] = []
    for (const [i, at] of [0.2, 0.55, 0.97].entries()) {
      const f = join(p.dir, 'work', `check-${x.index + 1}-${i + 1}.png`)
      await stillAny(p, x, at, f, serveUrl, signal)
      frames.push(f)
    }
    const sheet = join(p.dir, 'work', `check-${x.index + 1}.jpg`)
    await stripImage(frames, sheet)
    items.push({ part: x, sheet: `work/check-${x.index + 1}.jpg` })
  }
  for (const group of chunk(items, CHECK_BATCH)) {
    try {
      const reply = await runAgent({ ...agentOpts(p, signal), model: checkModel(p), effort: 'Low', prompt: checkBatchPrompt(group, p.settings.checks) })
      const r = extractJson<{ parts: { part: number; ok: boolean; notes?: string[] }[] }>(reply)
      for (const { part: x } of group) {
        const got = r.parts?.find((y) => Number(y.part) === x.index + 1)
        const checks = { ok: got ? !!got.ok : true, notes: (got?.notes ?? []).slice(0, 5), at: Date.now() }
        results.set(x.id, checks)
        setPart(p, x.id, { checks })
      }
    } catch (e) {
      if (signal.aborted) throw e
      for (const { part: x } of group) {
        const checks = { ok: true, notes: ['The check could not run'], at: Date.now() }
        results.set(x.id, checks)
        setPart(p, x.id, { checks })
      }
    }
  }
  return results
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

/** Runs at most `n` of the given tasks at once, in the order they are handed in. */
function limiter(n: number) {
  let active = 0
  const queue: (() => void)[] = []
  const next = () => {
    if (active >= n || !queue.length) return
    active++
    queue.shift()!()
  }
  return <T,>(fn: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      queue.push(() =>
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--
            next()
          })
      )
      next()
    })
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
  if (finishing.has(p.id)) throw new Error('Wait until the video is put together.')
}

// Export and "put it together again" share the work folder: one at a time per video.
const finishing = new Set<string>()
async function finishingLock<T>(p: Project, fn: () => Promise<T>) {
  busy(p)
  finishing.add(p.id)
  try {
    return await fn()
  } finally {
    finishing.delete(p.id)
  }
}

export function splitPart(id: string, partId: string, at: number) {
  const p = getProject(id)!
  busy(p)
  const i = p.parts.findIndex((x) => x.id === partId)
  const a = p.parts[i]
  if (!a) throw new Error('That part is gone.')
  if (a.end - a.start < 1.2) throw new Error('This part is too short to split.')
  // Snap to the nearest word start; each half keeps at least half a second.
  const lo = a.start + 0.5
  const hi = a.end - 0.5
  const snap = p.words.filter((w) => w.start > lo && w.start < hi).sort((x, y) => Math.abs(x.start - at) - Math.abs(y.start - at))[0]?.start ?? Math.min(hi, Math.max(lo, at))
  const b: Part = { ...a, id: randomUUID(), title: `${a.title} (2)`, start: snap, text: textOf(p, snap, a.end), status: 'Not designed yet', locked: false, history: [], thumb: undefined, video: undefined, renderedAt: undefined, checks: undefined }
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
  if (!a || !b) return p
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
  // Sorted, inside the voiceover, and overlapping ranges joined (so nothing is counted twice).
  const total = p.voiceover!.duration
  const merged: [number, number][] = []
  for (const [a, b] of ranges.map(([a, b]) => [Math.max(0, Math.min(a, b)), Math.min(total, Math.max(a, b))] as [number, number]).sort((x, y) => x[0] - y[0])) {
    if (b - a < 0.01) continue
    const last = merged[merged.length - 1]
    if (last && a <= last[1]) last[1] = Math.max(last[1], b)
    else merged.push([a, b])
  }
  ranges = merged
  if (!ranges.length) return p
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
  const keep = (w: { start: number; end: number }) => !ranges.some(([a, b]) => w.start >= a && w.end <= b + 0.05)
  const moved = <T extends { start: number; end: number }>(w: T) => ({ ...w, start: shift(w.start), end: shift(w.end) })
  p.words = p.words.filter(keep).map(moved)
  // Tidied captions follow the cut too.
  if (p.captionLines?.length) {
    p.captionLines = p.captionLines
      .map((l) => {
        const words = l.words.filter(keep).map(moved)
        return words.length ? { ...l, start: words[0].start, end: words[words.length - 1].end, words, text: words.length === l.words.length ? l.text : words.map((w) => w.w).join(' ') } : null
      })
      .filter((l): l is NonNullable<typeof l> => !!l)
  }
  // The finished video still has the old voiceover.
  p.output = undefined
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
  busy(p)
  const gone = p.parts.filter((x) => partIds.includes(x.id))
  const ranges = gone.map((x) => [x.start, x.end] as [number, number])
  const out = await cutRanges(id, ranges)
  for (const x of gone) rmSync(scenePath(p, x), { force: true, recursive: true })
  return out
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
  if (!p.parts.length || p.parts.some((x) => !x.video || !existsSync(x.video))) throw new Error('Make the video first: some parts are not rendered yet.')
  if (p.parts.some((x) => x.status !== 'Up to date')) throw new Error('Some parts changed since the video was made. Press Update first, then export.')
  return finishingLock(p, async () => {
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
        await renderAny(p, x, { serveUrl, height: opts.height, fps: opts.fps, out })
        clips.push(out)
      }
    }
    await finish(p, to, opts, undefined, clips)
    return to
  })
}

/** Builds the final video again from the rendered parts (after changing captions, music or transitions). */
export async function refinish(id: string) {
  const p = getProject(id)!
  busy(p)
  if (!p.parts.length || p.parts.some((x) => !x.video || !existsSync(x.video))) throw new Error('Make the video first.')
  return finishingLock(p, async () => {
    const out = join(p.dir, 'renders', 'video.mp4')
    await finish(p, out, { height: p.settings.quality.height, fps: p.settings.quality.fps })
    p.output = out
    p.outputAt = Date.now()
    emit(p, true)
    return p
  })
}
