import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, nativeTheme, protocol, shell, Tray } from 'electron'
import { createReadStream, existsSync, mkdirSync, statSync } from 'fs'
import { extname, join } from 'path'
import { Readable } from 'stream'
import type { CharacterDef, Comment, Part, Project } from '../shared/types'
import { APP_NAME } from '../shared/brand'
import * as store from './services/store'
import { getStatus, resetToolCache } from './services/tools'
import { duration, peaks } from './services/media'
import { engineOf } from './services/engines'
import { closeStillBrowser } from './services/render'
import { recreateVideo, type RecreateRequest } from './services/recreate'
import * as pipeline from './services/pipeline'
import { startLearn, stopLearn } from './services/learn'
import { extractJson, runAgent } from './services/agent'
import { characterPrompt } from './services/prompts'
import { makeThumbnails, writeCaptions, writePublishKit, writeScript, type ScriptRequest } from './services/publish'
import { toSrt, toVtt, linesFromWords } from './services/captions'
import { onUsage, type Usage } from './services/agent'
import { checkForUpdates, downloadUpdate, installUpdate, setupUpdates, updateState } from './services/updater'
import { copyFileSync, readFileSync, writeFileSync } from 'fs'

app.setName(APP_NAME)
// Installed: work from the app's data folder, so Remotion downloads its browser there (writable, kept across updates).
if (app.isPackaged) {
  mkdirSync(app.getPath('userData'), { recursive: true })
  process.chdir(app.getPath('userData'))
}
nativeTheme.themeSource = 'dark'
protocol.registerSchemesAsPrivileged([{ scheme: 'media', privileges: { stream: true, supportFetchAPI: true, bypassCSP: true, secure: true, standard: true } }])

let win: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml'
}

/** media://f/<encoded path> serves local files to the page, with byte ranges so video can seek. */
function registerMedia() {
  protocol.handle('media', (req) => {
    const url = new URL(req.url)
    const file = decodeURIComponent(url.pathname.replace(/^\//, ''))
    if (!existsSync(file)) return new Response('Not found', { status: 404 })
    const size = statSync(file).size
    const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream'
    const range = req.headers.get('range')
    if (range) {
      const m = range.match(/bytes=(\d*)-(\d*)/)!
      const start = m[1] ? +m[1] : 0
      const end = m[2] ? Math.min(+m[2], size - 1) : size - 1
      return new Response(Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream, {
        status: 206,
        headers: { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': String(end - start + 1) }
      })
    }
    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
      headers: { 'Content-Type': type, 'Content-Length': String(size), 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' }
    })
  })
}

const icon = () => nativeImage.createFromPath(join(app.getAppPath(), 'resources', 'icon.png'))

function createWindow() {
  win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1024,
    minHeight: 700,
    titleBarStyle: 'hidden',
    // No title bar: Windows draws only its buttons, over the app's own background.
    titleBarOverlay: { color: '#0b0b0c', symbolColor: '#d4d4d8', height: 40 },
    backgroundColor: '#0b0b0c',
    title: APP_NAME,
    icon: icon(),
    autoHideMenuBar: true,
    show: false,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false, contextIsolation: true }
  })
  win.once('ready-to-show', () => win?.show())
  win.on('close', (e) => {
    // Work carries on in the background: hide instead of quitting while something is running.
    const busy = store.listProjects().some((p) => pipeline.isRunning(p.id))
    if (busy && !quitting) {
      e.preventDefault()
      win?.hide()
      ensureTray()
      tray?.displayBalloon?.({ title: APP_NAME, content: 'Still working on your video. It carries on here.' })
    }
  })
  win.on('closed', () => (win = null))
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

function ensureTray() {
  if (tray) return
  tray = new Tray(icon().resize({ width: 16, height: 16 }))
  tray.setToolTip(APP_NAME)
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `Open ${APP_NAME}`, click: () => (win ? win.show() : createWindow()) },
      { type: 'separator' },
      {
        label: 'Quit (stops the work)',
        click: () => {
          quitting = true
          app.quit()
        }
      }
    ])
  )
  tray.on('click', () => (win ? win.show() : createWindow()))
}

// Fields of a part the page may change; the rest belong to the pipeline.
const USER_PART_FIELDS: (keyof Part)[] = ['locked', 'styleId', 'material', 'title', 'engine']

const safeName = (s: string) => s.replace(/[\/:*?"<>|]+/g, '').slice(0, 80) || 'Inkframe'

// The last 5-hour usage Claude reported (shown in the editor's top bar), kept across restarts.
const usageFile = () => join(store.userDir(), 'usage.json')
let usage: Usage | null = null
function loadUsage() {
  try {
    usage = JSON.parse(readFileSync(usageFile(), 'utf8'))
  } catch {
    usage = null
  }
  onUsage((u) => {
    usage = u
    writeFileSync(usageFile(), JSON.stringify(u))
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send('usage:changed', u)
  })
}

function registerIpc() {
  const h = <A extends unknown[], R>(ch: string, fn: (...a: A) => R) => ipcMain.handle(ch, (_e, ...a) => fn(...(a as A)))

  h('settings:get', () => store.getSettings())
  h('settings:set', (patch) => {
    const s = store.setSettings(patch as object)
    resetToolCache()
    return s
  })
  h('status:get', () => getStatus())

  h('projects:list', () => store.listProjects())
  h('projects:get', (id: string) => store.getProject(id))
  h('projects:create', (partial: Partial<Project>) => {
    const p = store.createProject(partial)
    if (p.voiceover) pipeline.startTranscription(p.id)
    return p
  })
  h('projects:update', (id: string, patch: Partial<Project>) => {
    const p = store.getProject(id)
    if (!p) throw new Error('No such video')
    const { parts, ...rest } = patch
    const newVoice = rest.voiceover && rest.voiceover.file !== p.voiceover?.file
    Object.assign(p, rest)
    if (parts) {
      for (const incoming of parts) {
        const cur = p.parts.find((x) => x.id === incoming.id)
        if (!cur) continue
        const before = { engine: engineOf(p, cur), render: store.getStyle(cur.styleId ?? p.settings.styleId).render ?? 'svg', styleId: cur.styleId }
        for (const k of USER_PART_FIELDS) if (k in incoming) (cur as unknown as Record<string, unknown>)[k] = incoming[k]
        const render = store.getStyle(cur.styleId ?? p.settings.styleId).render ?? 'svg'
        // A different engine, or 2D ↔ 3D, needs a new drawing; another flat style only needs rendering again.
        if (engineOf(p, cur) !== before.engine || render !== before.render) cur.status = 'Not designed yet'
        else if (cur.styleId !== before.styleId && cur.status === 'Up to date') cur.status = 'Designed'
      }
    }
    if (newVoice) {
      p.words = []
      p.parts = []
      pipeline.startTranscription(p.id)
    }
    pipeline.emit(p, true)
    return p
  })
  h('projects:remove', (id: string) => {
    pipeline.stopJob(id)
    store.removeProject(id)
  })

  h('media:probe', async (file: string) => ({ duration: await duration(file), peaks: await peaks(file) }))
  h('media:peaks', (file: string) => peaks(file).catch(() => []))

  h('pick:file', async (filters: Electron.FileFilter[], multi: boolean) => {
    const r = await dialog.showOpenDialog(win!, { properties: multi ? ['openFile', 'multiSelections'] : ['openFile'], filters })
    return r.canceled ? [] : r.filePaths
  })
  h('pick:folder', async () => {
    const r = await dialog.showOpenDialog(win!, { properties: ['openDirectory', 'createDirectory'] })
    return r.canceled ? null : r.filePaths[0]
  })

  h('job:start', (id: string, force?: boolean) => pipeline.startJob(id, !!force))
  h('job:check', (id: string, which: 'missing' | 'all') => pipeline.startJob(id, false, which))
  h('job:stop', (id: string) => pipeline.stopJob(id))
  h('job:pause', (id: string) => pipeline.pauseJob(id))
  h('job:resume', (id: string) => pipeline.resumeJob(id))
  h('job:refinish', (id: string) => pipeline.refinish(id))

  h('writer:script', (r: ScriptRequest) => writeScript(r))
  h('writer:recreate', (r: RecreateRequest) =>
    recreateVideo(r, (s) => {
      for (const w of BrowserWindow.getAllWindows()) w.webContents.send('recreate:status', s)
    })
  )
  h('writer:publish', (id: string) => writePublishKit(id))
  h('writer:captions', (id: string, tidy: boolean) => writeCaptions(id, tidy))
  h('captions:save', async (id: string, format: 'srt' | 'vtt') => {
    const p = store.getProject(id)!
    const lines = p.captionLines?.length ? p.captionLines : linesFromWords(p.words)
    const r = await dialog.showSaveDialog(win!, { defaultPath: join(store.getSettings().saveDir, `${safeName(p.title)}.${format}`), filters: [{ name: format.toUpperCase(), extensions: [format] }] })
    if (r.canceled || !r.filePath) return null
    writeFileSync(r.filePath, format === 'srt' ? toSrt(lines) : toVtt(lines))
    return r.filePath
  })
  h('thumbs:make', (id: string, count: number, note?: string) => makeThumbnails(id, count, note))
  h('file:saveCopy', async (from: string, name: string) => {
    const ext = from.split('.').pop() ?? 'png'
    const r = await dialog.showSaveDialog(win!, { defaultPath: join(store.getSettings().saveDir, `${safeName(name)}.${ext}`), filters: [{ name: ext.toUpperCase(), extensions: [ext] }] })
    if (r.canceled || !r.filePath) return null
    copyFileSync(from, r.filePath)
    return r.filePath
  })
  h('file:saveText', async (text: string, name: string) => {
    const r = await dialog.showSaveDialog(win!, { defaultPath: join(store.getSettings().saveDir, `${safeName(name)}.txt`), filters: [{ name: 'Text', extensions: ['txt'] }] })
    if (r.canceled || !r.filePath) return null
    writeFileSync(r.filePath, text)
    return r.filePath
  })
  h('usage:get', () => usage)
  h('update:get', () => updateState())
  h('update:check', () => checkForUpdates())
  h('update:download', () => downloadUpdate())
  h('update:install', () => {
    quitting = true
    installUpdate()
  })
  h('job:comment', (id: string, c: Comment) => pipeline.addComment(id, c))
  h('job:export', async (id: string, opts: { height: number; fps: number }) => {
    const p = store.getProject(id)!
    const r = await dialog.showSaveDialog(win!, {
      defaultPath: join(store.getSettings().saveDir, `${p.title.replace(/[\\/:*?"<>|]+/g, '')}.mp4`),
      filters: [{ name: 'MP4 video', extensions: ['mp4'] }]
    })
    if (r.canceled || !r.filePath) return null
    return pipeline.exportVideo(id, opts, r.filePath)
  })

  h('parts:split', (id: string, partId: string, at: number) => pipeline.splitPart(id, partId, at))
  h('parts:merge', (id: string, partId: string) => pipeline.mergePart(id, partId))
  h('parts:remove', (id: string, ids: string[]) => pipeline.removeParts(id, ids))
  h('parts:cut', (id: string, from: number, to: number) => pipeline.cutRanges(id, [[from, to]]))
  h('parts:restore', (id: string, partId: string, file: string) => pipeline.restoreVersion(id, partId, file))

  h('styles:list', () => store.listStyles())
  h('styles:save', (s) => store.saveStyle(s as never))
  h('styles:remove', (id: string) => store.removeStyle(id))

  h('characters:list', () => store.listCharacters())
  h('characters:save', (c: CharacterDef) => store.saveCharacter(c))
  h('characters:remove', (id: string) => store.removeCharacter(id))
  h('characters:addCast', () => store.addStarterCast())
  h('characters:describe', async (c: CharacterDef, text: string) => {
    const s = store.getSettings()
    const reply = await runAgent({ provider: s.defaultProvider, model: s.defaultModel, effort: 'Low', cwd: store.libDir('characters'), prompt: characterPrompt(c, text) })
    const got = extractJson<Partial<CharacterDef>>(reply)
    const pick = <K extends keyof CharacterDef>(k: K, allowed?: readonly unknown[]) =>
      got[k] !== undefined && (!allowed || allowed.includes(got[k])) ? got[k] : c[k]
    const hex = (k: 'skin' | 'eyeColour' | 'hairColour' | 'outfitColour') => (typeof got[k] === 'string' && /^#[0-9a-f]{6}$/i.test(got[k] as string) ? (got[k] as string) : c[k])
    return {
      ...c,
      name: typeof got.name === 'string' && got.name.trim() ? got.name.trim().slice(0, 24) : c.name,
      skin: hex('skin'),
      eyeColour: hex('eyeColour'),
      hairColour: hex('hairColour'),
      outfitColour: hex('outfitColour'),
      head: pick('head', ['Round', 'Oval', 'Square', 'Long', 'Wide']),
      eyes: pick('eyes', ['Dots', 'Round', 'Big', 'Sleepy', 'Lashes']),
      eyebrows: pick('eyebrows', ['None', 'Soft', 'Thick', 'Arched']),
      nose: pick('nose', ['None', 'Dot', 'Button', 'Long']),
      hair: pick('hair', ['Bob', 'Short', 'Long', 'Bun', 'Bald', 'Curly', 'Ponytail', 'Afro', 'Spiky', 'Side part']),
      outfit: pick('outfit', ['Lab coat', 'Hoodie', 'Suit', 'T-shirt', 'Apron', 'Jacket', 'Dress', 'Overalls', 'Sweater']),
      facialHair: pick('facialHair', ['None', 'Stubble', 'Beard', 'Mustache']),
      hat: pick('hat', ['None', 'Cap', 'Beanie', 'Hard hat']),
      age: pick('age', ['Kid', 'Adult', 'Older']),
      headphones: typeof got.headphones === 'boolean' ? got.headphones : c.headphones,
      body: pick('body', ['Slim', 'Average', 'Broad']),
      glasses: typeof got.glasses === 'boolean' ? got.glasses : c.glasses,
      pose: typeof got.pose === 'string' ? got.pose : c.pose,
      expression: typeof got.expression === 'string' ? got.expression : c.expression
    } as CharacterDef
  })

  h('learn:list', () => store.listLearn())
  h('learn:start', (s) => startLearn(s as never))
  h('learn:remove', (id: string) => {
    stopLearn(id)
    store.removeLearn(id)
  })

  h('shell:open', (p: string) => shell.openPath(p))
  h('shell:reveal', (p: string) => shell.showItemInFolder(p))
}

const single = app.requestSingleInstanceLock()
if (!single) app.quit()
else {
  app.on('second-instance', () => {
    if (!win) createWindow()
    win?.show()
    win?.focus()
  })
  app.whenReady().then(() => {
    loadUsage()
    setupUpdates()
    registerMedia()
    registerIpc()
    createWindow()
  })
  app.on('before-quit', () => {
    quitting = true
    closeStillBrowser()
  })
  app.on('window-all-closed', () => {
    const busy = store.listProjects().some((p) => pipeline.isRunning(p.id))
    if (!busy) app.quit()
  })
}
