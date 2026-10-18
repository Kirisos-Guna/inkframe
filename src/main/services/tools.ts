import { app } from 'electron'
import { execFile } from 'child_process'
import { existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import ffmpegStatic from 'ffmpeg-static'
import type { Status } from '../../shared/types'
import { getSettings, libDir } from './store'

export const ffmpegPath = () => (ffmpegStatic as unknown as string).replace('app.asar', 'app.asar.unpacked')

function which(cmd: string): Promise<string | null> {
  return new Promise((res) =>
    execFile('where.exe', [cmd], { windowsHide: true }, (err, out) => res(err ? null : out.split(/\r?\n/).find(Boolean)?.trim() ?? null))
  )
}

/** Newest Claude Code bundled with the Claude desktop app, if any. */
function bundledClaude(): string | null {
  const root = join(app.getPath('appData'), 'Claude', 'claude-code')
  if (!existsSync(root)) return null
  const found: { f: string; t: number }[] = []
  for (const v of readdirSync(root)) {
    const vd = join(root, v)
    if (!statSync(vd).isDirectory()) continue
    for (const h of readdirSync(vd)) {
      const f = join(vd, h, 'claude.exe')
      if (existsSync(f)) found.push({ f, t: statSync(f).mtimeMs })
    }
  }
  return found.sort((a, b) => b.t - a.t)[0]?.f ?? null
}

const resolved: Record<string, string | null> = {}

export async function claudePath() {
  const s = getSettings()
  if (s.claudePath && existsSync(s.claudePath)) return s.claudePath
  if (resolved.claude === undefined) {
    const home = app.getPath('home')
    const candidates = [join(home, '.local', 'bin', 'claude.exe'), join(app.getPath('appData'), 'npm', 'claude.cmd')]
    resolved.claude = (await which('claude')) ?? candidates.find(existsSync) ?? bundledClaude()
  }
  return resolved.claude
}

export async function codexPath() {
  const s = getSettings()
  if (s.codexPath && existsSync(s.codexPath)) return s.codexPath
  if (resolved.codex === undefined) resolved.codex = (await which('codex')) ?? [join(app.getPath('appData'), 'npm', 'codex.cmd')].find(existsSync) ?? null
  return resolved.codex
}

export async function ytDlpPath() {
  const s = getSettings()
  if (s.ytDlpPath && existsSync(s.ytDlpPath)) return s.ytDlpPath
  if (resolved.yt === undefined) resolved.yt = await which('yt-dlp')
  return resolved.yt
}

/** whisper.cpp lives in the library folder once downloaded, unless the user points somewhere else. */
export function whisperPaths() {
  const s = getSettings()
  const dir = libDir('whisper')
  // main.exe is the old name; newer builds ship it only as a stub that points to whisper-cli.exe.
  const exe = s.whisperPath && existsSync(s.whisperPath) ? s.whisperPath : findFile(dir, ['whisper-cli.exe']) ?? findFile(dir, ['main.exe'])
  const model = s.whisperModel && existsSync(s.whisperModel) ? s.whisperModel : join(dir, 'ggml-base.bin')
  return { dir, exe, model: existsSync(model) ? model : null, modelTarget: join(dir, 'ggml-base.bin') }
}

function findFile(dir: string, names: string[]): string | null {
  if (!existsSync(dir)) return null
  for (const e of readdirSync(dir)) {
    const f = join(dir, e)
    if (names.includes(e.toLowerCase())) return f
    if (statSync(f).isDirectory()) {
      const r = findFile(f, names)
      if (r) return r
    }
  }
  return null
}

export function resetToolCache() {
  for (const k of Object.keys(resolved)) delete resolved[k]
}

export async function getStatus(): Promise<Status> {
  const w = whisperPaths()
  return {
    claude: !!(await claudePath()),
    claudeSignedIn: existsSync(join(app.getPath('home'), '.claude', '.credentials.json')) || !!process.env.ANTHROPIC_API_KEY,
    codex: !!(await codexPath()),
    ffmpeg: existsSync(ffmpegPath()),
    whisper: !!(w.exe && w.model),
    ytDlp: !!(await ytDlpPath())
  }
}
