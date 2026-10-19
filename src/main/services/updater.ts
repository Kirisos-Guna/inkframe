// In-app updates from the GitHub releases (electron-updater reads latest.yml from the newest release).
import { app, BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'

export type UpdateState =
  | { state: 'idle' | 'checking' | 'none'; version: string }
  | { state: 'available'; version: string; next: string; notes: string }
  | { state: 'downloading'; version: string; next: string; percent: number }
  | { state: 'ready'; version: string; next: string }
  | { state: 'error'; version: string; message: string }

const { autoUpdater } = electronUpdater
let current: UpdateState = { state: 'idle', version: app.getVersion() }

function set(s: UpdateState) {
  current = s
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('update:changed', s)
}

const notesText = (n: unknown) =>
  (typeof n === 'string' ? n : Array.isArray(n) ? n.map((x) => x.note ?? '').join('\n') : '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 1500)

export function setupUpdates() {
  // Nothing to update when running from source.
  if (!app.isPackaged) return
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  const v = app.getVersion()
  autoUpdater.on('checking-for-update', () => set({ state: 'checking', version: v }))
  autoUpdater.on('update-not-available', () => set({ state: 'none', version: v }))
  autoUpdater.on('update-available', (i) => set({ state: 'available', version: v, next: i.version, notes: notesText(i.releaseNotes) }))
  autoUpdater.on('download-progress', (p) => {
    const next = 'next' in current ? current.next : ''
    set({ state: 'downloading', version: v, next, percent: Math.round(p.percent) })
  })
  autoUpdater.on('update-downloaded', (i) => set({ state: 'ready', version: v, next: i.version }))
  autoUpdater.on('error', (e) => set({ state: 'error', version: v, message: String(e?.message ?? e).split('\n')[0].slice(0, 200) }))
  // Check shortly after start, then every 4 hours.
  setTimeout(() => checkForUpdates(), 8000)
  setInterval(() => checkForUpdates(), 4 * 60 * 60 * 1000)
}

export const updateState = () => current

export async function checkForUpdates() {
  if (!app.isPackaged) {
    set({ state: 'none', version: app.getVersion() })
    return current
  }
  if (current.state === 'downloading' || current.state === 'ready') return current
  try {
    await autoUpdater.checkForUpdates()
  } catch (e) {
    set({ state: 'error', version: app.getVersion(), message: String((e as Error).message ?? e).split('\n')[0].slice(0, 200) })
  }
  return current
}

export async function downloadUpdate() {
  if (current.state !== 'available' && current.state !== 'error') return current
  await autoUpdater.downloadUpdate()
  return current
}

/** Quits, runs the new installer quietly, and opens the new version. */
export function installUpdate() {
  if (current.state === 'ready') autoUpdater.quitAndInstall(true, true)
}
