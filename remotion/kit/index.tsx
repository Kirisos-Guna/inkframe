// Scene kit: the building blocks Claude uses to draw each part.
// Everything is drawn in a 1920x1080 SVG space, whatever the output size.
import React, { createContext, useContext, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AbsoluteFill, continueRender, delayRender, Freeze, Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { evolvePath } from '@remotion/paths'
import rough from 'roughjs'
import type { CharacterDef, StyleDef } from '../../src/shared/types'
import { CharacterArt } from '../../src/shared/CharacterArt'

export interface SceneWord {
  w: string
  start: number // frame
  end: number // frame
}
export interface SceneProps {
  partId: string
  frames: number
  fps: number
  width: number
  height: number
  text: string
  words: { w: string; start: number; end: number }[] // seconds, relative to the part start
  style: StyleDef
  characters: CharacterDef[]
  material: string[] // file names in the public folder
}

const Ctx = createContext<SceneProps | null>(null)
export const SceneProvider = Ctx.Provider

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9']/g, '')

export function useScene() {
  const p = useContext(Ctx)
  if (!p) throw new Error('useScene must be used inside a scene')
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return useMemo(() => {
    const words: SceneWord[] = p.words.map((w) => ({ w: w.w, start: Math.round(w.start * fps), end: Math.round(w.end * fps) }))
    /** Frame where `word` is spoken (the nth time). Falls back to a spread over the part if not found. */
    const at = (word: string, nth = 1, fallback?: number) => {
      const target = norm(word)
      let seen = 0
      for (const w of words) {
        if (norm(w.w) === target || (target.length > 3 && norm(w.w).startsWith(target))) {
          seen++
          if (seen === nth) return w.start
        }
      }
      return fallback ?? Math.round(p.frames * 0.3)
    }
    const material = (name: string) => {
      const f = p.material.find((m) => m === name || m.toLowerCase().includes(name.toLowerCase()))
      return f ? staticFile(f) : undefined
    }
    const font = hand(p.style)
    return { ...p, frame, fps, dur: p.frames, words, at, material, palette: p.style.palette, font }
  }, [p, frame, fps])
}

/** Hand styles write with a real handwriting font (Caveat, bundled), marker styles with Permanent Marker; the rest use Inter. */
export const hand = (s: StyleDef) =>
  s.font === 'marker' ? "'Marker', 'Hand', cursive" : ['pen', 'marker', 'chalk', 'pencil', 'brush'].includes(s.stroke.texture) ? "'Hand', 'Segoe Print', cursive" : "'Inter', 'Segoe UI', sans-serif"

// Fonts ship with every project (public/_inter.woff2, _hand.woff2, _marker.woff2), so text never depends on the PC's fonts.
let fontsLoad: Promise<void> | null = null
function useFonts() {
  const [handle] = React.useState(() => delayRender('Loading fonts'))
  React.useEffect(() => {
    fontsLoad ??= Promise.all([
      new FontFace('Inter', `url(${staticFile('_inter.woff2')}) format('woff2')`, { weight: '100 900' }).load(),
      new FontFace('Hand', `url(${staticFile('_hand.woff2')}) format('woff2')`).load(),
      // Projects made before the marker font was added may not have it: never hold up rendering for it.
      new FontFace('Marker', `url(${staticFile('_marker.woff2')}) format('woff2')`).load().catch(() => null)
    ])
      .then((faces) => faces.forEach((f) => f && document.fonts.add(f)))
      .catch(() => {})
    fontsLoad.then(() => continueRender(handle))
  }, [handle])
}

const ease = Easing.bezier(0.45, 0, 0.25, 1)
const prog = (frame: number, start: number, dur: number) =>
  interpolate(frame, [start, start + Math.max(1, dur)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease })

/** How hand-made a style's lines are: rough.js roughness, and whether lines "boil" like hand animation. */
function craftOf(style: StyleDef) {
  const t = style.stroke.texture
  const hand = ['pen', 'marker', 'chalk', 'pencil', 'brush'].includes(t)
  return {
    hand,
    // Strong enough to see at 1080p (rough.js offsets are a few pixels), gentle enough to stay tidy.
    roughness: !hand ? 0 : t === 'pen' ? 1.3 + style.stroke.jitter * 0.5 : 1.8 + style.stroke.jitter * 0.6,
    multi: t === 'pencil' || t === 'chalk' || t === 'marker',
    boil: hand
  }
}

// Everything stays inside this box (the 1920x1080 frame minus a margin).
const SAFE = { x0: 80, y0: 60, x1: 1840, y1: 1020 }
const fits = new Map<string, string>()
const FitContext = createContext<{ mode: 'measure' | 'draw'; fit: string; report?: (t: string) => void }>({ mode: 'draw', fit: '' })

/**
 * Keeps the drawing inside the frame. Before the first frame of a part renders, the part's finished last frame is
 * drawn invisibly and measured; if anything would leave the frame, the whole drawing is scaled down and moved inside
 * the safe box. The same correction is used for every frame of the part, so nothing jumps.
 */
function fitFor(box: { x: number; y: number; width: number; height: number }) {
  const m = 6 // room for the stroke, which the measurement leaves out
  const x = box.x - m
  const y = box.y - m
  const w = box.width + m * 2
  const h = box.height + m * 2
  if (!w || !h || (x >= SAFE.x0 && y >= SAFE.y0 && x + w <= SAFE.x1 && y + h <= SAFE.y1)) return ''
  const k = Math.min(1, (SAFE.x1 - SAFE.x0) / w, (SAFE.y1 - SAFE.y0) / h)
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  const cx = clamp(x + w / 2, SAFE.x0 + (k * w) / 2, SAFE.x1 - (k * w) / 2)
  const cy = clamp(y + h / 2, SAFE.y0 + (k * h) / 2, SAFE.y1 - (k * h) / 2)
  return `translate(${(cx - k * (x + w / 2)).toFixed(2)} ${(cy - k * (y + h / 2)).toFixed(2)}) scale(${k.toFixed(4)})`
}

/** The background of the style, with its texture, and a 1920x1080 SVG for the drawing. */
export function Board({ children, camera }: { children?: React.ReactNode; camera?: { zoom: number; x: number; y: number } }) {
  const { style, frame, dur } = useScene()
  const { bg, ink, paper } = style.palette
  const id = useId().replace(/:/g, '')
  const t = style.stroke.texture
  const craft = craftOf(style)
  // A slow drift, so no frame is ever perfectly still (a camera on a tripod still breathes).
  const drift = interpolate(frame, [0, Math.max(1, dur)], [0, 1])
  const breathe = `translate(960 540) scale(${1 + drift * 0.01}) translate(-960 -540)`
  const cam = camera ? `translate(960 540) scale(${camera.zoom}) translate(${-camera.x} ${-camera.y})` : breathe
  // Fit to the frame (skipped when the scene moves its own camera: a close-up is meant to crop).
  const fitCtx = useContext(FitContext)
  const measure = useRef<SVGGElement>(null)
  useLayoutEffect(() => {
    if (fitCtx.mode !== 'measure') return
    let t = ''
    try {
      if (!camera) t = fitFor(measure.current!.getBBox())
    } catch {
      t = ''
    }
    fitCtx.report?.(t)
  }, [])
  const fit = camera ? '' : fitCtx.fit
  // Line boil: the texture shifts every 3 frames, like lines redrawn by hand on each drawing.
  const seed = craft.boil ? Math.floor(frame / 3) % 7 : 0
  return (
    <AbsoluteFill style={{ background: bg }}>
      <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <filter id={`chalk${id}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="3" />
          </filter>
          <filter id={`rough${id}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed={seed} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={t === 'pen' ? 1.6 : 2 + style.stroke.jitter * 2} />
          </filter>
          <filter id={`grain${id}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed={seed} />
            <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .06 0" />
          </filter>
          <pattern id={`grid${id}`} width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M48 0H0V48" fill="none" stroke="#fff" strokeOpacity=".12" strokeWidth="1.5" />
          </pattern>
        </defs>
        {style.id === 'blueprint' && <rect width="1920" height="1080" fill={`url(#grid${id})`} />}
        {paper && style.id === 'notebook-sketch' &&
          Array.from({ length: 24 }, (_, i) => <line key={i} x1="0" x2="1920" y1={70 + i * 44} y2={70 + i * 44} stroke={paper} strokeWidth="2" />)}
        {style.id === 'hand-drawn-board' && <radialGradient id={`v${id}`} cx=".5" cy=".45" r=".75"><stop offset=".6" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".6" /></radialGradient>}
        <g
          filter={t === 'chalk' ? `url(#chalk${id})` : craft.hand ? `url(#rough${id})` : undefined}
          transform={cam}
          stroke={ink}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={Math.max(1.5, style.stroke.width * 1.6)}
          opacity={t === 'pencil' ? 0.85 : 1}
        >
          {fitCtx.mode === 'measure' ? <g ref={measure}>{children}</g> : <g transform={fit || undefined}>{children}</g>}
        </g>
        {style.id === 'hand-drawn-board' && <rect width="1920" height="1080" fill={`url(#v${id})`} />}
        {style.id === 'shadow-puppets' && (
          <>
            <radialGradient id={`sp${id}`} cx=".5" cy=".45" r=".7"><stop offset="0" stopColor="#fff2c6" stopOpacity=".55" /><stop offset="1" stopColor="#5a2a00" stopOpacity=".55" /></radialGradient>
            <rect width="1920" height="1080" fill={`url(#sp${id})`} style={{ mixBlendMode: 'multiply' }} />
          </>
        )}
        {/* A little grain on every style: real paper, chalk and screens are never perfectly flat. */}
        <rect width="1920" height="1080" filter={`url(#grain${id})`} opacity={['ink-wash-cartoon', 'living-ink', 'cut-paper-poster', 'pencil-sketch', 'watercolour', 'risograph', 'sumi-ink', 'paper-cutout', 'notebook-sketch'].includes(style.id) ? 1 : 0.5} />
      </svg>
    </AbsoluteFill>
  )
}

/** A stable number from a string, so rough lines look the same on every render of a frame. */
function seedOf(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) % 2147483647 || 1
}

/**
 * Draws an SVG path as if by pen, from `start` over `dur` frames. In hand-drawn styles the line gets real hand
 * irregularity (rough.js): a slightly wandering, sometimes doubled stroke instead of a perfect vector line.
 * Pass `clean` for lines that must stay exact (charts, grids).
 */
export function Draw({
  d,
  start = 0,
  dur = 30,
  color,
  width,
  fill,
  fillAfter = true,
  dashed,
  clean
}: {
  d: string
  start?: number
  dur?: number
  color?: string
  width?: number
  fill?: string
  fillAfter?: boolean
  dashed?: boolean
  clean?: boolean
}) {
  const s = useScene()
  const frame = useCurrentFrame()
  const p = prog(frame, start, dur)
  const craft = craftOf(s.style)
  const line = useMemo(() => {
    if (clean || dashed || !craft.roughness) return d
    try {
      const g = rough.generator()
      const drawable = g.path(d, { roughness: craft.roughness, bowing: 1.4, maxRandomnessOffset: 2 + craft.roughness * 1.5, seed: seedOf(d), disableMultiStroke: !craft.multi })
      return g.toPaths(drawable).map((x) => x.d).join(' ') || d
    } catch {
      return d
    }
  }, [d, clean, dashed, craft.roughness, craft.multi])
  if (p <= 0) return null
  let evolved: { strokeDasharray: string; strokeDashoffset: number }
  try {
    evolved = evolvePath(p, line)
  } catch {
    evolved = evolvePath(p, d)
  }
  const fillOp = fill && fillAfter ? interpolate(frame, [start + dur * 0.8, start + dur + 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1
  return (
    <>
      {fill && <path d={d} fill={fill} fillOpacity={fillOp} stroke="none" />}
      <path
        d={line}
        stroke={color}
        strokeWidth={width}
        fill="none"
        strokeDasharray={dashed && p >= 1 ? '14 12' : evolved.strokeDasharray}
        strokeDashoffset={dashed && p >= 1 ? 0 : evolved.strokeDashoffset}
      />
    </>
  )
}

/** Shape helpers that return path strings for <Draw>. */
export const shape = {
  rect: (x: number, y: number, w: number, h: number, r = 0) =>
    r
      ? `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`
      : `M${x} ${y}H${x + w}V${y + h}H${x}Z`,
  circle: (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`,
  line: (x1: number, y1: number, x2: number, y2: number) => `M${x1} ${y1}L${x2} ${y2}`,
  arrow: (x1: number, y1: number, x2: number, y2: number, head = 22) => {
    const a = Math.atan2(y2 - y1, x2 - x1)
    const h1 = [x2 - head * Math.cos(a - 0.45), y2 - head * Math.sin(a - 0.45)]
    const h2 = [x2 - head * Math.cos(a + 0.45), y2 - head * Math.sin(a + 0.45)]
    return `M${x1} ${y1}L${x2} ${y2}M${h1[0]} ${h1[1]}L${x2} ${y2}L${h2[0]} ${h2[1]}`
  },
  curve: (x1: number, y1: number, x2: number, y2: number, bend = 0.25) => {
    const mx = (x1 + x2) / 2 - (y2 - y1) * bend
    const my = (y1 + y2) / 2 + (x2 - x1) * bend
    return `M${x1} ${y1}Q${mx} ${my} ${x2} ${y2}`
  },
  wave: (x: number, y: number, w: number, amp = 20, n = 6) =>
    `M${x} ${y}` + Array.from({ length: n }, (_, i) => `q${w / n / 2} ${i % 2 ? amp : -amp} ${w / n} 0`).join('')
}

/** Handwritten text that writes itself from left to right. */
export function Write({
  text,
  x,
  y,
  size = 56,
  start = 0,
  dur,
  color,
  align = 'start',
  weight = 400,
  font
}: {
  text: string
  x: number
  y: number
  size?: number
  start?: number
  dur?: number
  color?: string
  align?: 'start' | 'middle' | 'end'
  weight?: number
  font?: string
}) {
  const s = useScene()
  const frame = useCurrentFrame()
  const id = useId().replace(/:/g, '')
  const d = dur ?? Math.max(8, text.length * 1.6)
  const p = prog(frame, start, d)
  if (p <= 0) return null
  const w = text.length * size * 0.62
  const left = align === 'middle' ? x - w / 2 : align === 'end' ? x - w : x
  return (
    <g>
      <clipPath id={`c${id}`}>
        <rect x={left - 10} y={y - size * 1.2} width={(w + 20) * p} height={size * 1.7} />
      </clipPath>
      <text
        x={x}
        y={y}
        fontSize={size}
        fontFamily={font ?? s.font}
        fontWeight={weight}
        textAnchor={align}
        fill={color ?? s.palette.ink}
        stroke="none"
        clipPath={`url(#c${id})`}
      >
        {text}
      </text>
    </g>
  )
}

/** Text typed letter by letter. */
export function Typewriter({ text, x, y, size = 64, start = 0, cps = 18, color, align = 'start' }: { text: string; x: number; y: number; size?: number; start?: number; cps?: number; color?: string; align?: 'start' | 'middle' | 'end' }) {
  const s = useScene()
  const frame = useCurrentFrame()
  const n = Math.max(0, Math.floor(((frame - start) / s.fps) * cps))
  if (frame < start) return null
  const shown = text.slice(0, n)
  return (
    <text x={x} y={y} fontSize={size} fontFamily="'Cascadia Mono', Consolas, monospace" fill={color ?? s.palette.ink} stroke="none" textAnchor={align}>
      {shown}
      {n < text.length && (frame % 20 < 10 ? '▌' : '')}
    </text>
  )
}

/** Springs its children in, scaling from (x, y). */
export function Pop({ start = 0, x = 960, y = 540, children }: { start?: number; x?: number; y?: number; children: React.ReactNode }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  if (frame < start) return null
  const s = spring({ frame: frame - start, fps, config: { damping: 12, stiffness: 140 } })
  return <g transform={`translate(${x} ${y}) scale(${s}) translate(${-x} ${-y})`}>{children}</g>
}

/** Fades children in at `start` (and out at `out`, if given). */
export function Fade({ start = 0, dur = 12, out, children }: { start?: number; dur?: number; out?: number; children: React.ReactNode }) {
  const frame = useCurrentFrame()
  const a = prog(frame, start, dur)
  const b = out !== undefined ? 1 - prog(frame, out, dur) : 1
  if (a <= 0) return null
  return <g opacity={a * b}>{children}</g>
}

/** Moves children from one offset to another. */
export function Move({ from, to, start = 0, dur = 30, children }: { from: [number, number]; to: [number, number]; start?: number; dur?: number; children: React.ReactNode }) {
  const frame = useCurrentFrame()
  const p = prog(frame, start, dur)
  const x = from[0] + (to[0] - from[0]) * p
  const y = from[1] + (to[1] - from[1]) * p
  return <g transform={`translate(${x} ${y})`}>{children}</g>
}

/** Moves a small dot (or children) along a path. */
export function Travel({ d, start = 0, dur = 40, r = 10, color, children }: { d: string; start?: number; dur?: number; r?: number; color?: string; children?: React.ReactNode }) {
  const frame = useCurrentFrame()
  const s = useScene()
  const p = prog(frame, start, dur)
  const pt = useMemo(() => {
    if (typeof document === 'undefined') return { x: 0, y: 0 }
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    el.setAttribute('d', d)
    const L = el.getTotalLength()
    const q = el.getPointAtLength(L * p)
    return { x: q.x, y: q.y }
  }, [d, p])
  if (frame < start) return null
  return <g transform={`translate(${pt.x} ${pt.y})`}>{children ?? <circle r={r} fill={color ?? s.palette.accent} stroke="none" />}</g>
}

/** A number that counts up. */
export function Count({ from = 0, to, start = 0, dur = 40, x, y, size = 160, prefix = '', suffix = '', decimals = 0, color }: { from?: number; to: number; start?: number; dur?: number; x: number; y: number; size?: number; prefix?: string; suffix?: string; decimals?: number; color?: string }) {
  const s = useScene()
  const frame = useCurrentFrame()
  if (frame < start) return null
  const v = from + (to - from) * prog(frame, start, dur)
  return (
    <text x={x} y={y} fontSize={size} fontFamily={s.font} fontWeight={700} textAnchor="middle" fill={color ?? s.palette.accent} stroke="none">
      {prefix}
      {v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </text>
  )
}

/** A camera that zooms/pans the whole board. Wrap the scene's content in it. */
export function useCamera(keys: { at: number; zoom: number; x: number; y: number }[]) {
  const frame = useCurrentFrame()
  if (!keys.length) return { zoom: 1, x: 960, y: 540 }
  const ats = keys.map((k) => k.at)
  if (keys.length === 1) return keys[0]
  const pick = (k: 'zoom' | 'x' | 'y') =>
    interpolate(frame, ats, keys.map((x) => x[k]), { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease })
  return { zoom: pick('zoom'), x: pick('x'), y: pick('y') }
}

const DRAWN: Record<string, string> = {
  'hand-drawn-board': 'Pen',
  'notebook-sketch': 'Flat',
  chalkboard: 'Chalk',
  'pencil-sketch': 'Ink',
  risograph: 'Riso',
  'sumi-ink': 'Ink',
  'paper-cutout': 'Paper',
  blueprint: 'Blueprint',
  'cartoon-history': 'Cartoon History',
  watercolour: 'Watercolour',
  'soft-3d': 'Soft 3D',
  'flat-cartoon': 'Flat',
  'cinematic-3d': 'Soft 3D',
  'short-3d': 'Soft 3D',
  'ink-wash-cartoon': 'Watercolour',
  'living-ink': 'Ink',
  'cut-paper-poster': 'Paper',
  'shadow-puppets': 'Ink',
  cutaways: 'Flat',
  'character-stories': 'Flat',
  'cartoon-music-video': 'Flat',
  'paper-plane-3d': 'Paper',
  'popup-book-3d': 'Paper',
  'blueprint-3d': 'Blueprint',
  'pencil-3d': 'Ink',
  'little-worlds-3d': 'Soft 3D',
  'interactive-3d': 'Flat'
}

/** One of the video's characters, drawn in the video's style. `name` matches the character's name. */
export function Character({
  name,
  x,
  y,
  height = 520,
  pose,
  expression,
  start = 0,
  flip
}: {
  name?: string
  x: number
  y: number
  height?: number
  pose?: string
  expression?: string
  start?: number
  flip?: boolean
}) {
  const s = useScene()
  const frame = useCurrentFrame()
  const c = s.characters.find((x) => !name || x.name.toLowerCase() === name.toLowerCase()) ?? s.characters[0]
  if (!c || frame < start) return null
  const def = { ...c, pose: pose ?? c.pose, expression: expression ?? c.expression, drawnIn: DRAWN[s.style.id] ?? 'Pen' }
  const w = height // the drawing is centred in a square box
  const bob = Math.sin((frame - start) / 9) * 3
  return (
    <g transform={`translate(${x - w / 2} ${y - height + bob}) ${flip ? `translate(${w} 0) scale(-1 1)` : ''}`}>
      <g stroke="none">
        <CharacterArt c={def} size={height} />
      </g>
    </g>
  )
}

/** A picture from the user's material. */
export function Picture({ name, x, y, w, h, start = 0, frame: framed = true }: { name: string; x: number; y: number; w: number; h: number; start?: number; frame?: boolean }) {
  const s = useScene()
  const src = s.material(name)
  if (!src || s.frame < start) return null
  return (
    <Pop start={start} x={x + w / 2} y={y + h / 2}>
      {framed && <rect x={x - 8} y={y - 8} width={w + 16} height={h + 16} rx={10} />}
      <image href={src} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid meet" />
    </Pop>
  )
}

/** Wrapper the app uses to give every scene its props. */
export function makeRoot(scenes: Record<string, React.ComponentType>) {
  return function PartRoot(props: SceneProps) {
    useFonts()
    const Scene = scenes[props.partId]
    const [fit, setFit] = useState<string | null>(() => fits.get(props.partId) ?? null)
    const [handle] = useState(() => (fit === null && Scene ? delayRender('Fitting the drawing in the frame') : null))
    const reported = useRef<string | null>(null)
    // Children's layout effects run first: if no Board reported (a 3D scene, say), there is nothing to fit.
    useLayoutEffect(() => {
      if (handle === null) return
      const t = reported.current ?? ''
      fits.set(props.partId, t)
      setFit(t)
      continueRender(handle)
    }, [handle, props.partId])
    if (!Scene) return <AbsoluteFill style={{ background: '#000', color: '#fff', fontSize: 60, alignItems: 'center', justifyContent: 'center' }}>Missing scene</AbsoluteFill>
    return (
      <SceneProvider value={props}>
        {fit === null ? (
          <AbsoluteFill style={{ visibility: 'hidden' }}>
            <Freeze frame={Math.max(0, props.frames - 1)}>
              <FitContext.Provider value={{ mode: 'measure', fit: '', report: (t) => (reported.current = t) }}>
                <Scene />
              </FitContext.Provider>
            </Freeze>
          </AbsoluteFill>
        ) : (
          <FitContext.Provider value={{ mode: 'draw', fit }}>
            <Scene />
          </FitContext.Provider>
        )}
      </SceneProvider>
    )
  }
}

export { AbsoluteFill, interpolate, spring, useCurrentFrame, Easing }
