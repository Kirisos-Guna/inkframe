// Changing a made video by hand: split, merge, cut, remove parts; export and putting it together again.
import { copyFileSync, existsSync, rmSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { Comment, Part, Project } from '../../../shared/types'
import { getProject } from '../store'
import { cutAudio } from '../media'
import { bundleProject } from '../render'
import { engineOf, renderAny, scenePath } from '../engines'
import { emit } from './events'
import { reindex, textOf } from './parts'
import { busy, finishingLock } from './control'
import { finish } from './finish'
import { checkFinalVideo } from './finalCheck'

export function splitPart(id: string, partId: string, at: number) {
  const p = getProject(id)!
  busy(p)
  const i = p.parts.findIndex((x) => x.id === partId)
  const a = p.parts[i]
  if (!a) throw new Error('That part is gone.')
  if (a.end - a.start < 1.2) throw new Error('This part is too short to split.')
  // Snap to the nearest word start; each half keeps at least half a second.
  const lo = a.start + 0.5
  const hi = a.end - 0.5
  const snap = p.words.filter((w) => w.start > lo && w.start < hi).sort((x, y) => Math.abs(x.start - at) - Math.abs(y.start - at))[0]?.start ?? Math.min(hi, Math.max(lo, at))
  const b: Part = { ...a, id: randomUUID(), title: `${a.title} (2)`, start: snap, text: textOf(p, snap, a.end), status: 'Not designed yet', locked: false, history: [], thumb: undefined, video: undefined, renderedAt: undefined, checks: undefined }
  Object.assign(a, { end: snap, text: textOf(p, a.start, snap), status: existsSync(scenePath(p, a)) ? 'Designed' : 'Not designed yet' })
  p.parts.splice(i + 1, 0, b)
  reindex(p)
  emit(p, true)
  return p
}

export function mergePart(id: string, partId: string) {
  const p = getProject(id)!
  busy(p)
  const i = p.parts.findIndex((x) => x.id === partId)
  const a = p.parts[i]
  const b = p.parts[i + 1]
  if (!a || !b) return p
  Object.assign(a, { end: b.end, text: textOf(p, a.start, b.end), title: a.title, idea: [a.idea, b.idea].filter(Boolean).join(' Then: '), status: 'Not designed yet', material: [...new Set([...a.material, ...b.material])] })
  p.parts.splice(i + 1, 1)
  reindex(p)
  emit(p, true)
  return p
}

/** Removes stretches of the voiceover; parts and words after them move up. */
export async function cutRanges(id: string, ranges: [number, number][]) {
  const p = getProject(id)!
  busy(p)
  // Sorted, inside the voiceover, and overlapping ranges joined (so nothing is counted twice).
  const total = p.voiceover!.duration
  const merged: [number, number][] = []
  for (const [a, b] of ranges.map(([a, b]) => [Math.max(0, Math.min(a, b)), Math.min(total, Math.max(a, b))] as [number, number]).sort((x, y) => x[0] - y[0])) {
    if (b - a < 0.01) continue
    const last = merged[merged.length - 1]
    if (last && a <= last[1]) last[1] = Math.max(last[1], b)
    else merged.push([a, b])
  }
  ranges = merged
  if (!ranges.length) return p
  const src = p.voiceover!.file
  const out = join(p.dir, 'work', `voiceover-edit-${Date.now()}.wav`)
  await cutAudio(src, ranges, out)
  const shift = (t: number) => {
    let s = 0
    for (const [a, b] of ranges) {
      if (t >= b) s += b - a
      else if (t > a) s += t - a
    }
    return t - s
  }
  const keep = (w: { start: number; end: number }) => !ranges.some(([a, b]) => w.start >= a && w.end <= b + 0.05)
  const moved = <T extends { start: number; end: number }>(w: T) => ({ ...w, start: shift(w.start), end: shift(w.end) })
  p.words = p.words.filter(keep).map(moved)
  // Tidied captions follow the cut too.
  if (p.captionLines?.length) {
    p.captionLines = p.captionLines
      .map((l) => {
        const words = l.words.filter(keep).map(moved)
        return words.length ? { ...l, start: words[0].start, end: words[words.length - 1].end, words, text: words.length === l.words.length ? l.text : words.map((w) => w.w).join(' ') } : null
      })
      .filter((l): l is NonNullable<typeof l> => !!l)
  }
  // The finished video still has the old voiceover.
  p.output = undefined
  const removed = ranges.reduce((s, [a, b]) => s + (b - a), 0)
  for (const x of p.parts) {
    const touched = ranges.some(([a, b]) => a < x.end && b > x.start)
    x.start = shift(x.start)
    x.end = shift(x.end)
    if (touched || x.end - x.start < 0.01) {
      x.text = textOf(p, x.start, x.end)
      if (x.status === 'Up to date') x.status = 'Designed'
    }
  }
  p.parts = p.parts.filter((x) => x.end - x.start > 0.4)
  p.parts.forEach((x, i) => {
    if (i > 0 && Math.abs(x.start - p.parts[i - 1].end) > 0.001) {
      x.start = p.parts[i - 1].end
      if (x.status === 'Up to date') x.status = 'Designed'
    }
  })
  reindex(p)
  p.voiceover = { ...p.voiceover!, file: out, duration: p.voiceover!.duration - removed }
  if (p.parts.length) p.parts[p.parts.length - 1].end = p.voiceover.duration
  emit(p, true)
  return p
}

export async function removeParts(id: string, partIds: string[]) {
  const p = getProject(id)!
  busy(p)
  const gone = p.parts.filter((x) => partIds.includes(x.id))
  const ranges = gone.map((x) => [x.start, x.end] as [number, number])
  const out = await cutRanges(id, ranges)
  for (const x of gone) rmSync(scenePath(p, x), { force: true, recursive: true })
  return out
}

// ---------- export ----------
export async function exportVideo(id: string, opts: { height: number; fps: number }, to: string) {
  const p = getProject(id)!
  busy(p)
  if (!p.parts.length || p.parts.some((x) => !x.video || !existsSync(x.video))) throw new Error('Make the video first: some parts are not rendered yet.')
  if (p.parts.some((x) => x.status !== 'Up to date')) throw new Error('Some parts changed since the video was made. Press Update first, then export.')
  return finishingLock(p, async () => {
    const sameAsParts = opts.height === p.settings.quality.height && opts.fps === p.settings.quality.fps
    if (sameAsParts && p.output && existsSync(p.output)) {
      copyFileSync(p.output, to)
      return to
    }
    let clips = p.parts.map((x) => x.video!)
    if (opts.height > p.settings.quality.height || opts.fps > p.settings.quality.fps) {
      // Draw again at the larger size so lines stay sharp.
      const serveUrl = p.parts.some((x) => engineOf(p, x) === 'remotion') ? await bundleProject(p) : undefined
      clips = []
      for (const x of p.parts) {
        const out = join(p.dir, 'work', `export-${x.id}.mp4`)
        await renderAny(p, x, { serveUrl, height: opts.height, fps: opts.fps, out })
        clips.push(out)
      }
    }
    await finish(p, to, opts, undefined, clips)
    return to
  })
}

/** Builds the final video again from the rendered parts (after changing captions, music or transitions). */
export async function refinish(id: string) {
  const p = getProject(id)!
  busy(p)
  if (!p.parts.length || p.parts.some((x) => !x.video || !existsSync(x.video))) throw new Error('Make the video first.')
  return finishingLock(p, async () => {
    const out = join(p.dir, 'renders', 'video.mp4')
    await finish(p, out, { height: p.settings.quality.height, fps: p.settings.quality.fps })
    p.output = out
    p.outputAt = Date.now()
    if (p.settings.checks !== 'Off') p.finalCheck = await checkFinalVideo(p, out)
    emit(p, true)
    return p
  })
}
