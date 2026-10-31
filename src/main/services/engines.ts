// One place that knows how each engine stores, checks, previews and renders a part.
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { Engine, Part, Project } from '../../shared/types'
import { getStyle } from './store'
import { checkScene, clipFile, renderPart, sceneFile, stillPart } from './render'
import { ensureHfBrowser, lintHf, prepareHfScene, renderHf, stillHf } from './hyperframes'

export function engineOf(p: Project, x: Part): Engine {
  if (x.engine) return x.engine
  if (p.settings.engine === 'HyperFrames') return 'hyperframes'
  if (p.settings.engine === 'Remotion') return 'remotion'
  return getStyle(x.styleId ?? p.settings.styleId).engine ?? 'remotion'
}

export const hfDir = (p: Project, x: Part) => join(p.dir, 'scenes', x.id)
/** The file the agent writes for this part. */
export const scenePath = (p: Project, x: Part) => (engineOf(p, x) === 'hyperframes' ? join(hfDir(p, x), 'index.html') : sceneFile(p, x))
/** Path relative to the project folder, as the agent sees it. */
export const sceneRel = (p: Project, x: Part) => (engineOf(p, x) === 'hyperframes' ? `scenes/${x.id}/index.html` : `scenes/${x.id}.tsx`)

/** Writes the HTML starter for a HyperFrames part (size, length, colours, fonts, an empty timeline). */
export function writeHfStarter(p: Project, x: Part, force = false) {
  const dir = hfDir(p, x)
  mkdirSync(dir, { recursive: true })
  prepareHfScene(dir, join(p.dir, 'public'))
  const file = join(dir, 'index.html')
  if (existsSync(file) && !force) return
  const st = getStyle(x.styleId ?? p.settings.styleId)
  const dur = Math.max(0.5, x.end - x.start).toFixed(2)
  writeFileSync(
    file,
    `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @font-face { font-family: 'Inter'; src: url('assets/inter.woff2') format('woff2'); font-weight: 100 900; }
  @font-face { font-family: 'Hand'; src: url('assets/hand.woff2') format('woff2'); }
  @font-face { font-family: 'Marker'; src: url('assets/marker.woff2') format('woff2'); }
  @font-face { font-family: 'Tamil'; src: url('assets/tamil.woff2') format('woff2'); }
  html, body { margin: 0; background: ${st.palette.bg}; }
  #root { position: relative; width: 1920px; height: 1080px; overflow: hidden; background: ${st.palette.bg}; color: ${st.palette.ink}; font-family: ${st.font === 'marker' ? "'Marker', " : ''}'Hand', 'Inter', 'Tamil'; }
  .clip { position: absolute; }
  :root { --bg: ${st.palette.bg}; --ink: ${st.palette.ink}; --accent: ${st.palette.accent}; --paper: ${st.palette.paper ?? st.palette.bg}; }
  /* Part ${x.index + 1}: "${x.title.replace(/\*\//g, '')}" (${dur} s) */
</style>
</head>
<body>
<div id="root" data-composition-id="root" data-width="1920" data-height="1080" data-duration="${dur}">
  <!-- elements: class="clip" data-start="0" data-duration="${dur}" -->
</div>
<script src="gsap.min.js"></script>
<script src="DrawSVGPlugin.min.js"></script>
<script>
  gsap.registerPlugin(DrawSVGPlugin);
  const tl = gsap.timeline({ paused: true });
  // tl.to('#id', { opacity: 1, duration: 0.5 }, seconds);
  window.__timelines = window.__timelines || {};
  window.__timelines['root'] = tl;
</script>
</body>
</html>
`
  )
}

/** A quick check that the scene builds (syntax for React, lint for HTML). */
export async function checkAny(p: Project, x: Part) {
  if (engineOf(p, x) === 'hyperframes') {
    prepareHfScene(hfDir(p, x), join(p.dir, 'public'))
    return lintHf(hfDir(p, x))
  }
  return checkScene(sceneFile(p, x))
}

/** A still at a fraction of the part. Remotion needs a bundle URL. */
export async function stillAny(p: Project, x: Part, at: number, out: string, serveUrl?: string, signal?: AbortSignal, onStatus?: (s: string) => void) {
  if (engineOf(p, x) === 'hyperframes') {
    await ensureHfBrowser(onStatus)
    return stillHf(hfDir(p, x), Math.max(0, Math.min(0.99, at)) * (x.end - x.start), out, signal)
  }
  if (!serveUrl) throw new Error('No bundle for the Remotion part')
  return stillPart(p, x, serveUrl, at, out)
}

export async function renderAny(
  p: Project,
  x: Part,
  opts: { serveUrl?: string; height?: number; fps?: number; out?: string; signal?: AbortSignal; onStatus?: (s: string) => void }
) {
  const out = opts.out ?? clipFile(p, x)
  if (engineOf(p, x) === 'hyperframes') {
    await ensureHfBrowser(opts.onStatus)
    prepareHfScene(hfDir(p, x), join(p.dir, 'public'))
    return renderHf(hfDir(p, x), out, { fps: opts.fps ?? p.settings.quality.fps, height: opts.height ?? p.settings.quality.height, signal: opts.signal })
  }
  if (!opts.serveUrl) throw new Error('No bundle for the Remotion part')
  return renderPart(p, x, opts.serveUrl, { ...opts, out })
}
