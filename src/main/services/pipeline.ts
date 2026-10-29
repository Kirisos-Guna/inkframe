// Making a video: the job that plans, draws, renders, checks and finishes it. The pieces live in ./job.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { basename, join } from 'path'
import type { Comment, Part, Project } from '../../shared/types'
import { getProject, getStyle, listCharacters } from './store'
import { asLimit, extractJson, LimitError, runAgent } from './agent'
import { bundleProject, clearRenderBundles, clipFile, thumbFile } from './render'
import { engineOf, renderAny, scenePath, writeHfStarter } from './engines'
import { designBatchPrompt, designPrompt, fixPrompt, repairPrompt, splitPrompt } from './prompts'
import { APP_NAME } from '../../shared/brand'
import { emit, setPart, step } from './job/events'
import { normaliseParts, part } from './job/parts'
import { chunk, clip, limiter, pool } from './job/util'
import { AUTO_FIX, checkValid, FIX_FAILED, fixPending, reviewNotes } from './job/checkRules'
import { hearing, startTranscription } from './job/hearing'
import { busy, CHECK_BATCH, DESIGN_BATCH, finishing, guarded, HELPERS, jobs, RENDERS, resumeWaiters, stepControllers } from './job/control'
import { agentOpts, agentScene, drawOpts, finishScene, isBareStarter, repairOpts, target, writeGuides } from './job/scenes'
import { checkParts } from './job/checks'
import { finish, finishDetail } from './job/finish'
import { checkFinalVideo } from './job/finalCheck'

// The rest of the app uses these through this file.
export { emit, flushSaves } from './job/events'
export { startTranscription } from './job/hearing'
export { isRunning, pauseJob, resumeJob, stopJob } from './job/control'
export { cutRanges, exportVideo, mergePart, refinish, removeParts, splitPart } from './job/edits'

/**
 * Starts (or continues) making the video. `force` designs every unlocked part again. `recheck` also checks parts
 * that were made before: 'missing' those not checked yet or with notes, 'all' every part.
 */
export function startJob(id: string, force = false, recheck?: 'missing' | 'all') {
  const p = getProject(id)
  if (!p || jobs.has(id) || finishing.has(id)) return
  const ac = new AbortController()
  jobs.set(id, ac)
  p.job = { running: true, title: 'Getting ready', detail: '', stage: 'Voiceover', designDone: 0, renderDone: 0, steps: [], startedAt: Date.now() }
  if (force) for (const x of p.parts) if (!x.locked) x.status = 'Not designed yet'
  emit(p, true)
  let ok = false
  runJob(p, ac.signal, recheck)
    .then((notFixed) => {
      ok = true
      p.job.running = false
      p.job.title = 'Your video is ready'
      p.job.detail =
        `${p.parts.length} parts, ${Math.round(p.voiceover?.duration ?? 0)} seconds. Click a part to change it.` +
        (notFixed.length ? ` The automatic fix did not work for ${notFixed.join(', ')}: ${notFixed.length === 1 ? 'it keeps its' : 'they keep their'} last good version (see Checks).` : '')
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

async function runJob(p: Project, signal: AbortSignal, recheck?: 'missing' | 'all'): Promise<string[]> {
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
    // The outline now exists: it joins the cached instructions for the drawing sessions.
    writeGuides(p)
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

  // Checks. A part is checked only when it has no valid check: none yet, or the drawing changed since (a check is
  // valid while it is newer than the part's last render). So after a failure or a usage limit, only what is missing
  // is checked; parts already checked are never checked again for nothing ('all' asks for every part).
  const notFixed: string[] = []
  if (p.settings.checks !== 'Off') {
    const toCheck = p.parts.filter((x) => !x.locked && (recheck === 'all' || !checkValid(x)))
    const url = () => (p.parts.some((x) => engineOf(p, x) === 'remotion') ? bundleProject(p, (s) => step(p, s), 'render', { versioned: true }) : Promise.resolve(undefined))
    if (toCheck.length) {
      // One small picture per part, several parts per call, on a quick model.
      step(p, `Checking ${toCheck.length} part${toCheck.length > 1 ? 's' : ''}`, { title: 'Checking the parts', detail: `${toCheck.length} part${toCheck.length > 1 ? 's' : ''}, ${CHECK_BATCH} per look, on a quick model.` })
      await guarded(p, signal, async (s) => checkParts(p, toCheck, await url(), s, p.job.startedAt))
    }
    // On High, parts whose valid check has notes get one automatic fix: straight away, without checking them again
    // first, and never twice for the same notes (afterFix). Whatever is left, the user can comment on.
    const bad = p.settings.checks === 'High' ? p.parts.filter((x) => !x.locked && checkValid(x) && !x.checks!.ok && fixPending(x)) : []
    if (bad.length) {
      step(p, `Fixing ${bad.length} part${bad.length > 1 ? 's' : ''} after the check`, { title: 'Fixing after the check', detail: clip(bad.map((x) => `Part ${x.index + 1}: ${reviewNotes(x).join('; ')}`).join(' · '), 400) })
      const fixed: Part[] = []
      await pool(bad, p.settings.helpers ? HELPERS : 1, async (x) => {
        // One part's fix failing does not stop the others: it goes back to its last good drawing, with a note.
        const file = scenePath(p, x)
        const thumb = thumbFile(p, x)
        const before = { scene: existsSync(file) ? readFileSync(file) : null, thumb: existsSync(thumb) ? readFileSync(thumb) : null, status: x.status }
        const note: Comment = { id: '', partIds: [x.id], text: `A reviewer found: ${reviewNotes(x).join('; ')}`, mode: 'Fix just this', attachments: [], at: Date.now(), state: 'Working' }
        try {
          await guarded(p, signal, (s) => agentScene(p, x, fixPrompt(p, x, chars, note, [], target(p, x)), AUTO_FIX, s))
          fixed.push(x)
        } catch (e) {
          // A usage limit is not a failed fix: guarded pauses for it. Pass it on if it ever gets here.
          if (signal.aborted || e instanceof LimitError) throw e
          if (before.scene) writeFileSync(file, before.scene)
          if (before.thumb) writeFileSync(thumb, before.thumb)
          const why = (e as Error).message.split('\n')[0].slice(0, 160)
          setPart(p, x.id, { status: before.status, checks: { ...x.checks!, afterFix: true, notes: [...reviewNotes(x), `${FIX_FAILED} (${why}); comment on the part to try again`] } })
          step(p, `Could not fix part ${x.index + 1}: ${why}`)
          notFixed.push(`part ${x.index + 1}`)
        }
      })
      if (fixed.length) {
        const fixedAt = Date.now()
        await pool(fixed, RENDERS, (x) => renderOne(x, signal, true))
        await guarded(p, signal, async (s) => checkParts(p, fixed, await url(), s, fixedAt))
        // These were fixed once for their notes: a new note on them waits for the user, not another automatic fix.
        for (const x of fixed) if (x.checks) setPart(p, x.id, { checks: { ...x.checks, afterFix: true } })
      }
    }
  }
  for (const x of p.parts) if (renderedNow.has(x.id) || x.status === 'Rendered') setPart(p, x.id, { status: 'Up to date', video: clipFile(p, x) })
  p.job.renderDone = p.parts.length
  emit(p)
  clearRenderBundles(p)

  // 6 · Video (a Check again that changed nothing keeps the video as it is)
  p.job.stage = 'Video'
  if (recheck && !renderedNow.size && p.output && existsSync(p.output)) return notFixed
  step(p, 'Putting it together with your voiceover', { title: 'Putting the video together', detail: finishDetail(p) })
  const out = join(p.dir, 'renders', 'video.mp4')
  await guarded(p, signal, (s) => finish(p, out, { height: p.settings.quality.height, fps: p.settings.quality.fps }, s))
  p.output = out
  p.outputAt = Date.now()
  emit(p, true)
  if (p.settings.checks !== 'Off') {
    step(p, 'Checking the finished video', { title: 'Checking the finished video', detail: 'Black frames, frozen pictures, the sound and the length (no AI).' })
    p.finalCheck = await guarded(p, signal, (s) => checkFinalVideo(p, out, s))
    emit(p, true)
  }
  return notFixed

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
