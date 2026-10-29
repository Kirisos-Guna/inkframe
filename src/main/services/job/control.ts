// Running jobs: stop, pause and resume, waiting out usage limits, and the locks that keep work from colliding.
import type { Comment, Part, Project } from '../../../shared/types'
import { APP_NAME } from '../../../shared/brand'
import { getProject } from '../store'
import { LimitError } from '../agent'
import { emit, step } from './events'

// ---------- jobs ----------
export const jobs = new Map<string, AbortController>()
// Parts drawn at the same time when "Helpers" is on.
export const HELPERS = 4
// Parts drawn in one session, and parts checked in one call.
export const DESIGN_BATCH = 4
export const CHECK_BATCH = 6
// Parts rendered at the same time (each render already uses half the processor cores).
export const RENDERS = 2
export const isRunning = (id: string) => jobs.has(id)

export function stopJob(id: string) {
  const p = getProject(id)
  if (p?.job.paused) resumeJob(id)
  jobs.get(id)?.abort()
}

// ---------- pause / resume ----------
// Pausing stops the step that is running right now (an agent call or a render) and holds the job; Resume does
// that one step again and carries on. Finished parts are kept.
export const stepControllers = new Map<string, Set<AbortController>>()
export const resumeWaiters = new Map<string, (() => void)[]>()

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

export function waitWhilePaused(p: Project, job: AbortSignal) {
  if (!p.job.paused) return Promise.resolve()
  return new Promise<void>((resolve, reject) => {
    const list = resumeWaiters.get(p.id) ?? []
    list.push(resolve)
    resumeWaiters.set(p.id, list)
    job.addEventListener('abort', () => reject(new Error('Stopped')), { once: true })
  })
}

/** Runs one step so that Pause can interrupt it; after Resume the step runs again from the start. */
export async function guarded<T>(p: Project, job: AbortSignal, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
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
      // The AI's usage limit: hold the job and carry on by itself when the limit resets, instead of failing.
      if (e instanceof LimitError && !job.aborted) {
        waitForLimit(p, e)
        continue
      }
      throw e
    } finally {
      set.delete(ac)
      job.removeEventListener('abort', onJobAbort)
    }
  }
}

// ---------- usage limits ----------

/**
 * The usage limit is reached: the whole job pauses and waits for the user to press Resume (it does not carry on by
 * itself). Stop stops as usual.
 */
export function waitForLimit(p: Project, e: LimitError) {
  // Everything stops (drawing, rendering, checks) and stays paused until the user presses Resume.
  if (!p.job.paused) pauseJob(p.id)
  const who = p.settings.provider === 'Codex' ? 'Codex' : 'Claude'
  const when = e.resetsAt ? ` It resets at about ${new Date(e.resetsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : ''
  step(p, `Paused: the ${who} limit is reached`, {
    title: `Paused: the ${who} limit is reached`,
    detail: `${who}'s usage limit is reached, so everything is paused (nothing is lost).${when} Press Resume when it has reset to carry on from here.`
  })
  emit(p, true)
}

// ---------- editing parts ----------
export function busy(p: Project) {
  if (jobs.has(p.id)) throw new Error('Wait until the current work is done, or stop it first.')
  if (finishing.has(p.id)) throw new Error('Wait until the video is put together.')
}

// Export and "put it together again" share the work folder: one at a time per video.
export const finishing = new Set<string>()
export async function finishingLock<T>(p: Project, fn: () => Promise<T>) {
  busy(p)
  finishing.add(p.id)
  try {
    return await fn()
  } finally {
    finishing.delete(p.id)
  }
}
