import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, renameSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { AppSettings, LearnSession, Project, StyleDef } from '../../shared/types'
import { APP_NAME } from '../../shared/brand'
import { BUILTIN_STYLES } from '../../shared/styles'

export const userDir = () => app.getPath('userData')
export const libDir = (...p: string[]) => {
  const d = join(userDir(), 'library', ...p)
  mkdirSync(d, { recursive: true })
  return d
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T
  } catch {
    return fallback
  }
}
function writeJson(file: string, data: unknown) {
  const tmp = file + '.tmp'
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  renameSync(tmp, file)
}

// ---------- settings ----------
const settingsFile = () => join(userDir(), 'settings.json')
export function getSettings(): AppSettings {
  const d: AppSettings = {
    saveDir: join(app.getPath('videos'), APP_NAME),
    claudePath: '',
    codexPath: '',
    whisperPath: '',
    whisperModel: '',
    ytDlpPath: '',
    defaultProvider: 'Claude Code',
    defaultModel: 'Opus 5.5',
    defaultEffort: 'High',
    defaultChecks: 'High'
  }
  return { ...d, ...readJson<Partial<AppSettings>>(settingsFile(), {}) }
}
export function setSettings(patch: Partial<AppSettings>) {
  const next = { ...getSettings(), ...patch }
  writeJson(settingsFile(), next)
  return next
}

// ---------- projects ----------
// Every project lives in its own folder in the save folder; an index in userData remembers where.
const indexFile = () => join(userDir(), 'projects.json')
const cache = new Map<string, Project>()

function index(): Record<string, string> {
  return readJson(indexFile(), {})
}

export function listProjects(): Project[] {
  const out: Project[] = []
  for (const [id, dir] of Object.entries(index())) {
    const p = getProject(id, dir)
    if (p && !p.draft) out.push(p)
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getProject(id: string, dir?: string): Project | undefined {
  if (cache.has(id)) return cache.get(id)
  const d = dir ?? index()[id]
  if (!d) return
  const p = readJson<Project | null>(join(d, 'project.json'), null)
  if (p) {
    // A job cannot survive a restart of the app: put back what it was in the middle of, so nothing looks stuck.
    if (p.job.running) p.job = { ...p.job, running: false, error: 'Stopped when the app closed. Press Make again to carry on.' }
    p.job.paused = false
    p.job.pausedAt = undefined
    const drawn = (id: string) => existsSync(join(d, 'scenes', `${id}.tsx`)) || existsSync(join(d, 'scenes', id, 'index.html'))
    for (const x of p.parts) {
      if (x.status === 'Designing' || x.status === 'Making it again') x.status = drawn(x.id) ? 'Designed' : 'Not designed yet'
      else if (x.status === 'Rendering') x.status = 'Designed'
    }
    // A change that was being worked on is done again on the next run.
    for (const c of p.comments) if (c.state === 'Working') c.state = 'Waiting'
    p.transcribing = false
    cache.set(id, p)
  }
  return p ?? undefined
}

// Deleted videos: a job that is still winding down must not write them back.
const removed = new Set<string>()

export function saveProject(p: Project) {
  if (removed.has(p.id)) return p
  p.updatedAt = Date.now()
  cache.set(p.id, p)
  writeJson(join(p.dir, 'project.json'), p)
  return p
}

export function createProject(partial: Partial<Project>): Project {
  const s = getSettings()
  const id = randomUUID()
  const slug = (partial.title || 'video').replace(/[^\w\- ]+/g, '').trim().slice(0, 40) || 'video'
  let dir = join(s.saveDir, slug)
  for (let i = 2; existsSync(dir); i++) dir = join(s.saveDir, `${slug} ${i}`)
  for (const sub of ['', 'scenes', 'scenes/history', 'public', 'renders', 'thumbs', 'work']) mkdirSync(join(dir, sub), { recursive: true })
  const p: Project = {
    title: partial.title || 'Untitled video',
    dir,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    direction: '',
    material: [],
    words: [],
    parts: [],
    comments: [],
    settings: {
      kind: 'Explainer',
      tone: ['Calm', 'Nerdy'],
      creativity: 'Storytelling',
      styleId: 'hand-drawn-board',
      quality: { height: 1080, fps: 60 },
      checks: s.defaultChecks,
      provider: s.defaultProvider,
      model: s.defaultModel,
      effort: s.defaultEffort,
      helpers: false
    },
    job: { running: false, title: '', detail: '', stage: 'Voiceover', designDone: 0, renderDone: 0, steps: [], startedAt: 0 },
    ...partial,
    id: id
  }
  p.dir = dir
  writeJson(indexFile(), { ...index(), [id]: dir })
  return saveProject(p)
}

export function removeProject(id: string) {
  const p = getProject(id)
  removed.add(id)
  const idx = index()
  delete idx[id]
  writeJson(indexFile(), idx)
  cache.delete(id)
  if (p && existsSync(p.dir)) rmSync(p.dir, { recursive: true, force: true })
}

/**
 * Removes "New video" drafts that were started but never made, once they are a day old. Only the folder the app
 * created for the draft goes; a draft whose folder holds the voiceover itself is kept. Returns how many went.
 */
/** The newest unfinished New video (a voiceover was added, Make was not pressed yet), to carry on with it. */
export function lastDraft(): Project | undefined {
  let best: Project | undefined
  for (const [id, dir] of Object.entries(index())) {
    const p = getProject(id, dir)
    if (p?.draft && p.voiceover && (!best || p.updatedAt > best.updatedAt)) best = p
  }
  return best
}

export function cleanDrafts(maxAgeMs = 24 * 60 * 60 * 1000) {
  let n = 0
  for (const [id, dir] of Object.entries(index())) {
    const p = getProject(id, dir)
    if (!p?.draft || Date.now() - (p.updatedAt || p.createdAt) < maxAgeMs) continue
    const inside = (f?: string) => !!f && f.toLowerCase().startsWith(p.dir.toLowerCase() + '\\')
    if (inside(p.voiceover?.file) || !existsSync(join(p.dir, 'project.json'))) continue
    removeProject(id)
    n++
  }
  return n
}

// ---------- styles ----------
export function listStyles(): StyleDef[] {
  const dir = libDir('styles')
  const custom = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJson<StyleDef | null>(join(dir, f), null))
    .filter(Boolean) as StyleDef[]
  const hidden = new Set(getSettings().hiddenStyles ?? [])
  return [...BUILTIN_STYLES.map((s) => (hidden.has(s.id) ? { ...s, hidden: true } : s)), ...custom]
}
export const getStyle = (id: string) => listStyles().find((s) => s.id === id) ?? BUILTIN_STYLES[0]
export function saveStyle(s: StyleDef) {
  writeJson(join(libDir('styles'), `${s.id}.json`), { ...s, custom: true })
  return s
}
/**
 * Deletes a style. Your own styles are deleted for good; a library style is hidden (videos already made with it keep
 * rendering, and it can be brought back). The last style left can't be deleted.
 */
export function removeStyle(id: string) {
  const left = listStyles().filter((s) => !s.hidden && s.id !== id)
  if (!left.length) throw new Error('Keep at least one style')
  if (BUILTIN_STYLES.some((s) => s.id === id)) {
    setSettings({ hiddenStyles: [...new Set([...(getSettings().hiddenStyles ?? []), id])] })
    return
  }
  rmSync(join(libDir('styles'), `${id}.json`), { force: true })
  rmSync(libDir('styles', id), { recursive: true, force: true })
}
/** Brings back the library styles you deleted. */
export const restoreStyles = () => setSettings({ hiddenStyles: [] })
/** Extra notes a learned style carries for the designers (written by Claude). */
export function styleGuide(id: string) {
  const f = join(libDir('styles', id), 'style.md')
  return existsSync(f) ? readFileSync(f, 'utf8') : ''
}

// ---------- learning sessions ----------
const learnFile = () => join(userDir(), 'learn.json')
export const listLearn = (): LearnSession[] => readJson<LearnSession[]>(learnFile(), []).sort((a, b) => b.at - a.at)
export function saveLearn(s: LearnSession) {
  writeJson(learnFile(), [s, ...listLearn().filter((x) => x.id !== s.id)])
  return s
}
export const removeLearn = (id: string) => writeJson(learnFile(), listLearn().filter((x) => x.id !== id))
