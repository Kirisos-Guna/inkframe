// Sound effects: found from the scenes themselves and made on this computer. No AI, no downloads, no licences.
//
// 1. Cues: each React scene is rendered in Node with a stand-in kit (remotion/kit/cues) that notes when things pop,
//    move, are drawn, typed or counted. HTML scenes are read from their GSAP timeline.
// 2. Sounds: pops, whooshes, pen scratches, key clicks and ticks are synthesised from scratch, a little different
//    each time (seeded), so nothing sounds looped.
// 3. One track: every sound at its exact time, written as a WAV the finishing pass mixes under the voice.
import { existsSync, readFileSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'
import { createRequire } from 'module'
import { build } from 'esbuild'
import type { Part, Project, SfxLevel } from '../../shared/types'
import { appRoot, kitDir, propsFor } from './render'
import { engineOf, scenePath } from './engines'

type CueKind = 'pop' | 'whoosh' | 'pen' | 'typing' | 'count'
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

// ---------- choosing ----------
interface Placed {
  kind: CueKind
  t: number // seconds in the video
  len: number // seconds
  gain: number
  seed: number
}

const PRIORITY: Record<CueKind, number> = { pop: 5, whoosh: 4, count: 3, typing: 2, pen: 1 }

/**
 * Picks the sounds: Subtle keeps the big moments (reveals, moves, counters, typing) with room between them; Lively
 * also scratches the pen while things are drawn. A busy moment never gets a pile of sounds at once.
 */
function choose(all: Placed[], level: Exclude<SfxLevel, 'Off'>) {
  const gap = level === 'Lively' ? 0.22 : 0.5
  const point = all.filter((c) => c.kind !== 'pen').sort((a, b) => PRIORITY[b.kind] - PRIORITY[a.kind] || a.t - b.t)
  const kept: Placed[] = []
  for (const c of point) if (!kept.some((k) => Math.abs(k.t - c.t) < gap)) kept.push(c)
  if (level === 'Lively') {
    // Pen strokes that overlap become one scratch, and never longer than 2.5 s at a time.
    const pens = all.filter((c) => c.kind === 'pen' && c.len >= 0.25).sort((a, b) => a.t - b.t)
    const merged: Placed[] = []
    for (const c of pens) {
      const last = merged[merged.length - 1]
      if (last && c.t <= last.t + last.len + 0.08) last.len = Math.max(last.len, c.t + c.len - last.t)
      else merged.push({ ...c })
    }
    for (const m of merged) kept.push({ ...m, len: Math.min(2.5, m.len) })
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

const GAIN: Record<CueKind, number> = { pop: 0.55, whoosh: 0.5, pen: 0.22, typing: 0.35, count: 0.45 }

/**
 * Writes the sound-effects track for the whole video (mono, 48 kHz) and returns its path, or null when the video has
 * no cues. `clips` are the part lengths in seconds, back to back, as in the finished video.
 */
export async function buildSfxTrack(p: Project, level: Exclude<SfxLevel, 'Off'>, out: string) {
  const fps = p.settings.quality.fps
  const all: Placed[] = []
  for (const x of p.parts) {
    for (const [i, c] of (await partCues(p, x)).entries()) {
      const t = x.start + c.at / fps
      if (t >= x.end) continue
      all.push({ kind: c.kind, t, len: Math.min((c.dur ?? 0) / fps, x.end - t), gain: GAIN[c.kind] * (c.strength ?? 1), seed: (x.index + 1) * 7919 + i * 104729 + c.at })
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
