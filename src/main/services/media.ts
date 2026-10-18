import { spawn } from 'child_process'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { ffmpegPath } from './tools'

export interface Run {
  code: number
  stdout: Buffer
  stderr: string
}

export function run(exe: string, args: string[], opts: { cwd?: string; signal?: AbortSignal; onLine?: (line: string) => void } = {}): Promise<Run> {
  return new Promise((resolve, reject) => {
    const p = spawn(exe, args, { cwd: opts.cwd, windowsHide: true, signal: opts.signal })
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

/** Joins the part clips and lays the voiceover on top. */
export async function assemble(clips: string[], audio: string, out: string, opts: { height?: number; fps?: number } = {}, signal?: AbortSignal) {
  const list = join(out + '.txt')
  writeFileSync(list, clips.map((c) => `file '${c.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'))
  const scale = opts.height ? ['-vf', `scale=-2:${opts.height}${opts.fps ? `,fps=${opts.fps}` : ''}`] : []
  const vcodec = opts.height ? ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p'] : ['-c:v', 'copy']
  await ffmpeg(
    ['-f', 'concat', '-safe', '0', '-i', list, '-i', audio, '-map', '0:v', '-map', '1:a', ...scale, ...vcodec, '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out],
    signal
  )
}

/** A short clip of a voiceover range, for a style test. */
export const audioRange = (input: string, from: number, to: number, out: string) =>
  ffmpeg(['-ss', from.toFixed(3), '-to', to.toFixed(3), '-i', input, '-c:a', 'pcm_s16le', out])

export const muxAudio = (video: string, audio: string, out: string) =>
  ffmpeg(['-i', video, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-shortest', out])
