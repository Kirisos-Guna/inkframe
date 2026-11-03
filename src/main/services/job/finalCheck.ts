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
