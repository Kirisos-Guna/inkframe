// Sound effects: found from the scenes themselves and made on this computer. No AI, no downloads, no licences.
//
// 1. Cues: each React scene is rendered in Node with a stand-in kit (remotion/kit/cues) that notes when things pop,
//    move, are drawn, typed or counted. HTML scenes are read from their GSAP timeline.
// 2. Sounds: pops, whooshes, pen scratches, key clicks and ticks are synthesised from scratch, a little different
//    each time (seeded), so nothing sounds looped.
// 3. One track: every sound at its exact time, written as a WAV the finishing pass mixes under the voice.
import { spawn } from 'child_process'
import { existsSync, readFileSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'
import { createRequire } from 'module'
import { build } from 'esbuild'
import type { Part, Project, SfxLevel } from '../../shared/types'
import { appRoot, kitDir, propsFor } from './render'
import { engineOf, scenePath } from './engines'
import { ffmpegPath } from './tools'

type CueKind = 'pop' | 'whoosh' | 'pen' | 'typing' | 'count' | 'boom' | 'scratch' | 'whip'
interface Cue {
  kind: CueKind
  at: number
  dur?: number
  strength?: number
}

const RATE = 48000

// ---------- cues ----------
const cueCache = new Map<string, { key: string; cues: Cue[] }>()

/** Cues of one React scene, in frames of the part (at the video's frame rate). */
async function reactCues(p: Project, x: Part): Promise<Cue[]> {
  const file = scenePath(p, x)
  const cues = join(kitDir(), 'cues')
  const posix = (f: string) => f.replace(/\\/g, '/')
  const r = await build({
    stdin: { contents: `import Scene from '${posix(file)}'\nexport { Scene }\nexport { run } from '${posix(join(cues, 'run.tsx'))}'`, resolveDir: join(p.dir, 'scenes'), loader: 'tsx' },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    jsx: 'automatic',
    logLevel: 'silent',
    loader: { '.tsx': 'tsx', '.ts': 'ts' },
    alias: {
      '@kit': join(cues, 'kit.tsx'),
      '@kit/three': join(cues, 'three.tsx'),
      '@kit/thumb': join(cues, 'kit.tsx'),
      '@kit/systems': join(cues, 'systems.tsx'),
      '@kit/remix': join(cues, 'remix.tsx'),
      remotion: join(cues, 'remotion.tsx'),
      '@react-three/fiber': join(cues, 'fiber.tsx')
    },
    external: ['react', 'react/*', 'react-dom', 'react-dom/*', 'remotion-real', 'three', 'three/*', 'roughjs', 'roughjs/*', '@remotion/*']
  })
  const req = createRequire(join(appRoot(), 'package.json'))
  const mod = { exports: {} as { Scene?: unknown; run?: (s: unknown, props: unknown) => Cue[] } }
  new Function('require', 'module', 'exports', r.outputFiles[0].text)((id: string) => req(id === 'remotion-real' ? 'remotion' : id), mod, mod.exports)
  if (!mod.exports.Scene || !mod.exports.run) return []
  return mod.exports.run(mod.exports.Scene, propsFor(p, x))
}

/** Cues of one HTML scene, from its GSAP calls: tl.to('#id', { ... }, seconds). */
function htmlCues(p: Project, x: Part): Cue[] {
  const fps = p.settings.quality.fps
  const html = readFileSync(scenePath(p, x), 'utf8')
  const out: Cue[] = []
  for (const m of html.matchAll(/tl\.(to|from|fromTo)\(\s*['"][^'"]+['"]\s*,\s*(\{[^}]*\})(?:\s*,\s*(\{[^}]*\}))?\s*,\s*([\d.]+)\s*\)/g)) {
    const vars = (m[3] ?? m[2]) + m[2]
    const at = Math.round(+m[4] * fps)
    const dur = Math.round(Number(vars.match(/duration\s*:\s*([\d.]+)/)?.[1] ?? 0.5) * fps)
    if (/drawSVG/.test(vars)) out.push({ kind: 'pen', at, dur })
    else if (/scale/.test(vars)) out.push({ kind: 'pop', at })
    else if (/\b(x|y|left|top|xPercent|yPercent)\s*:/.test(vars)) out.push({ kind: 'whoosh', at, dur, strength: 0.7 })
    else if (/text\s*:|innerText/.test(vars)) out.push({ kind: 'typing', at, dur })
  }
  return out
}

/** Cues of a part (cached until its scene changes). A scene the stand-in cannot read just gets no sounds. */
async function partCues(p: Project, x: Part) {
  const file = scenePath(p, x)
  if (!existsSync(file)) return []
  const key = `${statSync(file).mtimeMs}:${x.end - x.start}:${p.settings.quality.fps}:${p.words.length}`
  const hit = cueCache.get(x.id)
  if (hit?.key === key) return hit.cues
  let cues: Cue[] = []
  try {
    cues = engineOf(p, x) === 'hyperframes' ? htmlCues(p, x) : await reactCues(p, x)
  } catch (e) {
    console.warn(`Sound cues for part ${x.index + 1} skipped:`, (e as Error).message.split('\n')[0])
  }
  cueCache.set(x.id, { key, cues })
  return cues
}

// ---------- checking against the picture ----------
const motionCache = new Map<string, { key: string; m: { t: number; v: number }[] }>()

/** How much the picture changes at every frame of a rendered part (FFmpeg's scene score, on a small copy). */
async function motionOf(video: string) {
  const key = `${statSync(video).mtimeMs}`
  const hit = motionCache.get(video)
  if (hit?.key === key) return hit.m
  const out = await new Promise<string>((resolve) => {
    let s = ''
    const ff = spawn(ffmpegPath(), ['-v', 'error', '-i', video, '-an', '-vf', "scale=192:-2,select='gte(scene,0)',metadata=print:key=lavfi.scene_score:file=-", '-f', 'null', '-'])
    ff.stdout.on('data', (d) => (s += d))
    ff.on('close', () => resolve(s))
    ff.on('error', () => resolve(''))
  })
  const m: { t: number; v: number }[] = []
  for (const x of out.matchAll(/pts_time:([\d.]+)\s+lavfi\.scene_score=([\d.]+)/g)) m.push({ t: +x[1], v: +x[2] })
  motionCache.set(video, { key, m })
  return m
}

/**
 * Keeps the sounds the picture agrees with, at the frame it moves: a cue with nothing changing on screen near it is
 * dropped, the rest are moved to the first frame that changes. Moves and cuts the scene code did not say (motion
 * written by hand) get a whoosh. Times are seconds in the part.
 */
export function matchPicture(cues: { kind: CueKind; t: number; len: number; strength: number }[], m: { t: number; v: number }[]) {
  if (m.length < 10) return cues
  // "Moving" is measured against this video's own stillness (encoder noise on a still frame is about 0.00002; a pen
  // stroke 0.0001 to 0.0005; a slide 0.01 and up; a cut 0.3 and up). A stroke can skip frames, so a few frames count
  // together.
  const sorted = m.map((x) => x.v).sort((a, b) => a - b)
  const still = sorted[Math.floor(sorted.length * 0.25)]
  const live = Math.max(0.00008, still * 4)
  const near = m.map((_, i) => Math.max(...m.slice(Math.max(0, i - 2), i + 3).map((x) => x.v)))
  const step = m[1].t - m[0].t || 1 / 30
  const out: typeof cues = []
  for (const c of cues) {
    if (c.kind === 'pen' || c.kind === 'typing') {
      // A drawing or typing sound only while the picture is really being drawn, from its first stroke.
      const span = Math.max(c.len, 0.2)
      const idx = m.flatMap((x, i) => (x.t >= c.t - 0.05 && x.t <= c.t + span && near[i] > live ? [i] : []))
      if (idx.length < Math.max(2, (span / step) * 0.3)) continue
      const first = idx.find((i) => m[i].v > live) ?? idx[0]
      out.push({ ...c, t: m[first].t, len: Math.min(span, m[idx[idx.length - 1]].t - m[first].t + step) })
      continue
    }
    // A pop or a whoosh lands on the first frame that changes; nothing changing means nothing to hear.
    const hit = m.find((x) => x.t >= c.t - 0.06 && x.t <= c.t + 0.25 && x.v > live)
    if (hit) out.push({ ...c, t: hit.t })
  }
  // Clear moves (a slide, a zoom, a cut) that no cue covers: one sound per move.
  const big = Math.max(0.006, still * 100)
  let lastMove = -1
  for (let i = 1; i < m.length; i++) {
    if (m[i].v < big || m[i - 1].v >= big || m[i].t - lastMove < 0.6) continue
    lastMove = m[i].t
    let peak = m[i].v
    for (let j = i; j < m.length && m[j].t < m[i].t + 0.4; j++) peak = Math.max(peak, m[j].v)
    // A pen or typing sound under a big move does not count: the move gets its own sound.
    if (out.some((c) => c.kind !== 'pen' && c.kind !== 'typing' && Math.abs(c.t - m[i].t) < 0.3)) continue
    out.push({ kind: peak > 0.25 ? 'whip' : 'whoosh', t: m[i].t, len: 0.4, strength: Math.min(0.9, 0.45 + peak * 6) })
  }
  return out.sort((a, b) => a.t - b.t)
}

// ---------- choosing ----------
interface Placed {
  kind: CueKind
  t: number // seconds in the video
  len: number // seconds
  gain: number
  seed: number
}

// The editing moves' sounds win over the rest: a boom or a scratch is the joke landing.
const PRIORITY: Record<CueKind, number> = { boom: 8, scratch: 8, whip: 6, pop: 5, whoosh: 4, count: 3, typing: 2, pen: 1 }

/**
 * Picks the sounds: Subtle keeps the big moments (reveals, moves, counters, typing) with room between them; Lively
 * also scratches the pen while things are drawn. A busy moment never gets a pile of sounds at once.
 */
function choose(all: Placed[], level: Exclude<SfxLevel, 'Off'>) {
  const gap = level === 'Lively' ? 0.22 : 0.5
  const point = all.filter((c) => c.kind !== 'pen').sort((a, b) => PRIORITY[b.kind] - PRIORITY[a.kind] || a.t - b.t)
  const kept: Placed[] = []
  for (const c of point) if (!kept.some((k) => Math.abs(k.t - c.t) < gap)) kept.push(c)
  // Pen strokes that overlap become one scratch. Lively hears every stroke (up to 2.5 s at a time); Subtle only the
  // real drawings (0.35 s or longer), quieter and shorter, and not on top of another sound.
  const pens = all.filter((c) => c.kind === 'pen' && c.len >= 0.25).sort((a, b) => a.t - b.t)
  const merged: Placed[] = []
  for (const c of pens) {
    const last = merged[merged.length - 1]
    if (last && c.t <= last.t + last.len + 0.08) last.len = Math.max(last.len, c.t + c.len - last.t)
    else merged.push({ ...c })
  }
  for (const m of merged) {
    if (level === 'Lively') kept.push({ ...m, len: Math.min(2.5, m.len) })
    else if (m.len >= 0.35 && !kept.some((k) => k.kind !== 'pen' && Math.abs(k.t - m.t) < gap)) kept.push({ ...m, len: Math.min(1.5, m.len), gain: m.gain * 0.6 })
  }
  return kept.sort((a, b) => a.t - b.t)
}

// ---------- sounds ----------
/** Small seeded random numbers, so a sound is the same every time the video is built. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A band-pass filter whose centre can move (for whooshes and scratches). */
function bandpass() {
  let z1 = 0
  let z2 = 0
  // RBJ band-pass (0 dB peak), transposed direct form II.
  return (x: number, freq: number, q: number) => {
    const w = (2 * Math.PI * Math.min(freq, RATE * 0.45)) / RATE
    const alpha = Math.sin(w) / (2 * q)
    const a0 = 1 + alpha
    const b0 = alpha / a0
    const b2 = -alpha / a0
    const a1 = (-2 * Math.cos(w)) / a0
    const a2 = (1 - alpha) / a0
    const y = b0 * x + z1
    z1 = -a1 * y + z2
    z2 = b2 * x - a2 * y
    return y
  }
}

function synth(c: Placed): Float32Array {
  const rand = rng(c.seed)
  const len = (s: number) => Math.max(1, Math.round(s * RATE))
  switch (c.kind) {
    case 'pop': {
      // A soft pitched blip with a tiny click: things appearing.
      const n = len(0.14)
      const out = new Float32Array(n)
      const f0 = 520 + rand() * 260
      let ph = 0
      for (let i = 0; i < n; i++) {
        const t = i / RATE
        ph += (2 * Math.PI * (f0 * 0.45 + f0 * Math.exp(-t * 45))) / RATE
        const env = Math.min(1, t / 0.002) * Math.exp(-t * 32)
        out[i] = Math.sin(ph) * env * 0.7 + (i < 60 ? (rand() * 2 - 1) * 0.25 * (1 - i / 60) : 0)
      }
      return out
    }
    case 'whoosh': {
      // Air moving past: noise through a band that sweeps up and back down.
      const dur = Math.min(0.9, Math.max(0.3, c.len * 0.8))
      const n = len(dur)
      const out = new Float32Array(n)
      const bp = bandpass()
      const top = 1800 + rand() * 1400
      for (let i = 0; i < n; i++) {
        const u = i / n
        const env = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8)), 2)
        out[i] = bp(rand() * 2 - 1, 250 + top * Math.sin(Math.PI * u), 1.4) * env * 2.2
      }
      return out
    }
    case 'pen': {
      // A pen or chalk on paper: bright noise in quick strokes.
      // Strokes of uneven length, pressure and pitch with short lifts between them, like a hand.
      const n = len(c.len)
      const out = new Float32Array(n)
      const bp = bandpass()
      let i = 0
      while (i < n) {
        const stroke = len(0.06 + rand() * 0.14)
        const pressure = 0.45 + rand() * 0.55
        const centre = 2400 + rand() * 2200
        for (let k = 0; k < stroke && i + k < n; k++) {
          const u = k / stroke
          const env = Math.pow(Math.sin(Math.PI * u), 0.7) * pressure
          out[i + k] = bp(rand() * 2 - 1, centre * (0.9 + 0.2 * u), 1.1) * env * 1.6
        }
        i += stroke + len(0.01 + rand() * 0.05)
      }
      // Soft start and end.
      const fade = Math.min(len(0.04), n >> 2)
      for (let k = 0; k < fade; k++) {
        out[k] *= k / fade
        out[n - 1 - k] *= k / fade
      }
      return out
    }
    case 'typing': {
      // Key clicks at a typing pace.
      const n = len(Math.min(4, c.len))
      const out = new Float32Array(n)
      for (let s = 0.0; s < n / RATE; s += 0.065 + rand() * 0.06) {
        const at = Math.round(s * RATE)
        const g = 0.5 + rand() * 0.5
        const bp = bandpass()
        for (let i = 0; i < 700 && at + i < n; i++) {
          const env = Math.exp(-i / 90)
          out[at + i] += (bp(rand() * 2 - 1, 2600 + rand() * 900, 1.2) * 2.4 + Math.sin((2 * Math.PI * 180 * i) / RATE) * 0.3) * env * g
        }
      }
      return out
    }
    case 'boom': {
      // A deep hit for a punch-in: a falling sine, driven into saturation, with a short click on top.
      const n = len(0.95)
      const out = new Float32Array(n)
      let ph = 0
      for (let i = 0; i < n; i++) {
        const t = i / RATE
        ph += (2 * Math.PI * (38 + 70 * Math.exp(-t * 9))) / RATE
        const env = Math.min(1, t / 0.004) * Math.exp(-t * 3.2)
        out[i] = Math.tanh(Math.sin(ph) * 2.6) * env * 0.9 + (i < 240 ? (rand() * 2 - 1) * 0.5 * (1 - i / 240) : 0)
      }
      return out
    }
    case 'scratch': {
      // A record scratch for a freeze frame: bright noise whose pitch is dragged back and forth twice.
      const n = len(0.42)
      const out = new Float32Array(n)
      const bp = bandpass()
      for (let i = 0; i < n; i++) {
        const u = i / n
        const drag = Math.abs(Math.sin(u * Math.PI * 2))
        out[i] = bp(rand() * 2 - 1, 500 + 3200 * drag, 2.2) * (0.4 + 0.6 * drag) * Math.min(1, (n - i) / (RATE * 0.03)) * 2.4
      }
      return out
    }
    case 'whip': {
      // A whip pan: a short, fast rising swish.
      const n = len(0.2)
      const out = new Float32Array(n)
      const bp = bandpass()
      for (let i = 0; i < n; i++) {
        const u = i / n
        out[i] = bp(rand() * 2 - 1, 600 + 5200 * u, 1.6) * Math.sin(Math.PI * u) * 2.6
      }
      return out
    }
    case 'count': {
      // Ticks while a number counts up, then a small bell when it lands.
      const tick = Math.min(3, c.len)
      const n = len(tick + 0.9)
      const out = new Float32Array(n)
      for (let s = 0; s < tick; s += 0.07) {
        const at = Math.round(s * RATE)
        for (let i = 0; i < 400 && at + i < n; i++) out[at + i] += Math.sin((2 * Math.PI * 2100 * i) / RATE) * Math.exp(-i / 60) * 0.35
      }
      const bell = Math.round(tick * RATE)
      for (let i = 0; bell + i < n; i++) {
        const t = i / RATE
        out[bell + i] += (Math.sin(2 * Math.PI * 1318.5 * t) + 0.5 * Math.sin(2 * Math.PI * 1975.5 * t) + 0.25 * Math.sin(2 * Math.PI * 2637 * t)) * Math.exp(-t * 5) * 0.32
      }
      return out
    }
  }
}

const GAIN: Record<CueKind, number> = { pop: 0.55, whoosh: 0.5, pen: 0.22, typing: 0.35, count: 0.45, boom: 0.85, scratch: 0.5, whip: 0.45 }

/**
 * Writes the sound-effects track for the whole video (mono, 48 kHz) and returns its path, or null when the video has
 * no cues. `clips` are the part lengths in seconds, back to back, as in the finished video.
 */
export async function buildSfxTrack(p: Project, level: Exclude<SfxLevel, 'Off'>, out: string) {
  const fps = p.settings.quality.fps
  const all: Placed[] = []
  for (const x of p.parts) {
    const raw = (await partCues(p, x)).map((c) => ({ kind: c.kind, t: c.at / fps, len: (c.dur ?? 0) / fps, strength: c.strength ?? 1 }))
    let cues = raw
    // The rendered part has the last word: sounds go where its picture really moves.
    if (x.video && existsSync(x.video)) cues = matchPicture(cues, await motionOf(x.video))
    for (const [i, c] of cues.entries()) {
      const t = x.start + c.t
      if (t >= x.end) continue
      all.push({ kind: c.kind, t, len: Math.min(c.len, x.end - t), gain: GAIN[c.kind] * c.strength, seed: (x.index + 1) * 7919 + i * 104729 + Math.round(c.t * 1000) })
    }
  }
  const placed = choose(all, level)
  if (!placed.length) return null
  const total = p.voiceover?.duration ?? p.parts[p.parts.length - 1]?.end ?? 0
  const mix = new Float32Array(Math.ceil((total + 1) * RATE))
  for (const c of placed) {
    const s = synth(c)
    const at = Math.round(c.t * RATE)
    for (let i = 0; i < s.length && at + i < mix.length; i++) mix[at + i] += s[i] * c.gain
  }
  // Gentle limiter, then 16-bit WAV.
  const pcm = Buffer.alloc(mix.length * 2)
  for (let i = 0; i < mix.length; i++) pcm.writeInt16LE(Math.round(Math.tanh(mix[i] * 1.2) * 0.9 * 32767), i * 2)
  const head = Buffer.alloc(44)
  head.write('RIFF', 0)
  head.writeUInt32LE(36 + pcm.length, 4)
  head.write('WAVEfmt ', 8)
  head.writeUInt32LE(16, 16)
  head.writeUInt16LE(1, 20)
  head.writeUInt16LE(1, 22)
  head.writeUInt32LE(RATE, 24)
  head.writeUInt32LE(RATE * 2, 28)
  head.writeUInt16LE(2, 32)
  head.writeUInt16LE(16, 34)
  head.write('data', 36)
  head.writeUInt32LE(pcm.length, 40)
  writeFileSync(out, Buffer.concat([head, pcm]))
  return { file: out, count: placed.length }
}
