// HyperFrames: renders HTML + GSAP scenes to video. We run its CLI with the app's own runtime
// (Electron as Node 22) and the bundled ffmpeg/ffprobe, with its telemetry turned off.
import { createRequire } from 'module'
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'fs'
import { basename, dirname, join } from 'path'
import ffprobeStatic from 'ffprobe-static'
import { ffmpegPath } from './tools'
import { run } from './media'

const req = createRequire(__filename)
const unpacked = (p: string) => p.replace('app.asar', 'app.asar.unpacked')

export const hfCli = () => join(dirname(req.resolve('hyperframes/package.json')), 'bin', 'hyperframes.mjs')
export const gsapFile = () => join(dirname(req.resolve('gsap/package.json')), 'dist', 'gsap.min.js')
export const interFont = () => join(dirname(req.resolve('@fontsource-variable/inter/package.json')), 'files', 'inter-latin-wght-normal.woff2')
/** Caveat: natural handwriting for the hand-drawn styles (SIL Open Font Licence). */
/** Permanent Marker: bold marker lettering for the marker styles (Apache 2.0). */
export const markerFont = () => join(dirname(req.resolve('@fontsource/permanent-marker/package.json')), 'files', 'permanent-marker-latin-400-normal.woff2')
/** Baloo Thambi 2: bold Tamil lettering for every style (SIL Open Font Licence). */
export const tamilFont = () => join(dirname(req.resolve('@fontsource/baloo-thambi-2/package.json')), 'files', 'baloo-thambi-2-tamil-700-normal.woff2')
export const handFont = () => join(dirname(req.resolve('@fontsource/caveat/package.json')), 'files', 'caveat-latin-600-normal.woff2')
const ffprobePath = () => unpacked((ffprobeStatic as { path: string }).path)

function env() {
  const sep = process.platform === 'win32' ? ';' : ':'
  return {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    HYPERFRAMES_NO_TELEMETRY: '1',
    DO_NOT_TRACK: '1',
    FORCE_COLOR: '0',
    NO_COLOR: '1',
    PATH: [dirname(ffmpegPath()), dirname(ffprobePath()), process.env.PATH].join(sep)
  }
}

export function hf(args: string[], opts: { cwd?: string; signal?: AbortSignal; onLine?: (l: string) => void } = {}) {
  return run(process.execPath, [hfCli(), ...args], { ...opts, env: env() })
}

const clean = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '').trim()
const tail = (s: string, n = 6) => clean(s).split('\n').filter(Boolean).slice(-n).join('\n')

let browser: Promise<void> | null = null
/** Downloads HyperFrames' headless Chrome the first time. */
export function ensureHfBrowser(onStatus?: (s: string) => void) {
  browser ??= (async () => {
    onStatus?.('Getting the HTML renderer (once)')
    const r = await hf(['browser', 'ensure'])
    if (r.code !== 0) throw new Error('Could not get the HTML renderer: ' + tail(r.stderr || r.stdout.toString()))
  })().catch((e) => {
    browser = null
    throw e
  })
  return browser
}

/** Puts GSAP, the fonts and the project's material next to a scene so it renders offline. */
export function prepareHfScene(sceneDir: string, publicDir: string) {
  mkdirSync(join(sceneDir, 'assets'), { recursive: true })
  // Copied only when missing or changed: this runs before every check and render, and material can be large.
  const put = (from: string, to: string) => {
    if (!statSync(from).isFile()) return
    if (!existsSync(to) || statSync(to).size !== statSync(from).size) copyFileSync(from, to)
  }
  put(gsapFile(), join(sceneDir, 'gsap.min.js'))
  put(join(dirname(gsapFile()), 'DrawSVGPlugin.min.js'), join(sceneDir, 'DrawSVGPlugin.min.js'))
  // Inter for clean text, Caveat for handwriting.
  put(interFont(), join(sceneDir, 'assets', 'inter.woff2'))
  put(handFont(), join(sceneDir, 'assets', 'hand.woff2'))
  put(markerFont(), join(sceneDir, 'assets', 'marker.woff2'))
  put(tamilFont(), join(sceneDir, 'assets', 'tamil.woff2'))
  if (existsSync(publicDir)) for (const f of readdirSync(publicDir)) put(join(publicDir, f), join(sceneDir, 'assets', f))
}

/** Lint errors that stop a scene from rendering correctly, or null. */
export async function lintHf(sceneDir: string): Promise<string | null> {
  const r = await hf(['lint', sceneDir, '--json'])
  try {
    const out = JSON.parse(r.stdout.toString()) as { findings?: { severity: string; line?: number; code: string; message: string }[] }
    const errors = (out.findings ?? []).filter((f) => f.severity === 'error')
    return errors.length ? errors.map((e) => `line ${e.line ?? '?'}: ${e.code}: ${e.message}`).join('\n') : null
  } catch {
    return r.code === 0 ? null : tail(r.stderr || r.stdout.toString())
  }
}

/** A still frame at `at` seconds, written to `out` (PNG). */
export async function stillHf(sceneDir: string, at: number, out: string, signal?: AbortSignal) {
  const tmp = join(dirname(out), `.snap-${basename(out, '.png')}`)
  rmSync(tmp, { recursive: true, force: true })
  const r = await hf(['snapshot', sceneDir, '--at', at.toFixed(2), '--no-end', '-o', tmp], { signal })
  const png = existsSync(tmp) ? readdirSync(tmp).find((f) => f.endsWith('.png')) : undefined
  if (!png) throw new Error('The HTML scene did not draw: ' + tail(r.stderr || r.stdout.toString()))
  rmSync(out, { force: true })
  renameSync(join(tmp, png), out)
  rmSync(tmp, { recursive: true, force: true })
  return out
}

export async function renderHf(
  sceneDir: string,
  out: string,
  opts: { fps: number; height: number; signal?: AbortSignal; onProgress?: (pct: number) => void }
) {
  const args = ['render', sceneDir, '-o', out, '-f', String(opts.fps), '--quality', 'delivery']
  if (opts.height >= 2160) args.push('--resolution', 'landscape-4k')
  const r = await hf(args, {
    signal: opts.signal,
    onLine: (l) => {
      const m = clean(l).match(/(\d{1,3})%/)
      if (m) opts.onProgress?.(Math.min(100, +m[1]))
    }
  })
  if (r.code !== 0 || !existsSync(out)) throw new Error('The HTML scene did not render: ' + tail(r.stderr || r.stdout.toString(), 8))
  return out
}
