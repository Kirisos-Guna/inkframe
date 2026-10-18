import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { basename, join } from 'path'
import { build } from 'esbuild'
import type { Part, Project, StyleDef, CharacterDef } from '../../shared/types'
import { getStyle, listCharacters } from './store'

export const appRoot = () => app.getAppPath()
export const kitDir = () => join(appRoot(), 'remotion', 'kit')
export const methodFile = () => join(appRoot(), 'remotion', 'METHOD.md')

export const sceneFile = (p: Project, part: Part) => join(p.dir, 'scenes', `${part.id}.tsx`)
export const thumbFile = (p: Project, part: Part) => join(p.dir, 'thumbs', `${part.id}.png`)
export const clipFile = (p: Project, part: Part) => join(p.dir, 'renders', `${part.id}.mp4`)

const sizeFor = (h: number) => ({ width: Math.round((h * 16) / 9), height: h })

/** Puts the user's material files in the public folder so scenes can use them. */
export function syncMaterial(p: Project) {
  const pub = join(p.dir, 'public')
  mkdirSync(pub, { recursive: true })
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
      external: ['react', 'react/*', 'remotion', '@remotion/*', '@kit']
    })
    return null
  } catch (e) {
    const errs = (e as { errors?: { text: string; location?: { line: number; lineText: string } }[] }).errors ?? []
    return errs.map((x) => `line ${x.location?.line}: ${x.text}\n  ${x.location?.lineText ?? ''}`).join('\n') || String(e)
  }
}

function writeEntry(p: Project) {
  const parts = p.parts.filter((x) => existsSync(sceneFile(p, x)))
  const entry = join(p.dir, 'scenes', '_entry.tsx')
  writeFileSync(
    entry,
    `import React from 'react'
import { Composition, registerRoot } from 'remotion'
import { makeRoot } from '@kit'
${parts.map((x, i) => `import S${i} from './${x.id}'`).join('\n')}
const PartRoot = makeRoot({ ${parts.map((x, i) => `'${x.id}': S${i}`).join(', ')} })
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

/** Bundles every scene of the project. Returns a serve URL for rendering. */
export async function bundleProject(p: Project, onStatus?: (s: string) => void) {
  await ensureBrowser(onStatus)
  syncMaterial(p)
  const { bundle } = await import('@remotion/bundler')
  const entry = writeEntry(p)
  return bundle({
    entryPoint: entry,
    publicDir: join(p.dir, 'public'),
    outDir: join(p.dir, 'work', 'bundle'),
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
  const composition = await selectComposition({ serveUrl, id: 'Part', inputProps, logLevel: 'error' })
  await renderStill({ serveUrl, composition, output: out, inputProps, frame: Math.min(composition.durationInFrames - 1, Math.floor(composition.durationInFrames * at)), logLevel: 'error' })
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
  const composition = await selectComposition({ serveUrl, id: 'Part', inputProps, logLevel: 'error' })
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
    onProgress: ({ progress }) => opts.onProgress?.(Math.round(progress * 100))
  })
  return out
}
