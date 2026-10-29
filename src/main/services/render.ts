import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs'
import { createHash } from 'crypto'
import { basename, join } from 'path'
import { build } from 'esbuild'
import { exportsOf, fixImports, LIBRARY_NAMES, type Offered } from './sceneFix'
import type { Part, Project, StyleDef, CharacterDef } from '../../shared/types'
import { getStyle, listCharacters } from './store'
import { handFont, interFont, markerFont } from './hyperframes'

export const appRoot = () => app.getAppPath()
export const kitDir = () => join(appRoot(), 'remotion', 'kit')
export const methodFile = () => join(appRoot(), 'remotion', 'METHOD.md')
export const hfMethodFile = () => join(appRoot(), 'remotion', 'HYPERFRAMES.md')
export const thumbMethodFile = () => join(appRoot(), 'remotion', 'THUMBNAILS.md')

export const sceneFile = (p: Project, part: Part) => join(p.dir, 'scenes', `${part.id}.tsx`)
export const thumbFile = (p: Project, part: Part) => join(p.dir, 'thumbs', `${part.id}.png`)
export const clipFile = (p: Project, part: Part) => join(p.dir, 'renders', `${part.id}.mp4`)

// ANGLE gives Chrome real WebGL for the three.js styles (and is fine for 2D).
const chromiumOptions = { gl: 'angle' as const }

const sizeFor = (h: number) => ({ width: Math.round((h * 16) / 9), height: h })

/** Puts the user's material files in the public folder so scenes can use them. */
export function syncMaterial(p: Project) {
  const pub = join(p.dir, 'public')
  mkdirSync(pub, { recursive: true })
  // The kit loads Inter from here, so clean text looks the same on every PC.
  const inter = join(pub, '_inter.woff2')
  if (!existsSync(inter)) copyFileSync(interFont(), inter)
  const handw = join(pub, '_hand.woff2')
  if (!existsSync(handw)) copyFileSync(handFont(), handw)
  const marker = join(pub, '_marker.woff2')
  if (!existsSync(marker)) copyFileSync(markerFont(), marker)
  for (const m of p.material) {
    const to = join(pub, basename(m))
    if (existsSync(m) && !existsSync(to)) copyFileSync(m, to)
  }
}

/** Fast syntax check of one scene, before the slower full bundle. */
export async function checkScene(file: string): Promise<string | null> {
  try {
    await build({
      entryPoints: [file],
      bundle: true,
      write: false,
      logLevel: 'silent',
      jsx: 'automatic',
      loader: { '.tsx': 'tsx' },
      external: ['react', 'react/*', 'remotion', '@remotion/*', '@kit', '@kit/*', 'three', 'three/*', '@react-three/*']
    })
    return null
  } catch (e) {
    const errs = (e as { errors?: { text: string; location?: { line: number; lineText: string } }[] }).errors ?? []
    return errs.map((x) => `line ${x.location?.line}: ${x.text}\n  ${x.location?.lineText ?? ''}`).join('\n') || String(e)
  }
}

// ---------- small fixes without the agent ----------
// The names each module offers, read from the kit itself (so they never go stale), then React's and Remotion's own.
let offered: Offered | null = null
function moduleExports() {
  const names = (file: string) => exportsOf(readFileSync(join(kitDir(), file), 'utf8'))
  offered ??= [['@kit', names('index.tsx')], ['@kit/three', names('three.tsx')], ['@kit/thumb', names('thumb.tsx')], ['@kit/systems', names('systems.tsx')], ...LIBRARY_NAMES]
  return offered
}

/**
 * Fixes the two slips that most often break a scene, so no repair session is needed for them: a kit (or React or
 * Remotion) name that is used but not imported, and a missing default export. Anything else is left to the repair.
 */
export function fixSceneImports(file: string) {
  if (!existsSync(file)) return
  const src = readFileSync(file, 'utf8')
  const out = fixImports(src, moduleExports())
  if (out !== src) writeFileSync(file, out)
}

// checkScene results, by file and its size and time (a bundle checks every scene, most of them unchanged).
const checked = new Map<string, { key: string; err: string | null }>()
async function checkSceneCached(file: string) {
  const st = statSync(file)
  const key = `${st.size}:${st.mtimeMs}`
  const hit = checked.get(file)
  if (hit?.key === key) return hit.err
  const err = await checkScene(file)
  checked.set(file, { key, err })
  return err
}

/**
 * The React scenes that go in the bundle: the parts and any thumbnails. A scene that does not build (one the agent is
 * still writing, or one waiting for repair) is left out, so it cannot break the bundle for every other part.
 */
async function bundleScenes(p: Project) {
  const dir = join(p.dir, 'scenes')
  const ids: string[] = []
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.tsx') && !f.startsWith('_')).sort())
    if ((await checkSceneCached(join(dir, f))) === null) ids.push(f.replace(/\.tsx$/, ''))
  return ids
}

function writeEntry(p: Project, ids: string[]) {
  const dir = join(p.dir, 'scenes')
  const entry = join(dir, '_entry.tsx')
  writeFileSync(
    entry,
    `import React from 'react'
import { Composition, registerRoot } from 'remotion'
import { makeRoot } from '@kit'
${ids.map((id, i) => `import S${i} from './${id}'`).join('\n')}
const PartRoot = makeRoot({ ${ids.map((id, i) => `'${id}': S${i}`).join(', ')} })
const Root = () => (
  <Composition
    id="Part"
    component={PartRoot as any}
    durationInFrames={60}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={{} as any}
    calculateMetadata={({ props }: any) => ({ durationInFrames: props.frames, fps: props.fps, width: props.width, height: props.height })}
  />
)
registerRoot(Root)
`
  )
  return entry
}

/** A still of any scene in the project (used for thumbnails), at its last frame. */
export async function stillScene(p: Project, serveUrl: string, sceneId: string, out: string, size: { width: number; height: number; frames: number }) {
  const { selectComposition, renderStill } = await import('@remotion/renderer')
  const style = getStyle(p.settings.styleId)
  const inputProps = {
    partId: sceneId,
    frames: size.frames,
    fps: 30,
    width: size.width,
    height: size.height,
    text: p.title,
    words: [],
    style,
    characters: listCharacters().filter((c) => p.settings.characterIds.includes(c.id)),
    material: [...new Set(p.material.map((m) => basename(m)))]
  }
  await withStillBrowser(async (puppeteerInstance) => {
    const composition = await selectComposition({ serveUrl, id: 'Part', inputProps, logLevel: 'error', chromiumOptions, puppeteerInstance })
    await renderStill({ serveUrl, composition, output: out, inputProps, frame: size.frames - 1, logLevel: 'error', chromiumOptions, puppeteerInstance })
  })
  return out
}

let browserReady: Promise<unknown> | null = null
async function ensureBrowser(onStatus?: (s: string) => void) {
  const { ensureBrowser } = await import('@remotion/renderer')
  browserReady ??= ensureBrowser({
    onBrowserDownload: () => {
      onStatus?.('Getting the drawing browser (once)')
      return { version: null, onProgress: ({ percent }) => onStatus?.(`Getting the drawing browser (once) · ${Math.round(percent * 100)}%`) }
    }
  }).catch((e) => {
    browserReady = null
    throw e
  })
  return browserReady
}

// Bundles of one project write the same entry file: one at a time.
const bundling = new Map<string, Promise<unknown>>()

/**
 * Bundles every scene of the project. Returns a serve URL for rendering. `name` gives the bundle its own folder, so
 * a bundle made for something else (thumbnails) never replaces the one a running render is reading.
 */
export function bundleProject(p: Project, onStatus?: (s: string) => void, name = 'bundle', opts: BundleOpts = {}) {
  const job = (bundling.get(p.dir) ?? Promise.resolve()).catch(() => {}).then(() => bundleNow(p, onStatus, name, opts))
  bundling.set(p.dir, job)
  return job
}

interface BundleOpts {
  /** A folder per set of scenes (name-<hash>), so a newer bundle never replaces one a render is still reading. */
  versioned?: boolean
  /** Scenes that must be in the bundle: if one does not build, say why instead of rendering "Missing scene". */
  need?: string[]
}

/** Removes the versioned render bundles of a project (at the start and end of a job). */
export function clearRenderBundles(p: Project) {
  const work = join(p.dir, 'work')
  if (!existsSync(work)) return
  for (const f of readdirSync(work)) if (/^render-[0-9a-f]{8}$/.test(f)) rmSync(join(work, f), { recursive: true, force: true })
  for (const k of lastBundle.keys()) if (k.startsWith(work)) lastBundle.delete(k)
}

// The last bundle of each folder and what went into it: when nothing changed, it is used again as it is.
const lastBundle = new Map<string, { sig: string; url: string; scenes: Map<string, number> }>()

async function bundleNow(p: Project, onStatus: ((s: string) => void) | undefined, name: string, opts: BundleOpts) {
  await ensureBrowser(onStatus)
  syncMaterial(p)
  const ids = await bundleScenes(p)
  for (const id of opts.need ?? []) {
    if (ids.includes(id)) continue
    const f = join(p.dir, 'scenes', `${id}.tsx`)
    throw new Error(existsSync(f) ? (await checkSceneCached(f)) ?? 'The scene does not build' : 'The scene file is missing')
  }
  const pub = join(p.dir, 'public')
  const sig = JSON.stringify([
    ids.map((id) => [id, statSync(join(p.dir, 'scenes', `${id}.tsx`)).mtimeMs]),
    existsSync(pub) ? readdirSync(pub).map((f) => [f, statSync(join(pub, f)).size]) : []
  ])
  const mtimes = new Map(ids.map((id) => [id, statSync(join(p.dir, 'scenes', `${id}.tsx`)).mtimeMs]))
  // A render needs only a bundle that has its own scene as it is now: an earlier one will do, no new bundle needed.
  if (opts.versioned && opts.need?.length)
    for (const [dir, b] of lastBundle)
      if (dir.startsWith(join(p.dir, 'work', `${name}-`)) && existsSync(dir) && opts.need.every((id) => b.scenes.get(id) === mtimes.get(id))) return b.url
  const outDir = join(p.dir, 'work', opts.versioned ? `${name}-${createHash('sha1').update(sig).digest('hex').slice(0, 8)}` : name)
  const last = lastBundle.get(outDir)
  if (last?.sig === sig && existsSync(outDir)) return last.url
  const { bundle } = await import('@remotion/bundler')
  const entry = writeEntry(p, ids)
  const url = await bundle({
    entryPoint: entry,
    publicDir: join(p.dir, 'public'),
    outDir,
    webpackOverride: (c) => ({
      ...c,
      resolve: {
        ...c.resolve,
        alias: { ...(c.resolve?.alias as object), '@kit': kitDir() },
        modules: [join(appRoot(), 'node_modules'), 'node_modules']
      },
      resolveLoader: { ...c.resolveLoader, modules: [join(appRoot(), 'node_modules'), 'node_modules'] }
    })
  })
  lastBundle.set(outDir, { sig, url, scenes: mtimes })
  return url
}

// ---------- one browser for stills ----------
// Each still (review pictures, checks, thumbnails) used to start its own Chrome; one shared browser saves seconds
// per picture. It closes itself after a while without use.
type Browser = Awaited<ReturnType<typeof import('@remotion/renderer')['openBrowser']>>
let stillBrowser: Promise<Browser> | null = null
let idle: NodeJS.Timeout | undefined
function useStillBrowser() {
  clearTimeout(idle)
  idle = setTimeout(closeStillBrowser, 120_000)
  stillBrowser ??= import('@remotion/renderer')
    .then(({ openBrowser }) => openBrowser('chrome', { chromiumOptions, logLevel: 'error' }))
    .catch((e) => {
      stillBrowser = null
      throw e
    })
  return stillBrowser
}
export function closeStillBrowser() {
  clearTimeout(idle)
  const b = stillBrowser
  stillBrowser = null
  b?.then((x) => x.close(true, 'error', false)).catch(() => {})
}
/** Runs a still with the shared browser; if that browser has died, once more with a fresh one. */
async function withStillBrowser<T>(fn: (b: Browser) => Promise<T>) {
  try {
    return await fn(await useStillBrowser())
  } catch (e) {
    // Errors in the scene itself are passed on as they are; only a lost browser is worth a second try.
    if (!/target closed|session closed|connection closed|disconnected|browser has been closed|websocket/i.test(String((e as Error)?.message))) throw e
    closeStillBrowser()
    return fn(await useStillBrowser())
  }
}

export function propsFor(p: Project, part: Part, opts?: { height?: number; fps?: number }) {
  const fps = opts?.fps ?? p.settings.quality.fps
  const { width, height } = sizeFor(opts?.height ?? p.settings.quality.height)
  const style: StyleDef = getStyle(part.styleId ?? p.settings.styleId)
  const characters: CharacterDef[] = listCharacters().filter((c) => p.settings.characterIds.includes(c.id))
  const words = p.words.filter((w) => w.start >= part.start - 0.05 && w.start < part.end).map((w) => ({ w: w.w, start: w.start - part.start, end: w.end - part.start }))
  return {
    partId: part.id,
    frames: Math.max(1, Math.round((part.end - part.start) * fps)),
    fps,
    width,
    height,
    text: part.text,
    words,
    style,
    characters,
    material: part.material.map((m) => basename(m)).concat(p.material.map((m) => basename(m)))
  }
}

export async function stillPart(p: Project, part: Part, serveUrl: string, at = 0.7, out = thumbFile(p, part)) {
  const { selectComposition, renderStill } = await import('@remotion/renderer')
  const inputProps = propsFor(p, part, { height: 540, fps: 30 })
  await withStillBrowser(async (puppeteerInstance) => {
    const composition = await selectComposition({ serveUrl, id: 'Part', inputProps, logLevel: 'error', chromiumOptions, puppeteerInstance })
    const frame = Math.min(composition.durationInFrames - 1, Math.floor(composition.durationInFrames * at))
    await renderStill({ serveUrl, composition, output: out, inputProps, frame, logLevel: 'error', chromiumOptions, puppeteerInstance })
  })
  return out
}

export async function renderPart(
  p: Project,
  part: Part,
  serveUrl: string,
  opts: { height?: number; fps?: number; out?: string; onProgress?: (pct: number) => void; signal?: AbortSignal } = {}
) {
  const { selectComposition, renderMedia, makeCancelSignal } = await import('@remotion/renderer')
  const inputProps = propsFor(p, part, opts)
  const composition = await selectComposition({ serveUrl, id: 'Part', inputProps, logLevel: 'error', chromiumOptions })
  const cancel = makeCancelSignal()
  opts.signal?.addEventListener('abort', () => cancel.cancel(), { once: true })
  const out = opts.out ?? clipFile(p, part)
  await renderMedia({
    serveUrl,
    composition,
    inputProps,
    codec: 'h264',
    outputLocation: out,
    crf: 18,
    pixelFormat: 'yuv420p',
    imageFormat: 'jpeg',
    jpegQuality: 92,
    muted: true,
    cancelSignal: cancel.cancelSignal,
    logLevel: 'error',
    chromiumOptions,
    onProgress: ({ progress }) => opts.onProgress?.(Math.round(progress * 100))
  })
  return out
}
