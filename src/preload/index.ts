import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  AppSettings,
  CharacterDef,
  Comment,
  LearnSession,
  Project,
  Status,
  StyleDef
} from '../shared/types'

export type UpdateInfo = {
  state: 'idle' | 'checking' | 'none' | 'available' | 'downloading' | 'ready' | 'error'
  version: string
  next?: string
  notes?: string
  percent?: number
  message?: string
}

const invoke = <T>(ch: string, ...args: unknown[]) => ipcRenderer.invoke(ch, ...args) as Promise<T>

function on<T>(ch: string, cb: (v: T) => void) {
  const fn = (_: unknown, v: T) => cb(v)
  ipcRenderer.on(ch, fn)
  return () => {
    ipcRenderer.removeListener(ch, fn)
  }
}

const api = {
  settings: {
    get: () => invoke<AppSettings>('settings:get'),
    set: (patch: Partial<AppSettings>) => invoke<AppSettings>('settings:set', patch)
  },
  status: () => invoke<Status>('status:get'),
  projects: {
    list: () => invoke<Project[]>('projects:list'),
    get: (id: string) => invoke<Project>('projects:get', id),
    create: (p: Partial<Project>) => invoke<Project>('projects:create', p),
    update: (id: string, patch: Partial<Project>) => invoke<Project>('projects:update', id, patch),
    remove: (id: string) => invoke<void>('projects:remove', id)
  },
  media: {
    probe: (file: string) => invoke<{ duration: number; peaks: number[] }>('media:probe', file),
    peaks: (file: string) => invoke<number[]>('media:peaks', file),
    url: (file: string) => 'media://f/' + encodeURIComponent(file)
  },
  pick: {
    file: (filters: { name: string; extensions: string[] }[], multi = false) =>
      invoke<string[]>('pick:file', filters, multi),
    folder: () => invoke<string | null>('pick:folder')
  },
  pathOf: (f: File) => webUtils.getPathForFile(f),
  job: {
    start: (id: string, force = false) => invoke<void>('job:start', id, force),
    check: (id: string, which: 'missing' | 'all') => invoke<void>('job:check', id, which),
    stop: (id: string) => invoke<void>('job:stop', id),
    pause: (id: string) => invoke<void>('job:pause', id),
    resume: (id: string) => invoke<void>('job:resume', id),
    refinish: (id: string) => invoke<Project>('job:refinish', id),
    comment: (id: string, c: Comment) => invoke<void>('job:comment', id, c),
    exportVideo: (id: string, opts: { height: number; fps: number }) =>
      invoke<string | null>('job:export', id, opts)
  },
  parts: {
    split: (id: string, partId: string, at: number) => invoke<Project>('parts:split', id, partId, at),
    merge: (id: string, partId: string) => invoke<Project>('parts:merge', id, partId),
    remove: (id: string, partIds: string[]) => invoke<Project>('parts:remove', id, partIds),
    cut: (id: string, from: number, to: number) => invoke<Project>('parts:cut', id, from, to),
    restore: (id: string, partId: string, file: string) =>
      invoke<Project>('parts:restore', id, partId, file)
  },
  styles: {
    list: () => invoke<StyleDef[]>('styles:list'),
    save: (s: StyleDef) => invoke<StyleDef>('styles:save', s),
    remove: (id: string) => invoke<void>('styles:remove', id)
  },
  characters: {
    list: () => invoke<CharacterDef[]>('characters:list'),
    save: (c: CharacterDef) => invoke<CharacterDef>('characters:save', c),
    remove: (id: string) => invoke<void>('characters:remove', id),
    addCast: () => invoke<number>('characters:addCast'),
    describe: (c: CharacterDef, text: string) => invoke<CharacterDef>('characters:describe', c, text)
  },
  learn: {
    list: () => invoke<LearnSession[]>('learn:list'),
    start: (s: Partial<LearnSession> & { source: string }) => invoke<LearnSession>('learn:start', s),
    remove: (id: string) => invoke<void>('learn:remove', id)
  },
  scout: {
    start: (id: string) => invoke<LearnSession>('style:scout', id),
    onStatus: (cb: (status: string) => void) => on<string>('scout:status', cb)
  },
  writer: {
    script: (r: { topic: string; angle?: string; minutes: number; platform: string; tone: string; research: boolean }) =>
      invoke<{ title: string; script: string; hooks: string[]; sources: string[]; by: string }>('writer:script', r),
    recreate: (r: { url: string; minutes: number; tone: string; notes?: string; research: boolean }) =>
      invoke<{
        title: string
        script: string
        hooks: string[]
        direction: string
        analysis: { concept: string; audience: string; hook: string; structure: { at: string; beat: string; purpose: string }[]; devices: string[] }
        source: { title: string; channel: string; duration: number; url: string }
        by: string
      }>('writer:recreate', r),
    onRecreate: (cb: (status: string) => void) => on<string>('recreate:status', cb),
    publish: (id: string) => invoke<Project>('writer:publish', id),
    captions: (id: string, tidy: boolean) => invoke<Project>('writer:captions', id, tidy)
  },
  captions: { save: (id: string, format: 'srt' | 'vtt') => invoke<string | null>('captions:save', id, format) },
  thumbs: { make: (id: string, count: number, note?: string) => invoke<Project>('thumbs:make', id, count, note) },
  file: {
    saveCopy: (from: string, name: string) => invoke<string | null>('file:saveCopy', from, name),
    saveText: (text: string, name: string) => invoke<string | null>('file:saveText', text, name)
  },
  usage: {
    get: () => invoke<{ fiveHour: number; resetsAt: number } | null>('usage:get'),
    on: (cb: (u: { fiveHour: number; resetsAt: number }) => void) => on('usage:changed', cb)
  },
  update: {
    get: () => invoke<UpdateInfo>('update:get'),
    check: () => invoke<UpdateInfo>('update:check'),
    download: () => invoke<UpdateInfo>('update:download'),
    install: () => invoke<void>('update:install'),
    on: (cb: (u: UpdateInfo) => void) => on<UpdateInfo>('update:changed', cb)
  },
  shell: {
    open: (p: string) => invoke<void>('shell:open', p),
    reveal: (p: string) => invoke<void>('shell:reveal', p)
  },
  onProject: (cb: (p: Project) => void) => on<Project>('project:changed', cb),
  onLearn: (cb: (s: LearnSession) => void) => on<LearnSession>('learn:changed', cb)
}

export type Api = typeof api
contextBridge.exposeInMainWorld('api', api)
