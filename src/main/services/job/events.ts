// Saving a project and telling the page, and the steps shown while a job runs.
import { BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import type { Comment, Part, Project } from '../../../shared/types'
import { getProject, saveProject } from '../store'
import { part } from './parts'

// ---------- events ----------
export const pendingEmit = new Map<string, NodeJS.Timeout>()
/** Writes every project with a change still waiting to be saved (when the app quits). */
export function flushSaves() {
  for (const [id, t] of pendingEmit) {
    clearTimeout(t)
    const p = getProject(id)
    if (p) saveProject(p)
  }
  pendingEmit.clear()
}

export function emit(p: Project, now = false) {
  // Saved with each update the page gets (at most every 120 ms), not on every single change: a running job changes
  // the project many times a second, and each save rewrites the whole project file.
  const send = () => {
    pendingEmit.delete(p.id)
    saveProject(p)
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send('project:changed', p)
  }
  // At most one update every 120 ms, but never postponed forever by a steady stream of events.
  if (now) {
    clearTimeout(pendingEmit.get(p.id))
    send()
  } else if (!pendingEmit.has(p.id)) pendingEmit.set(p.id, setTimeout(send, 120))
}

export function step(p: Project, label: string, opts: { title?: string; detail?: string } = {}) {
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

export function setPart(p: Project, id: string, patch: Partial<Part>) {
  const x = part(p, id)
  if (x) Object.assign(x, patch)
  emit(p)
}
