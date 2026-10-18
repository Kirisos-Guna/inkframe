import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, renameSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { AppSettings, CharacterDef, LearnSession, Project, StyleDef } from '../../shared/types'
import { APP_NAME } from '../../shared/brand'
import { BUILTIN_STYLES } from '../../shared/styles'
import { newCharacter } from '../../shared/characterDefaults'

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
    // A job cannot survive a restart of the app.
    if (p.job.running) p.job = { ...p.job, running: false, error: 'Stopped when the app closed. Press Make again to carry on.' }
    p.transcribing = false
    cache.set(id, p)
  }
  return p ?? undefined
}

export function saveProject(p: Project) {
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
      characterIds: [],
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
  const idx = index()
  delete idx[id]
  writeJson(indexFile(), idx)
  cache.delete(id)
  if (p && existsSync(p.dir)) rmSync(p.dir, { recursive: true, force: true })
}

// ---------- styles ----------
export function listStyles(): StyleDef[] {
  const dir = libDir('styles')
  const custom = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJson<StyleDef | null>(join(dir, f), null))
    .filter(Boolean) as StyleDef[]
  return [...BUILTIN_STYLES, ...custom]
}
export const getStyle = (id: string) => listStyles().find((s) => s.id === id) ?? BUILTIN_STYLES[0]
export function saveStyle(s: StyleDef) {
  writeJson(join(libDir('styles'), `${s.id}.json`), { ...s, custom: true })
  return s
}
export function removeStyle(id: string) {
  rmSync(join(libDir('styles'), `${id}.json`), { force: true })
  rmSync(libDir('styles', id), { recursive: true, force: true })
}
/** Extra notes a learned style carries for the designers (written by Claude). */
export function styleGuide(id: string) {
  const f = join(libDir('styles', id), 'style.md')
  return existsSync(f) ? readFileSync(f, 'utf8') : ''
}

// ---------- characters ----------
export function listCharacters(): CharacterDef[] {
  const dir = libDir('characters')
  const list = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJson<CharacterDef | null>(join(dir, f), null))
    .filter(Boolean) as CharacterDef[]
  if (!list.length && !existsSync(join(dir, '.seeded'))) {
    // First run: start with one character so the page is not empty.
    writeFileSync(join(dir, '.seeded'), '')
    const ada = newCharacter(randomUUID())
    saveCharacter(ada)
    return [ada]
  }
  return list.sort((a, b) => a.name.localeCompare(b.name))
}
export function saveCharacter(c: CharacterDef) {
  writeJson(join(libDir('characters'), `${c.id}.json`), c)
  return c
}
export const removeCharacter = (id: string) => rmSync(join(libDir('characters'), `${id}.json`), { force: true })

// ---------- learning sessions ----------
const learnFile = () => join(userDir(), 'learn.json')
export const listLearn = (): LearnSession[] => readJson<LearnSession[]>(learnFile(), []).sort((a, b) => b.at - a.at)
export function saveLearn(s: LearnSession) {
  writeJson(learnFile(), [s, ...listLearn().filter((x) => x.id !== s.id)])
  return s
}
export const removeLearn = (id: string) => writeJson(learnFile(), listLearn().filter((x) => x.id !== id))
