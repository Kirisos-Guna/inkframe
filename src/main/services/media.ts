import { spawn } from 'child_process'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { ffmpegPath } from './tools'

export interface Run {
  code: number
  stdout: Buffer
  stderr: string
}

export function run(
  exe: string,
  args: string[],
  opts: { cwd?: string; signal?: AbortSignal; onLine?: (line: string) => void; env?: NodeJS.ProcessEnv } = {}
): Promise<Run> {
  return new Promise((resolve, reject) => {
    const p = spawn(exe, args, { cwd: opts.cwd, windowsHide: true, signal: opts.signal, env: opts.env })
    const out: Buffer[] = []
    let err = ''
    let pending = ''
    p.stdout.on('data', (d: Buffer) => {
      out.push(d)
      if (!opts.onLine) return
      pending += d.toString()
      const lines = pending.split(/\r?\n/)
      pending = lines.pop() ?? ''
      lines.forEach(opts.onLine)
    })
    p.stderr.on('data', (d) => (err += d.toString()))
    p.on('error', reject)
    p.on('close', (code) => resolve({ code: code ?? -1, stdout: Buffer.concat(out), stderr: err }))
  })
}

async function ffmpeg(args: string[], signal?: AbortSignal) {
  const r = await run(ffmpegPath(), ['-hide_banner', '-y', ...args], { signal })
  if (r.code !== 0) throw new Error('FFmpeg: ' + r.stderr.split('\n').filter(Boolean).slice(-3).join(' '))
  return r
}

export async function duration(file: string) {
  const r = await run(ffmpegPath(), ['-hide_banner', '-i', file])
  const m = r.stderr.match(/Duration: (\d+):(\d+):(\d+\.\d+)/)
  if (!m) throw new Error('Not an audio or video file')
  return +m[1] * 3600 + +m[2] * 60 + +m[3]
}

const peakCache = new Map<string, number[]>()
/** Loudness peaks for drawing a waveform, 0..1. */
export async function peaks(file: string, n = 600) {
  const key = file + n
  if (peakCache.has(key)) return peakCache.get(key)!
  const r = await ffmpeg(['-i', file, '-ac', '1', '-ar', '4000', '-f', 's16le', 'pipe:1'])
  const buf = r.stdout
  const samples = buf.length / 2
  const per = Math.max(1, Math.floor(samples / n))
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    let max = 0
    for (let j = i * per; j < Math.min(samples, (i + 1) * per); j++) max = Math.max(max, Math.abs(buf.readInt16LE(j * 2)))
    out.push(max / 32768)
  }
  const top = Math.max(0.01, ...out)
  const norm = out.map((v) => Math.min(1, v / top))
  peakCache.set(key, norm)
  return norm
}

export const toWav16k = (input: string, out: string) => ffmpeg(['-i', input, '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', out])

/** Copy of the audio with the given ranges (seconds) removed. */
export async function cutAudio(input: string, ranges: [number, number][], out: string) {
  const expr = ranges.map(([a, b]) => `between(t,${a.toFixed(3)},${b.toFixed(3)})`).join('+')
  await ffmpeg(['-i', input, '-af', `aselect='not(${expr})',asetpts=N/SR/TB`, '-c:a', 'pcm_s16le', out])
}

/** Evenly spaced frames from a video, as JPGs. */
export async function frames(video: string, outDir: string, count: number, signal?: AbortSignal) {
  const d = await duration(video)
  const files: string[] = []
  for (let i = 0; i < count; i++) {
    const t = (d * (i + 0.5)) / count
    const f = join(outDir, `frame-${String(i + 1).padStart(2, '0')}.jpg`)
    await ffmpeg(['-ss', t.toFixed(2), '-i', video, '-frames:v', '1', '-vf', 'scale=960:-2', '-q:v', '3', f], signal)
    files.push(f)
  }
  return { files, duration: d }
}

/** Number of hard cuts per minute, measured with FFmpeg's scene detection. */
export async function cutsPerMinute(video: string, signal?: AbortSignal) {
  const d = await duration(video)
  const r = await run(ffmpegPath(), ['-hide_banner', '-i', video, '-vf', "select='gt(scene,0.35)',showinfo", '-an', '-f', 'null', '-'], { signal })
  const cuts = (r.stderr.match(/pts_time:/g) ?? []).length
  return d ? (cuts / d) * 60 : 0
}

/** A short clip of a voiceover range, for a style test. */
export const audioRange = (input: string, from: number, to: number, out: string) =>
  ffmpeg(['-ss', from.toFixed(3), '-to', to.toFixed(3), '-i', input, '-c:a', 'pcm_s16le', out])

export const muxAudio = (video: string, audio: string, out: string) =>
  ffmpeg(['-i', video, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-shortest', out])

const XFADE: Record<string, string> = { Fade: 'fade', Flash: 'fadewhite', Wipe: 'wipeleft', Slide: 'slideleft', Zoom: 'zoomin' }

/**
 * Builds the final video in one FFmpeg pass: every part scaled to the same size and frame rate, an optional
 * transition between parts (each part keeps its exact place against the voice: the outgoing part holds its last
 * frame while the next one comes in), optional burned-in captions (an .ass file in `workDir`), and optional music
 * that ducks under the voice.
 */
export async function finishVideo(o: {
  clips: { file: string; dur: number }[]
  voice: string
  out: string
  workDir: string
  height: number
  fps: number
  transition?: string
  /** drawtext filters for burned-in captions (see captions.ts). */
  captions?: string[]
  music?: { file: string; volume: number } | null
  /** The sound-effects track (see sfx.ts), already timed to the whole video. */
  sfx?: { file: string; volume: number } | null
  signal?: AbortSignal
}) {
  const W = Math.round((o.height * 16) / 9 / 2) * 2
  const H = o.height
  const T = o.transition && XFADE[o.transition] && o.clips.length > 1 ? 0.4 : 0
  const n = o.clips.length
  const lines: string[] = []
  o.clips.forEach((c, i) => {
    const pad = T && i < n - 1 ? `,tpad=stop_mode=clone:stop_duration=${T}` : ''
    lines.push(
      `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,fps=${o.fps},format=yuv420p,setsar=1,` +
        `tpad=stop_mode=clone:stop_duration=1,trim=duration=${c.dur.toFixed(4)},setpts=PTS-STARTPTS${pad}[v${i}]`
    )
  })
  let last = 'v0'
  if (n > 1 && T) {
    let acc = o.clips[0].dur + T
    for (let i = 1; i < n; i++) {
      const len = o.clips[i].dur + (i < n - 1 ? T : 0)
      const offset = acc - T
      lines.push(`[${last}][v${i}]xfade=transition=${XFADE[o.transition!]}:duration=${T}:offset=${offset.toFixed(4)}[x${i}]`)
      last = `x${i}`
      acc = offset + len
    }
  } else if (n > 1) {
    lines.push(`${o.clips.map((_, i) => `[v${i}]`).join('')}concat=n=${n}:v=1:a=0[cat]`)
    last = 'cat'
  }
  if (o.captions?.length) {
    lines.push(`[${last}]${o.captions.join(",")}[cap]`)
    last = 'cap'
  }
  // Audio: the voice, plus music that ducks hard under it and sound effects that dip a little when it speaks.
  const vi = n
  const mi = o.music ? n + 1 : -1
  const si = o.sfx ? n + 1 + (o.music ? 1 : 0) : -1
  const extra = (o.music ? 1 : 0) + (o.sfx ? 1 : 0)
  if (extra) {
    const sides = ['side0', 'side1'].slice(0, extra)
    lines.push(`[${vi}:a]asplit=${extra + 1}[voice]${sides.map((s) => `[${s}]`).join('')}`)
    const mixIn = ['[voice]']
    let side = 0
    if (o.music) {
      lines.push(`[${mi}:a]volume=${o.music.volume.toFixed(2)}[mus]`)
      lines.push(`[mus][${sides[side++]}]sidechaincompress=threshold=0.03:ratio=10:attack=15:release=400[duck]`)
      mixIn.push('[duck]')
    }
    if (o.sfx) {
      lines.push(`[${si}:a]aresample=48000,volume=${o.sfx.volume.toFixed(2)}[fx]`)
      lines.push(`[fx][${sides[side++]}]sidechaincompress=threshold=0.05:ratio=3:attack=10:release=250[fxd]`)
      mixIn.push('[fxd]')
    }
    lines.push(`${mixIn.join('')}amix=inputs=${mixIn.length}:duration=first:normalize=0[aout]`)
  } else lines.push(`[${vi}:a]anull[aout]`)
  const script = join(o.workDir, 'finish.filter')
  writeFileSync(script, lines.join(';\n'))
  const total = o.clips.reduce((s, c) => s + c.dur, 0)
  const args = ['-hide_banner', '-y']
  // Every part is open at once: with many parts, fewer decoder threads each keeps memory in check.
  for (const c of o.clips) args.push(...(n > 16 ? ['-threads', '2'] : []), '-i', c.file)
  args.push('-i', o.voice)
  if (o.music) args.push('-stream_loop', '-1', '-i', o.music.file)
  if (o.sfx) args.push('-i', o.sfx.file)
  args.push(
    '-filter_complex_script', 'finish.filter',
    '-map', `[${last}]`, '-map', '[aout]',
    '-t', total.toFixed(3),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(o.fps),
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', o.out
  )
  // Run inside workDir so the filter script and captions file are plain relative names (no Windows path escaping).
  const r = await run(ffmpegPath(), args, { cwd: o.workDir, signal: o.signal })
  if (r.code !== 0) throw new Error('FFmpeg: ' + r.stderr.split('\n').filter(Boolean).slice(-4).join(' '))
  return o.out
}

/** Three stills side by side in one small JPG (one picture for the checker instead of three). */
export async function stripImage(files: string[], out: string) {
  const args: string[] = []
  for (const f of files) args.push('-i', f)
  const scaled = files.map((_, i) => `[${i}:v]scale=480:270[s${i}]`).join(';')
  await ffmpeg([...args, '-filter_complex', `${scaled};${files.map((_, i) => `[s${i}]`).join('')}hstack=inputs=${files.length}`, '-frames:v', '1', '-q:v', '4', out])
  return out
}
