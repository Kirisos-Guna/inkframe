// The last check, on the finished video file itself, with FFmpeg only (no AI, no tokens): black frames, a picture
// that freezes for a long time, sound that is missing or silent, and a length that does not match the voiceover.
import type { Project } from '../../../shared/types'
import { run } from '../media'
import { ffmpegPath } from '../tools'

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** "2:31 (part 17)" for a time in the video. */
const where = (p: Project, t: number) => {
  const x = p.parts.find((y) => t >= y.start && t < y.end) ?? p.parts[p.parts.length - 1]
  return `${fmt(t)}${x ? ` (part ${x.index + 1})` : ''}`
}

/**
 * What FFmpeg reports about a finished video, read from its log (separate from running it, so it can be tested).
 * `pace`: the longest average shot (seconds) the style allows; the cuts are counted when it is given.
 */
export function readFinalLog(log: string, p: Project, pace?: number) {
  const notes: string[] = []
  // Pure black: nothing was drawn (the dark styles are near-black, never 0, so they do not count).
  for (const m of log.matchAll(/black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)/g))
    notes.push(`Black picture for ${(+m[3]).toFixed(1)} s at ${where(p, +m[1])}`)
  // A picture that does not change at all for a long time: a part that stopped moving.
  const starts = [...log.matchAll(/freeze_start: ([\d.]+)/g)].map((m) => +m[1])
  const durs = [...log.matchAll(/freeze_duration: ([\d.]+)/g)].map((m) => +m[1])
  starts.forEach((t, i) => notes.push(`The picture does not move for ${durs[i] ? `${durs[i].toFixed(0)} s` : 'a long time'} from ${where(p, t)}`))
  // Sound.
  const max = log.match(/max_volume: (-?[\d.]+) dB/)
  if (!/Audio:/.test(log)) notes.push('The video has no sound track')
  else if (max && +max[1] < -45) notes.push('The sound is (almost) silent')
  // Length against the voiceover.
  const d = log.match(/Duration: (\d+):(\d+):([\d.]+)/)
  const voice = p.voiceover?.duration ?? 0
  if (d && voice) {
    const len = +d[1] * 3600 + +d[2] * 60 + +d[3]
    if (Math.abs(len - voice) > 0.6) notes.push(`The video is ${len.toFixed(1)} s long, the voiceover ${voice.toFixed(1)} s`)
  }
  // The pace: cuts found by scene detection (showinfo prints one line per cut).
  if (pace && d) {
    const len = +d[1] * 3600 + +d[2] * 60 + +d[3]
    const cuts = (log.match(/Parsed_showinfo[^\n]*pts_time:/g) ?? []).length
    const avg = len / (cuts + 1)
    if (avg > pace + 0.5) notes.push(`A shot lasts ${avg.toFixed(1)} s on average; this style wants a new picture every ${pace} s or so`)
  }
  return notes
}

/** Checks the finished video file. Takes about as long as playing it back fast; costs no tokens. */
export async function checkFinalVideo(p: Project, file: string, signal?: AbortSignal, pace?: number) {
  // Freezes shorter than 8 s are normal holds; black shorter than half a second is a cut.
  const r = await run(
    ffmpegPath(),
    ['-hide_banner', '-i', file, '-vf', `blackdetect=d=0.5:pix_th=0.02,freezedetect=n=0.001:d=8${pace ? ",select='gt(scene,0.25)',showinfo" : ''}`, '-af', 'volumedetect', '-f', 'null', '-'],
    { signal }
  )
  return { at: Date.now(), notes: readFinalLog(r.stderr, p, pace) }
}

/** What a rendered part shows wrong by itself: black stretches and, for the fast styles, shots held too long. */
export interface PartFault {
  kind: 'black' | 'long' | 'fast'
  /** Seconds from the start of the part. */
  at: number
  dur: number
}

/**
 * Reads the FFmpeg log of one rendered part (blackdetect, and scene cuts through showinfo when `longest` is given):
 * black stretches of 0.3 s or more, shots that stay on screen longer than `longest` seconds, and a part that cuts too
 * fast to read (two or more shots under a second).
 */
export function readPartLog(log: string, len: number, longest?: number): PartFault[] {
  const out: PartFault[] = []
  for (const m of log.matchAll(/black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)/g)) out.push({ kind: 'black', at: +m[1], dur: +m[3] })
  if (longest) {
    // Every change of picture with its score (metadata=print): a cut between two dark shots scores as little as 0.1,
    // so any change counts for "held too long"; only clear cuts (0.25 and up) count as flashes.
    const changes = [...log.matchAll(/pts_time:([\d.]+)[^\n]*\r?\n[^\n]*lavfi\.scene_score=([\d.]+)/g)].map((m) => ({ t: +m[1], score: +m[2] }))
    const edges = [0, ...changes.map((c) => c.t), len]
    for (let i = 1; i < edges.length; i++) {
      const dur = edges[i] - edges[i - 1]
      // A black stretch is already reported as black.
      if (dur > longest && !out.some((b) => b.kind === 'black' && b.at < edges[i] && b.at + b.dur > edges[i - 1] && b.dur > dur * 0.5)) out.push({ kind: 'long', at: edges[i - 1], dur })
    }
    // Flashes: a shot under a second cannot be read. One quick punch is fine; two or more is a part cut too fast.
    const clear = [0, ...changes.filter((c) => c.score >= 0.25).map((c) => c.t), len]
    const quick = clear.slice(1).map((e, i) => ({ at: clear[i], dur: e - clear[i] })).filter((x, i, all) => x.dur < 1 && i > 0 && i < all.length - 1)
    if (quick.length >= 2) out.push({ kind: 'fast', at: quick[0].at, dur: quick.length })
  }
  return out
}

/** Looks at one rendered part with FFmpeg (no AI): about a second per part. */
export async function checkPartVideo(file: string, len: number, longest?: number, signal?: AbortSignal) {
  const r = await run(
    ffmpegPath(),
    ['-hide_banner', '-i', file, '-vf', `scale=320:-2,blackdetect=d=0.3:pix_th=0.02${longest ? ",select='gt(scene,0.09)',metadata=print:key=lavfi.scene_score" : ''}`, '-an', '-f', 'null', '-'],
    { signal }
  )
  return readPartLog(r.stderr, len, longest)
}
