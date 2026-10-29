// Drawing a part: the agent's options, writing, checking that a scene builds and draws, repairing it, versions.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { Comment, Part, Project } from '../../../shared/types'
import { getStyle, listCharacters, styleGuide } from '../store'
import { runAgent } from '../agent'
import { bundleProject, fixSceneImports, hfMethodFile, methodFile, syncMaterial, thumbFile } from '../render'
import { checkAny, engineOf, sceneRel, scenePath, stillAny } from '../engines'
import { drawingSystem, repairPrompt, styleDoc, videoContext, type SceneTarget } from '../prompts'
import { emit, setPart, step } from './events'
import { part } from './parts'

export function agentOpts(p: Project, signal: AbortSignal, extra: { onStep?: (s: string) => void } = {}) {
  return { provider: p.settings.provider, model: p.settings.model, effort: p.settings.effort, cwd: p.dir, signal, ...extra }
}

export const target = (p: Project, x: Part): SceneTarget => ({ file: sceneRel(p, x), engine: engineOf(p, x) })

/** The method and style files in the project folder (for people, and for thumbnails), and the drawing instructions. */
export const systems = new Map<string, string>()
export function writeGuides(p: Project) {
  const style = getStyle(p.settings.styleId)
  const doc = styleDoc(style, styleGuide(style.id))
  copyFileSync(methodFile(), join(p.dir, 'METHOD.md'))
  copyFileSync(hfMethodFile(), join(p.dir, 'HYPERFRAMES.md'))
  writeFileSync(join(p.dir, 'STYLE.md'), doc)
  syncMaterial(p)
  // The HTML method only when this video can have HTML parts (decided once per job, so the text stays the same).
  const html = p.settings.engine === 'HyperFrames' || style.engine === 'hyperframes' || p.parts.some((x) => engineOf(p, x) === 'hyperframes')
  // The 3D part of the method only for 3D styles: every drawing session carries the method, so leaving out what a
  // video cannot use saves tokens on each one.
  let method = readFileSync(methodFile(), 'utf8')
  if (style.render !== 'three') method = method.replace(/## Real 3D[\s\S]*?(?=\n## )/, '')
  const chars = listCharacters().filter((c) => p.settings.characterIds.includes(c.id))
  // The video's outline goes with it once there are parts (writeGuides runs again after planning).
  systems.set(p.id, drawingSystem(method, html ? readFileSync(hfMethodFile(), 'utf8') : null, doc, p.parts.length ? videoContext(p, chars) : ''))
}

/** Options for a drawing session: the method and style come along as the (cached) system prompt. */
export function drawOpts(p: Project, signal: AbortSignal, parts: Part[]) {
  return { ...agentOpts(p, signal, { onStep: batchSteps(p, parts) }), system: systems.get(p.id), tools: true }
}

/**
 * Repairs (a scene that does not build or draw) are small mechanical fixes: a quick model does them as well, for a
 * fraction of the tokens. New ideas and the user's changes still use the chosen model.
 */
export function repairOpts(p: Project, signal: AbortSignal, x: Part) {
  const o = drawOpts(p, signal, [x])
  return p.settings.provider === 'Codex' ? { ...o, effort: 'Low' as const } : { ...o, model: 'Sonnet 5.5', effort: 'Low' as const }
}


/** Runs the agent on one scene, then checks it builds and draws. */
export async function agentScene(p: Project, x: Part, prompt: string, note: string, signal: AbortSignal, keepHistory = true) {
  await runAgent({ ...drawOpts(p, signal, [x]), prompt })
  if (!existsSync(scenePath(p, x))) throw new Error(`Part ${x.index + 1}: the scene was not written`)
  await finishScene(p, x, note, signal, keepHistory)
}

/** Checks a written scene builds and draws (repairing it up to twice), keeps a version, marks it designed. */
export async function finishScene(p: Project, x: Part, note: string, signal: AbortSignal, keepHistory = true) {
  const file = scenePath(p, x)
  for (let tries = 0; ; tries++) {
    // Common slips (a kit name used but not imported, no default export) are fixed here, without a repair session.
    if (engineOf(p, x) === 'remotion') fixSceneImports(file)
    const err = (await checkAny(p, x)) ?? (await stillOrError(p, x, signal))
    if (!err) break
    if (signal.aborted) throw new Error('Stopped')
    if (tries >= 2) throw new Error(`Part ${x.index + 1} does not draw: ${err.slice(0, 300)}`)
    step(p, `Repairing part ${x.index + 1}`)
    await runAgent({ ...repairOpts(p, signal, x), prompt: repairPrompt(x, err, target(p, x)) })
  }
  if (keepHistory) {
    const ext = engineOf(p, x) === 'hyperframes' ? 'html' : 'tsx'
    const h = join(p.dir, 'scenes', 'history', `${x.id}-${Date.now()}.${ext}`)
    copyFileSync(file, h)
    const cur = part(p, x.id)!
    cur.history = [...cur.history, { at: Date.now(), note, file: h }]
  }
  setPart(p, x.id, { status: 'Designed', thumb: join(p.dir, 'thumbs', `${x.id}.png`) })
}

/** Turns the agent's file steps into "Drawing part 7" style steps. */
export function batchSteps(p: Project, parts: Part[]) {
  return (s: string) => {
    if (s.startsWith('Drawing ') || s.startsWith('Changing ')) {
      const verb = s.startsWith('Drawing') ? 'Drawing' : 'Changing'
      const x = parts.find((y) => s.includes(y.id)) ?? (parts.length === 1 ? parts[0] : undefined)
      s = x ? `${verb} part ${x.index + 1}` : `${verb} the parts`
    }
    const last = p.job.steps[p.job.steps.length - 1]
    if (last?.label !== s) step(p, s)
  }
}

/** An HTML starter nobody has filled in yet still has the placeholder comment. */
export const isBareStarter = (file: string) => readFileSync(file, 'utf8').includes('<!-- elements: class="clip"')

// Bundling writes one shared entry; do it one at a time.
export let bundleLock: Promise<unknown> = Promise.resolve()
export function stillOrError(p: Project, x: Part, signal?: AbortSignal): Promise<string | null> {
  const job = bundleLock.then(async () => {
    try {
      const url = engineOf(p, x) === 'remotion' ? await bundleProject(p, (s) => step(p, s)) : undefined
      await stillAny(p, x, 0.7, thumbFile(p, x), url, signal, (s) => step(p, s))
      emit(p)
      return null
    } catch (e) {
      return (e as Error).message
    }
  })
  bundleLock = job.catch(() => {})
  return job
}
