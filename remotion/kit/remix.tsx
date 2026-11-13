// Building blocks for the Fast Tech Remix style: real media cut fast. Full-frame shots, page screenshots with a
// highlighter, real posts, memes, clips, a VS Code style editor, a terminal, flat diagram boxes, a pointing hand and a
// drawn circle. Each fills the 1920 x 1080 frame from `start` (a frame) and is meant to be on screen 2 to 4 seconds;
// <Cuts> puts several one after another. Media names are the files listed for the part ("m/p3-1-ab12cd.png").
import React from 'react'
import Prism from 'prismjs'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-sql'
import { AbsoluteFill, cancelRender, continueRender, delayRender, Easing, Freeze, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'

import { CutAt, useFrameFor, usePartFrame, usePartFrames } from './index'
import { fitText, memeLayout } from '../../src/shared/memes'
import { flashFree } from './flash'
import { clipToBoxes, type Rect } from './geometry'
export { flashFree }

const MEME = "'Meme', Impact, 'Arial Black', sans-serif"
const CODE = "'Code', 'Cascadia Mono', Consolas, monospace"
const UI = "'Inter', 'Tamil', 'Segoe UI', sans-serif"
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

/**
 * Frames since `start` (a frame of the part, like at('word')), and t: 0 before it, 1 from it on. Inside a <Cuts>
 * shot that begins later than `start`, it counts from the shot's first frame.
 */
function useLocal(start = 0, _dur = 12) {
  // Something timed to come in after its part ends would never be seen (an arrow pointing at nothing): it comes in
  // at the latest two thirds of a second before the end.
  const durationInFrames = usePartFrames()
  start = Math.min(start, Math.max(0, durationInFrames - 20))
  const f = useFrameFor(start) - start
  // Fireship's motion: things are simply there on their frame, no fade, spring or slide (a cut, not a tween).
  return { f, t: f >= 0 ? 1 : 0 }
}

/** 1 from frame `at` on, 0 before: a thing that appears on its beat, Fireship style. */
const on = (f: number, at: number) => (f >= at ? 1 : 0)

/** How one shot of a <Cuts> comes in: a hard cut (the default), a blur-streak whip pan, or a glitch. */
export type Transition = 'cut' | 'whip' | 'glitch'
/** Frames a whip or glitch takes. */
const TRANS = { whip: 6, glitch: 5 }

/**
 * Shows its children one after another: the first from at[0], the next from at[1]… until the part ends. Hard cuts,
 * like Fireship; `whip` makes every change a blur-streak whip pan, and `fx` picks one per change ('cut', 'whip',
 * 'glitch'; fx[0] is the change into the second shot).
 */
export function Cuts({ at, children, whip = false, fx }: { at: number[]; children: React.ReactNode; whip?: boolean; fx?: Transition[] }) {
  const { durationInFrames, fps } = useVideoConfig()
  // Inside another shot, Remotion counts from that shot's start; the times given here are frames of the part.
  const outer = React.useContext(CutAt)
  const shots = flashFree(React.Children.toArray(children), at, durationInFrames, Math.round(fps * 0.8))
  const into = (i: number): Transition => (i === 0 ? 'cut' : fx?.[i - 1] ?? (whip ? 'whip' : 'cut'))
  return (
    <>
      {shots.map(({ c, from, to }, i) => {
        // The shot before a whip stays on for the whip's frames, streaking out under the new one.
        const next = i + 1 < shots.length ? into(i + 1) : 'cut'
        const tail = next === 'whip' ? TRANS.whip : 0
        const how = into(i)
        return (
          <Sequence key={i} from={from - outer} durationInFrames={Math.max(1, to - from + tail)} layout="none">
            <CutAt.Provider value={from}>
              <TransitionIn how={how}>
                <WhipOut frames={tail} at={to - from}>
                  {c}
                </WhipOut>
              </TransitionIn>
            </CutAt.Provider>
          </Sequence>
        )
      })}
    </>
  )
}

/** A horizontal-only blur (a motion streak), as an SVG filter: CSS blur() smears both ways. */
function Streak({ id, amount }: { id: string; amount: number }) {
  return (
    <svg width={0} height={0} style={{ position: 'absolute' }}>
      <filter id={id} x="-20%" y="0" width="140%" height="100%" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation={`${amount} 0`} />
      </filter>
    </svg>
  )
}

/**
 * Fireship's whip pan: the new shot tears in from the right as horizontal streaks and snaps sharp (6 frames); a glitch
 * shears it into sliding horizontal bands with the colour channels split (5 frames).
 */
function TransitionIn({ how, children }: { how: Transition; children: React.ReactNode }) {
  const f = useCurrentFrame()
  const id = React.useId().replace(/:/g, '')
  if (how === 'whip' && f < TRANS.whip) {
    const t = interpolate(f, [0, TRANS.whip], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) })
    return (
      <AbsoluteFill style={{ transform: `translateX(${(1 - t) * 1100}px)`, filter: `url(#w${id})` }}>
        <Streak id={`w${id}`} amount={(1 - t) * 90} />
        {children}
      </AbsoluteFill>
    )
  }
  if (how === 'glitch' && f < TRANS.glitch) {
    const k = 1 - f / TRANS.glitch
    return (
      <AbsoluteFill style={{ filter: `url(#g${id})` }}>
        <svg width={0} height={0} style={{ position: 'absolute' }}>
          <filter id={`g${id}`} x="-10%" y="0" width="120%" height="100%" colorInterpolationFilters="sRGB">
            {/* Noise that changes only from top to bottom: bands, each pushed sideways by its own amount. */}
            <feTurbulence type="fractalNoise" baseFrequency="0 0.035" numOctaves={1} seed={f * 7 + 3} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={260 * k} xChannelSelector="R" yChannelSelector="A" result="d" />
            <feColorMatrix in="d" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
            <feOffset in="r" dx={26 * k} result="rs" />
            <feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="gb" />
            <feBlend in="rs" in2="gb" mode="screen" />
          </filter>
        </svg>
        {children}
      </AbsoluteFill>
    )
  }
  return <>{children}</>
}

/** The outgoing shot under a whip: from frame `at` it streaks off to the left for `frames` frames. */
function WhipOut({ frames, at, children }: { frames: number; at: number; children: React.ReactNode }) {
  const f = useCurrentFrame()
  const id = React.useId().replace(/:/g, '')
  if (!frames || f < at) return <>{children}</>
  const t = interpolate(f, [at, at + frames], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) })
  return (
    <AbsoluteFill style={{ transform: `translateX(${-t * 700}px)`, filter: `url(#o${id})` }}>
      <Streak id={`o${id}`} amount={t * 90} />
      {children}
    </AbsoluteFill>
  )
}

/**
 * Snap zooms: at each frame in `at` the picture jumps closer (by `amount`), on the word that matters, and stays there
 * (a hard zoom cut); a later punch goes closer again. `x`, `y` is what it zooms toward (default the centre).
 */
export function Punch({ at, amount = 0.14, x = 960, y = 540, children }: { at: number[]; amount?: number; x?: number; y?: number; children: React.ReactNode }) {
  const f = usePartFrame()
  let k = 1
  for (const a of at) k += amount * on(f, a)
  return <AbsoluteFill style={{ transform: `scale(${k})`, transformOrigin: `${x}px ${y}px` }}>{children}</AbsoluteFill>
}

/**
 * Kept so older scenes still render: Fireship never shakes the camera, so on an impact the picture just takes a hard
 * Punch in.
 */
export function Shake({ at, children }: { at: number[]; power?: number; children: React.ReactNode }) {
  return (
    <Punch at={at} amount={0.08}>
      {children}
    </Punch>
  )
}

/**
 * A freeze frame: from `at` the picture stops, loses some colour and zooms in a little, with an optional label
 * ("Yep, that's me.") — the "record scratch" moment.
 */
export function FreezeFrame({ at, label, children }: { at: number; label?: string; children: React.ReactNode }) {
  const f = usePartFrame()
  const cut = React.useContext(CutAt)
  if (f < at) return <>{children}</>
  const t = 1
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${1 + 0.06 * t})`, filter: `saturate(${1 - 0.6 * t}) contrast(${1 + 0.15 * t})` }}>
        <Freeze frame={Math.max(0, at - cut)}>{children}</Freeze>
      </AbsoluteFill>
      {label && (
        <div style={{ position: 'absolute', left: 80, bottom: 90, fontFamily: MEME, fontSize: 84, color: '#fff', textTransform: 'uppercase', WebkitTextStroke: '5px #000', paintOrder: 'stroke fill', opacity: t, transform: `rotate(-3deg)` }}>
          {label}
        </div>
      )}
    </AbsoluteFill>
  )
}

/**
 * The wallpaper Fireship puts screenshots and logos on: a deep blue gradient, so a white page or card stands out
 * crisply instead of floating in black.
 */
export const WALL = 'radial-gradient(ellipse at 30% 20%, #3b5bdb 0%, #1e3a8a 38%, #0f1b4d 72%, #0a1033 100%)'

/** A picture filling the frame (a photo, a logo, B-roll), held still. `fit="contain"` keeps all of it; `zoom` crops in. */
export function Shot({ name, start = 0, fit = 'cover', zoom = 1, bg = '#000' }: { name: string; start?: number; fit?: 'cover' | 'contain'; zoom?: number; bg?: string }) {
  const { f } = useLocal(start)
  if (f < 0) return null
  const k = zoom
  if (/-logo\.\w+$/.test(name))
    return (
      <AbsoluteFill style={{ background: WALL, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', borderRadius: 28, padding: '70px 110px', boxShadow: '0 40px 120px rgba(0,0,0,.5)' }}>
          <Img src={staticFile(name)} style={{ display: 'block', maxWidth: 1100, maxHeight: 420, objectFit: 'contain' }} />
        </div>
      </AbsoluteFill>
    )
  return (
    <AbsoluteFill style={{ background: bg, overflow: 'hidden' }}>
      <Img src={staticFile(name)} style={{ width: '100%', height: '100%', objectFit: fit, transform: `scale(${k})` }} />
    </AbsoluteFill>
  )
}

/** A real video clip, muted (the voiceover is the sound), from `from` seconds of the clip. */
export function Clip({ name, start = 0, from = 0, fit = 'cover' }: { name: string; start?: number; from?: number; fit?: 'cover' | 'contain' }) {
  const { fps } = useVideoConfig()
  return (
    <Sequence from={start} layout="none">
      <AbsoluteFill style={{ background: '#000' }}>
        <OffthreadVideo src={staticFile(name)} muted startFrom={Math.round(from * fps)} style={{ width: '100%', height: '100%', objectFit: fit }} />
      </AbsoluteFill>
    </Sequence>
  )
}

/**
 * A screenshot of a page as a card on black, with the sentence highlighted (`marks`, in the picture's own pixels, as
 * listed for the part) and an optional second one in yellow (`marks2`). `crop` shows only the headline and that
 * paragraph (`focus`), big; `scroll` moves down a tall capture to the sentence; `underline` draws a marker line under
 * the words instead of a highlighter. The camera eases toward the highlight.
 */
export function Page({
  name,
  w,
  h,
  marks = [],
  marks2 = [],
  focus,
  crop,
  scroll = false,
  underline = false,
  start = 0,
  markAt = 18,
  color = '#ff8a1f',
  tilt = 0,
  point = false
}: {
  name: string
  w: number
  h: number
  marks?: number[][]
  marks2?: number[][]
  focus?: number[]
  crop?: boolean
  scroll?: boolean
  underline?: boolean
  start?: number
  markAt?: number
  color?: string
  tilt?: number
  /** A hand pointing at the highlighted sentence, once it is highlighted (it moves with the page, so it is always on it). */
  point?: boolean
}) {
  const { f } = useLocal(start, 14)
  if (f < 0) return null
  // The part of the picture shown: by default a close crop of the headline and the paragraph with the highlight (a
  // whole page is too small to read); the whole page only for a scrolling shot or when asked (crop={false}). A crop
  // is never a thin strip: it grows taller around the highlight until it fills most of the frame.
  const all0 = [...marks, ...marks2]
  const around = all0.length ? padBox(all0, w, h, focus) : focus
  const cropped = (crop ?? !scroll) && !!around
  let [fx, fy, fw, fh] = cropped ? roomy(around!, all0, w, h) : [0, 0, w, h]
  let width = cropped ? Math.min(1640, (fw / fh) * 860) : 1560
  let k = width / fw
  // Whole lines, never words cut at the edge: the crop is as wide as the text column (to the paragraph's right edge,
  // which a one-line highlight does not show), and zooms in for a phone only as far as that whole width still fits.
  // Taller than the frame allows, it keeps whole lines around the highlight, the ones at the cut edges fading out.
  const line = all0.length ? Math.max(...all0.map((m) => m[3])) : 0
  let fadeTop = false
  let fadeBottom = false
  if (cropped && line) {
    const left = Math.min(...all0.map((m) => m[0]))
    const colRight = focus && focus[0] <= left + line && focus[0] + focus[2] > fx + fw && focus[2] <= line * 48 ? focus[0] + focus[2] + line * 0.8 : fx + fw
    fw = Math.min(w - fx, colRight - fx)
    k = Math.min(Math.max(k, PHONE_LINE / line), 1800 / fw)
    const maxH = 900 / k
    {
      // Line pitch: the distance between highlighted lines, or a usual line spacing.
      const ys = [...new Set(all0.map((m) => m[1]))].sort((a, b) => a - b)
      const pitch = ys.length > 1 ? Math.min(...ys.slice(1).map((y, i) => y - ys[i]).filter((d) => d > line * 0.8)) || line * 1.3 : line * 1.3
      const first = ys[0]
      const last = Math.max(...all0.map((m) => m[1] + m[3]))
      // As many whole lines as the crop had (at least 7, for some context), never more than fit the frame.
      const rows = Math.max(1, Math.min(Math.floor(maxH / pitch), Math.max(7, Math.round(fh / pitch))))
      const above = Math.max(0, Math.floor((rows - Math.ceil((last - first) / pitch)) / 2))
      fy = Math.max(0, first - above * pitch - pitch * 0.25)
      fh = Math.min(h - fy, rows * pitch)
      fadeTop = fy > 0
      fadeBottom = fy + fh < h
    }
    width = fw * k
  }
  const tallView = scroll ? 900 / k : fh
  const height = Math.min(fh, tallView) * k
  const all = [...marks, ...marks2]
  const my = all.length ? (Math.min(...all.map((m) => m[1])) + Math.max(...all.map((m) => m[1] + m[3]))) / 2 - fy : fh / 2
  // A tall capture scrolls down to the sentence over the first part of the shot.
  const scrollTo = scroll ? Math.max(0, Math.min(fh - tallView, my - tallView * 0.4)) : 0
  // Held still, Fireship style: a tall capture is shown already at its sentence; a whole page is centred on it.
  const sy = scrollTo
  const top = (1080 - height) / 2
  const dy = scroll || cropped || height <= 1080 ? 0 : Math.max(1080 - (top + height), Math.min(-top, 540 - (top + my * k)))
  const bars = (list: number[][], fill: string, from0: number) => {
    // Each line is swiped after the one before, like a quick highlighter stroke: all of them within about 0.4 s,
    // however big the crop shows them (the one move on a held page, as in Fireship).
    const total = list.reduce((n, m) => n + m[2], 0) || 1
    let used = 0
    return list.map(([x, y, mw, mh], i) => {
      const len = mw * k
      const from = from0 + (used / total) * 12
      used += mw
      const p = interpolate(f, [from, from + Math.max(3, (mw / total) * 12)], [0, 1], clamp)
      const bx = (x - fx) * k - 4
      const by = (y - fy - sy) * k
      return underline ? (
        <rect key={`${fill}${i}`} x={bx} y={by + mh * k * 0.92} width={(len + 8) * p} height={Math.max(5, mh * k * 0.12)} fill={fill} rx={3} />
      ) : (
        <rect key={`${fill}${i}`} x={bx} y={by + mh * k * 0.1} width={(len + 8) * p} height={mh * k * 0.85} fill={fill} opacity={0.75} rx={3} />
      )
    })
  }
  return (
    <AbsoluteFill style={{ background: WALL, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: 960 - width / 2,
          top,
          width,
          height,
          transform: `translateY(${dy}px) rotate(${tilt}deg)`,
          // Lines cut by the crop's top or bottom edge fade out instead of showing half a line.
          ...(fadeTop || fadeBottom ? { WebkitMaskImage: `linear-gradient(to bottom, ${fadeTop ? 'transparent 0%, #000 9%' : '#000 0%'}, ${fadeBottom ? '#000 91%, transparent 100%' : '#000 100%'})` } : {}),
          boxShadow: '0 30px 90px rgba(0,0,0,.45)',
          borderRadius: 12,
          overflow: 'hidden',
          background: '#fff',
        }}
      >
        <Img src={staticFile(name)} style={{ position: 'absolute', left: -fx * k, top: -(fy + sy) * k, width: w * k, height: h * k, maxWidth: 'none' }} />
        <svg width={width} height={height} style={{ position: 'absolute', inset: 0, mixBlendMode: underline ? 'normal' : 'multiply' }}>
          {bars(marks, color, markAt)}
          {bars(marks2, '#ffe14d', markAt + 24)}
        </svg>
        {point && marks[0] && (() => {
          // In the left margin of the first highlighted line, pointing at it, after the highlighter has run: it never
          // covers words.
          // At the line that starts furthest left (a highlight that starts mid-line goes on into the next line, which
          // starts at the margin): there the hand is in empty margin, never on words.
          const [mx, my0, , mh] = marks.reduce((a, m) => (m[0] < a[0] - 4 ? m : a), marks[0])
          const room = (mx - fx) * k
          const size = Math.max(44, Math.min(120, mh * k * 1.5, room * 0.85))
          if (!on(f, markAt + 14)) return null
          return (
            <div style={{ position: 'absolute', left: room - size * 1.02, top: (my0 - fy - sy) * k + (mh * k - size) / 2, fontSize: size, lineHeight: 1, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.45))' }}>👉</div>
          )
        })()}
      </div>
    </AbsoluteFill>
  )
}

/**
 * The crop of a page: the highlighted lines with a few lines of context above and below, inside the picture. A
 * paragraph box alone can be most of the page (a long first paragraph under a headline), which reads like the whole
 * page again.
 */
export function padBox(marks: number[][], w: number, h: number, focus?: number[]): number[] {
  const line = Math.max(...marks.map((m) => m[3]))
  // As wide as the highlighted lines (plus a margin), at least 22 lines of text wide so it is not blown up blurry,
  // starting at the paragraph's left edge when that is close. Never the paragraph box's full width: on many pages it
  // runs across the whole page (Hacker News) or takes in a sidebar (Wikipedia's infobox).
  const left = Math.min(...marks.map((m) => m[0]))
  const right = Math.max(...marks.map((m) => m[0] + m[2]))
  const start = focus && focus[0] <= left && left - focus[0] < line * 40 ? focus[0] : left - line
  // Two and a half lines of room on the left: the margin a pointing hand sits in.
  const x0 = Math.max(0, start - line * 2.5)
  const x1 = Math.min(w, Math.max(right + line * 1.5, x0 + line * 22))
  const y0 = Math.max(0, Math.min(...marks.map((m) => m[1])) - line * 3.5)
  const y1 = Math.min(h, Math.max(...marks.map((m) => m[1] + m[3])) + line * 3.5)
  return [x0, y0, x1 - x0, y1 - y0]
}

/** The height on screen (of 1080) a highlighted line of a page gets at least, so it reads on a phone. */
const PHONE_LINE = 74

/** A crop box made at most 2.2 times as wide as it is tall, centred on the highlight, inside the picture. */
export function roomy([x, y, fw, fh]: number[], marks: number[][], w: number, h: number): number[] {
  const want = fw / 2.2
  if (fh >= want) return [x, y, fw, fh]
  const tall = Math.min(h, want)
  const mid = marks.length ? (Math.min(...marks.map((m) => m[1])) + Math.max(...marks.map((m) => m[1] + m[3]))) / 2 : y + fh / 2
  const top = Math.max(0, Math.min(h - tall, mid - tall / 2))
  return [x, top, fw, tall]
}

/** Two things side by side (code and what it does, before and after), each half the frame. */
/** Set inside a Split: code and terminals draw their text bigger, since the half is shown at half size. */
const InSplit = React.createContext(false)

export function Split({ left, right, start = 0 }: { left: React.ReactNode; right: React.ReactNode; start?: number }) {
  const { f } = useLocal(start, 10)
  if (f < 0) return null
  const half = (node: React.ReactNode, side: 0 | 1) => (
    <div style={{ position: 'absolute', top: 0, bottom: 0, left: side ? 960 : 0, width: 960, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: -480, top: 0, width: 1920, height: 1080, transform: 'scale(.52)', transformOrigin: '50% 50%' }}>
        <InSplit.Provider value={true}>{node}</InSplit.Provider>
      </div>
    </div>
  )
  return (
    <AbsoluteFill style={{ background: '#0b0b0d' }}>
      {half(left, 0)}
      {half(right, 1)}
      <div style={{ position: 'absolute', left: 958, top: 80, bottom: 80, width: 4, background: '#2a2a30', borderRadius: 2 }} />
    </AbsoluteFill>
  )
}

/** A real post (the captured embed), big and centred on the wallpaper. */
export function Post({ name, w, h, start = 0 }: { name: string; w: number; h: number; start?: number }) {
  const { f } = useLocal(start)
  if (f < 0) return null
  const k = Math.min(1300 / w, 900 / h)
  return (
    <AbsoluteFill style={{ background: WALL, alignItems: 'center', justifyContent: 'center' }}>
      <Img src={staticFile(name)} style={{ width: w * k, height: h * k, borderRadius: 18, boxShadow: '0 30px 90px rgba(0,0,0,.45)' }} />
    </AbsoluteFill>
  )
}

/** Meme lettering: white capitals with a black outline. */
function MemeText({ text, top, size = 96 }: { text: string; top: boolean; size?: number }) {
  if (!text) return null
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        right: 60,
        [top ? 'top' : 'bottom']: 40,
        textAlign: 'center',
        fontFamily: MEME,
        fontSize: size,
        lineHeight: 1.05,
        color: '#fff',
        textTransform: 'uppercase',
        WebkitTextStroke: `${size / 18}px #000`,
        paintOrder: 'stroke fill',
        textShadow: '0 4px 12px rgba(0,0,0,.6)'
      }}
    >
      {text}
    </div>
  )
}

/** Where a picture of w x h sits when it is fitted whole into the 1920 x 1080 frame. */
function fitted(w: number, h: number, maxW = 1920, maxH = 1080) {
  const k = Math.min(maxW / w, maxH / h)
  return { x: (1920 - w * k) / 2, y: (1080 - h * k) / 2, w: w * k, h: h * k }
}

/** One caption placed in a box of the template (in frame pixels), sized to fit it. */
function MemeBoxText({ text, box, kind }: { text: string; box: { x: number; y: number; w: number; h: number }; kind: 'panel' | 'label' }) {
  if (!text) return null
  const pad = Math.min(box.w, box.h) * 0.08
  const w = box.w - pad * 2
  const h = box.h - pad * 2
  const panel = kind === 'panel'
  const fit = fitText(panel ? text : text.toUpperCase(), w, h, panel ? { max: 76, min: 22, cw: 0.56, lh: 1.15 } : { max: 104, min: 26, cw: 0.5, lh: 1.05 })
  return (
    <div
      style={{
        position: 'absolute',
        left: box.x + pad,
        top: box.y + pad,
        width: w,
        height: h,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        fontSize: fit.size,
        lineHeight: panel ? 1.15 : 1.05,
        ...(panel
          ? { fontFamily: UI, fontWeight: 800, color: '#111' }
          : { fontFamily: MEME, color: '#fff', textTransform: 'uppercase', WebkitTextStroke: `${fit.size / 18}px #000`, paintOrder: 'stroke fill', textShadow: '0 3px 10px rgba(0,0,0,.6)' })
      }}
    >
      <div>
        {fit.lines.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  )
}

/**
 * A meme: the template as big as the frame allows, over a blurred copy of itself, with its captions in the template's
 * own boxes (`template` is the Imgflip name and `texts` one caption per box, as listed for the part). Without a known
 * template, `top` and `bottom` go at the top and bottom of the picture itself.
 */
export function Meme({ name, w, h, template, texts, top = '', bottom = '', start = 0 }: { name: string; w?: number; h?: number; template?: string; texts?: string[]; top?: string; bottom?: string; start?: number }) {
  const { f } = useLocal(start, 6)
  if (f < 0) return null
  const r = w && h ? fitted(w, h) : { x: 0, y: 0, w: 1920, h: 1080 }
  const layout = memeLayout(template)
  const boxes = layout?.boxes ?? [
    { at: [0.02, 0.01, 0.96, 0.2] as const, kind: 'label' as const },
    { at: [0.02, 0.79, 0.96, 0.2] as const, kind: 'label' as const }
  ]
  const words = layout && texts?.length ? texts : [top, bottom]
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      {w && h && <Img src={staticFile(name)} style={{ position: 'absolute', inset: -60, width: 2040, height: 1200, objectFit: 'cover', filter: 'blur(40px) brightness(0.45)' }} />}
      <AbsoluteFill>
        <Img src={staticFile(name)} style={{ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, objectFit: 'contain' }} />
        {boxes.map((b, i) => (
          <MemeBoxText key={i} text={words[i] ?? ''} kind={b.kind} box={{ x: r.x + b.at[0] * r.w, y: r.y + b.at[1] * r.h, w: b.at[2] * r.w, h: b.at[3] * r.h }} />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/**
 * A reaction GIF (fetched as a looping MP4), as big as the frame allows over a blurred copy, with an optional caption
 * at the bottom of the picture.
 */
export function Gif({ name, w = 480, h = 270, text = '', start = 0 }: { name: string; w?: number; h?: number; text?: string; start?: number }) {
  const { f } = useLocal(start, 6)
  const cut = React.useContext(CutAt)
  if (f < 0) return null
  const r = fitted(w, h)
  const src = staticFile(name)
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      <Sequence from={Math.max(0, start - cut)} layout="none">
        <OffthreadVideo src={src} muted style={{ position: 'absolute', inset: -60, width: 2040, height: 1200, objectFit: 'cover', filter: 'blur(40px) brightness(0.45)' }} />
        <OffthreadVideo src={src} muted style={{ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h }} />
      </Sequence>
      {text && <MemeBoxText text={text} kind="label" box={{ x: r.x, y: r.y + r.h * 0.78, w: r.w, h: Math.min(r.h * 0.22, 220) }} />}
    </AbsoluteFill>
  )
}

/** A Fireship-style caption over a shot: a short sarcastic line in meme capitals, at the bottom (or top). */
export function Caption({ text, start = 0, top = false, size = 88 }: { text: string; start?: number; top?: boolean; size?: number }) {
  const { f } = useLocal(start, 5)
  if (f < 0) return null
  return (
    <AbsoluteFill>
      {/* A soft dark band behind the words, so they never fight with the text of a page under them. */}
      <div style={{ position: 'absolute', left: 0, right: 0, height: 380, [top ? 'top' : 'bottom']: 0, background: `linear-gradient(${top ? '0deg' : '180deg'}, rgba(0,0,0,0), rgba(0,0,0,.85))` }} />
      <MemeText text={text} top={top} size={size} />
    </AbsoluteFill>
  )
}

// VS Code Dark+ colours for Prism's token types.
const TOKEN: Record<string, string> = {
  keyword: '#569cd6', boolean: '#569cd6', 'class-name': '#4ec9b0', builtin: '#4ec9b0', function: '#dcdcaa', string: '#ce9178',
  'template-string': '#ce9178', number: '#b5cea8', comment: '#6a9955', operator: '#d4d4d4', punctuation: '#d4d4d4', property: '#9cdcfe',
  'attr-name': '#9cdcfe', tag: '#569cd6', variable: '#9cdcfe', regex: '#d16969', constant: '#4fc1ff', parameter: '#9cdcfe'
}
type Piece = { text: string; color: string }
function pieces(tokens: (string | Prism.Token)[], color = '#d4d4d4'): Piece[] {
  return tokens.flatMap((t) =>
    typeof t === 'string' ? [{ text: t, color }] : pieces(Array.isArray(t.content) ? (t.content as (string | Prism.Token)[]) : [t.content as string | Prism.Token], TOKEN[t.type] ?? color)
  )
}

/**
 * A code editor like VS Code: title bar, a tab with the file name, line numbers, real syntax colours, all there from
 * the first frame (Fireship shows code whole and points at it). `lines` highlights line numbers (1-based).
 */
export function Code({ code, lang = 'ts', file = 'index.ts', start = 0, cps = 45, lines = [], tree }: { code: string; lang?: string; file?: string; start?: number; cps?: number; lines?: number[]; tree?: string[] }) {
  const { f } = useLocal(start, 10)
  if (f < 0) return null
  void cps
  const grammar = Prism.languages[lang] ?? Prism.languages[{ js: 'javascript', sh: 'bash', shell: 'bash', py: 'python', yml: 'yaml' }[lang] ?? 'javascript']
  let left = code.length
  const typed = true
  const rows = code.split('\n')
  // As big as the editor allows: a short snippet is read from across the room, a long one still fits.
  const longest = Math.max(12, ...rows.map((r) => r.replace(/\t/g, '  ').length))
  const half = React.useContext(InSplit)
  // The longest line and its line-number column (3.9 characters' worth) must fit the editor: a line ran off the edge.
  const fits = (1560 - 40 - (tree ? 300 : 0)) / (longest * 0.6 + 3.9)
  const font = Math.round(Math.max(half ? 44 : 38, Math.min(half ? 84 : rows.length <= 3 ? 72 : 60, fits, 860 / (rows.length * 1.5))))
  return (
    <AbsoluteFill style={{ background: '#0b0b0d', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 1560, borderRadius: 14, overflow: 'hidden', background: '#1e1e1e', boxShadow: '0 40px 120px rgba(0,0,0,.6)' }}>
        <div style={{ height: 46, background: '#2d2d2d', display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px' }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
            <span key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
          ))}
          <span style={{ marginLeft: 18, background: '#1e1e1e', color: '#ffffff', fontFamily: UI, fontSize: 20, padding: '10px 22px 12px', borderTop: '2px solid #0078d4' }}>{file}</span>
        </div>
        <div style={{ display: 'flex' }}>
        {tree && (
          // The explorer: folders and files (indent with two spaces per level); the open file is lit.
          <div style={{ width: 300, background: '#252526', padding: '18px 0', fontFamily: UI, fontSize: 21, color: '#cccccc' }}>
            <div style={{ padding: '0 20px 12px', fontSize: 15, letterSpacing: 1, color: '#9d9d9d' }}>EXPLORER</div>
            {tree.map((t, i) => {
              const depth = (t.match(/^ */)?.[0].length ?? 0) / 2
              const label = t.trim()
              const open = label === file || label.endsWith('/' + file)
              return (
                <div key={i} style={{ padding: `5px 20px 5px ${20 + depth * 18}px`, background: open ? '#37373d' : undefined, color: label.endsWith('/') ? '#e8e8e8' : open ? '#ffffff' : '#cccccc' }}>
                  {label.endsWith('/') ? '▾ ' : '  '}
                  {label.replace(/\/$/, '')}
                </div>
              )
            })}
          </div>
        )}
        <div style={{ flex: 1, padding: '24px 0', fontFamily: CODE, fontSize: font, lineHeight: `${Math.round(font * 1.5)}px`, fontVariantLigatures: 'none' }}>
          {rows.map((row, i) => {
            const n = Math.min(row.length, left)
            left -= n + 1
            if (n <= 0 && left < 0 && i > 0) return null
            const shown = row.slice(0, n)
            const lit = typed && lines.includes(i + 1)
            return (
              <div key={i} style={{ display: 'flex', background: lit ? 'rgba(255,215,0,.12)' : undefined, borderLeft: lit ? '4px solid #ffd700' : '4px solid transparent' }}>
                <span style={{ width: font * 3, textAlign: 'right', paddingRight: font * 0.9, color: '#6e7681', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ whiteSpace: 'pre' }}>
                  {pieces(Prism.tokenize(shown, grammar)).map((pc, k) => (
                    <span key={k} style={{ color: pc.color }}>
                      {pc.text}
                    </span>
                  ))}
                  {!typed && n === row.length && left < 0 && <span style={{ background: '#aeafad', color: '#aeafad' }}>|</span>}
                </span>
              </div>
            )
          })}
        </div>
        </div>
      </div>
    </AbsoluteFill>
  )
}

/** A terminal: the command and its output, all there from the first frame. */
export function Shell({ command, output = [], start = 0, cps = 30 }: { command: string; output?: string[]; start?: number; cps?: number }) {
  const { f } = useLocal(start, 10)
  if (f < 0) return null
  void cps
  const typedChars = command.length
  const outN = output.length
  // As big as the window allows for all its lines (the final output, so the size never jumps while it types).
  const half = React.useContext(InSplit)
  const longest = Math.max(16, command.length + 4, ...output.map((l) => l.length))
  const lines = 1 + output.length
  const font = Math.round(Math.max(half ? 46 : 40, Math.min(half ? 84 : 64, 1380 / (longest * 0.6), 820 / (lines * 1.5))))
  return (
    <AbsoluteFill style={{ background: '#0b0b0d', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 1500, borderRadius: 14, background: '#0d1117', boxShadow: '0 40px 120px rgba(0,0,0,.6)', padding: `${font}px ${font * 1.2}px`, fontFamily: CODE, fontSize: font, lineHeight: `${Math.round(font * 1.5)}px`, color: '#c9d1d9', whiteSpace: 'pre', overflow: 'hidden' }}>
        <div>
          <span style={{ color: '#3fb950' }}>~ $ </span>
          {command.slice(0, typedChars)}
          {typedChars < command.length && <span style={{ background: '#c9d1d9' }}> </span>}
        </div>
        {output.slice(0, outN).map((l, i) => (
          <div key={i} style={{ whiteSpace: 'pre', color: /error|fail/i.test(l) ? '#ff7b72' : /ok|done|success|✓/i.test(l) ? '#3fb950' : '#8b949e' }}>
            {l}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  )
}

/** The height on screen a box's label gets at least, once the diagram is zoomed to the frame, so it reads on a phone. */
const PHONE_LABEL = 64

/**
 * Boxes laid out far apart (a PC at the left edge, a monitor at the right) leave the diagram no room to zoom, so on a
 * phone their labels are specks. This pulls everything toward the middle (positions only, never sizes) until the
 * labels come out big enough after the zoom, never so close that two boxes touch.
 */
function tighten(children: React.ReactNode, fill: number): React.ReactNode {
  const boxes: { x: number; y: number; w: number; h: number; font: number }[] = []
  const collect = (node: React.ReactNode) =>
    React.Children.forEach(node, (c) => {
      if (!React.isValidElement(c)) return
      const p = c.props as Record<string, unknown>
      if (c.type === Box && typeof p.x === 'number' && typeof p.y === 'number') boxes.push({ x: p.x, y: p.y, ...boxSize(String(p.label ?? ''), p.w as number | undefined, p.h as number | undefined) })
      if (p.children && c.type !== Diagram) collect(p.children as React.ReactNode)
    })
  collect(children)
  if (boxes.length < 2) return children
  const x0 = Math.min(...boxes.map((b) => b.x - b.w / 2))
  const x1 = Math.max(...boxes.map((b) => b.x + b.w / 2))
  const y0 = Math.min(...boxes.map((b) => b.y - b.h / 2))
  const y1 = Math.max(...boxes.map((b) => b.y + b.h / 2))
  const font = Math.min(...boxes.map((b) => b.font))
  const zoom = Math.min((1920 * fill) / (x1 - x0), (1080 * fill) / (y1 - y0), 1.8)
  if (font * zoom >= PHONE_LABEL) return children
  // The spread that would give the labels their size: the centres' span shrunk by q, the box sizes kept.
  const want = Math.min(1.8, PHONE_LABEL / font)
  const bw = Math.max(...boxes.map((b) => b.w))
  const bh = Math.max(...boxes.map((b) => b.h))
  const sx = x1 - x0 - bw
  const sy = y1 - y0 - bh
  let q = Math.min(sx > 0 ? ((1920 * fill) / want - bw) / sx : 1, sy > 0 ? ((1080 * fill) / want - bh) / sy : 1, 1)
  // Never closer than a gap between any two boxes (room for an arrow and its label).
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const b = boxes[j]
      const dx = Math.abs(a.x - b.x)
      const dy = Math.abs(a.y - b.y)
      const needX = dx ? ((a.w + b.w) / 2 + 150) / dx : Infinity
      const needY = dy ? ((a.h + b.h) / 2 + 110) / dy : Infinity
      q = Math.max(q, Math.min(needX, needY))
    }
  q = Math.max(0.3, Math.min(1, q))
  if (q >= 0.98) return children
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const at = (x: number, y: number): [number, number] => [cx + (x - cx) * q, cy + (y - cy) * q]
  const move = (node: React.ReactNode): React.ReactNode =>
    React.Children.map(node, (c) => {
      if (!React.isValidElement(c) || c.type === Diagram) return c
      const p = c.props as Record<string, unknown>
      const next: Record<string, unknown> = {}
      if (typeof p.x === 'number' && typeof p.y === 'number') [next.x, next.y] = at(p.x, p.y)
      for (const k of ['from', 'to'])
        if (Array.isArray(p[k]) && typeof (p[k] as number[])[0] === 'number') next[k] = at((p[k] as number[])[0], (p[k] as number[])[1])
      return React.cloneElement(c as React.ReactElement<Record<string, unknown>>, next, p.children ? move(p.children as React.ReactNode) : undefined)
    })
  return move(children)
}

/**
 * A diagram on black that fills the frame: it finds where its Boxes, Flows, Loops and Labels are (from their x, y, w,
 * h, from and to) and zooms and centres them to fill about 88% of the frame, however small they were placed.
 */
export function Diagram({ children: given, bg = '#000', fill = 0.88 }: { children: React.ReactNode; bg?: string; fill?: number }) {
  const children = tighten(given, fill)
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
  const add = (x: number, y: number) => {
    b.x0 = Math.min(b.x0, x)
    b.y0 = Math.min(b.y0, y)
    b.x1 = Math.max(b.x1, x)
    b.y1 = Math.max(b.y1, y)
  }
  const boxes: Rect[] = []
  const walk = (node: React.ReactNode) =>
    React.Children.forEach(node, (c) => {
      if (!React.isValidElement(c)) return
      const p = c.props as Record<string, unknown>
      const num = (v: unknown) => typeof v === 'number' && isFinite(v)
      if (c.type === Box && num(p.x) && num(p.y)) {
        const { w, h } = boxSize(String(p.label ?? ''), p.w as number | undefined, p.h as number | undefined)
        add((p.x as number) - w / 2, (p.y as number) - h / 2)
        add((p.x as number) + w / 2, (p.y as number) + h / 2)
        boxes.push({ x0: (p.x as number) - w / 2, y0: (p.y as number) - h / 2, x1: (p.x as number) + w / 2, y1: (p.y as number) + h / 2 })
      } else if (c.type === Sticker && num(p.x) && num(p.y)) {
        const h = (p.h as number) ?? 760
        add((p.x as number) - h * 0.7, (p.y as number) - h * 0.6)
        add((p.x as number) + h * 0.7, (p.y as number) + h * 0.6)
      } else if (c.type === Loop) {
        const r = (p.r as number) ?? 300
        const x = (p.x as number) ?? 960
        const y = (p.y as number) ?? 540
        add(x - r - 170, y - r - 52)
        add(x + r + 170, y + r + 52)
      } else if (c.type === Flow && Array.isArray(p.from) && Array.isArray(p.to)) {
        add(p.from[0], p.from[1] - 50)
        add(p.to[0], p.to[1])
      } else if (num(p.x) && num(p.y) && c.type !== Diagram) add(p.x as number, p.y as number)
      if (p.children) walk(p.children as React.ReactNode)
    })
  walk(children)
  // Arrows run from box edge to box edge, never through a label.
  const snap = (node: React.ReactNode): React.ReactNode =>
    React.Children.map(node, (c) => {
      if (!React.isValidElement(c)) return c
      const p = c.props as { from?: [number, number]; to?: [number, number]; children?: React.ReactNode }
      if (c.type === Flow && Array.isArray(p.from) && Array.isArray(p.to)) return React.cloneElement(c as React.ReactElement<Record<string, unknown>>, clipToBoxes(p.from, p.to, boxes))
      if (p.children && c.type !== Diagram) return React.cloneElement(c as React.ReactElement<Record<string, unknown>>, {}, snap(p.children))
      return c
    })
  const drawn = snap(children)
  let transform: string | undefined
  if (isFinite(b.x0) && b.x1 > b.x0 && b.y1 > b.y0) {
    const k = Math.min((1920 * fill) / (b.x1 - b.x0), (1080 * fill) / (b.y1 - b.y0), 1.8)
    const cx = (b.x0 + b.x1) / 2
    const cy = (b.y0 + b.y1) / 2
    transform = `translate(${960 - cx * k}px, ${540 - cy * k}px) scale(${k})`
  }
  return (
    <AbsoluteFill style={{ background: bg, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform, transformOrigin: '0 0' }}>{drawn}</AbsoluteFill>
    </AbsoluteFill>
  )
}

/** A flat diagram box (like Fireship's company boxes): a solid colour, the name in dark capitals. */
/** A box's size and type size for its label: wide enough that the label is never cut off (shrinking type past 760). */
export function boxSize(label: string, w = 420, h = 160) {
  const font = Math.min(48, 820 / Math.max(1, label.length * 0.6))
  return { w: Math.max(w, Math.min(900, label.length * font * 0.6 + 90)), h, font }
}

export function Box({ x, y, w: w0, h: h0, label, color = '#76b900', start = 0, sub, icon, pulse = false, solid = false }: { x: number; y: number; w?: number; h?: number; label: string; color?: string; start?: number; sub?: string; icon?: string; pulse?: boolean; solid?: boolean }) {
  const { f } = useLocal(start, 8)
  if (f < 0) return null
  const { w, h, font } = boxSize(label, w0, h0)
  return (
    <div
      style={{
        position: 'absolute',
        left: x - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
        background: solid ? color : `color-mix(in srgb, ${color} 14%, #121214)`,
        border: `3px solid ${color}`,
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: CODE,
        fontWeight: 700,
        color: solid ? '#0b0b0d' : '#f4f4f5',
        fontSize: font,
        whiteSpace: 'nowrap',
        boxShadow: solid ? undefined : `0 0 40px color-mix(in srgb, ${color} 18%, transparent)`
      }}
    >
      {/* The busy one: a second ring around it, held still. */}
      {pulse && <div style={{ position: 'absolute', inset: -16, border: `4px solid ${color}`, borderRadius: 18, opacity: 0.55 }} />}
      {icon && <span style={{ fontSize: 40, lineHeight: 1, marginBottom: 6 }}>{icon}</span>}
      {label}
      {sub && <span style={{ fontSize: Math.round(font * 0.66), fontWeight: 500, marginTop: 6, color: solid ? '#0b0b0d' : '#a1a1aa' }}>{sub}</span>}
    </div>
  )
}

/**
 * A dated timeline (how a story unfolded): paper cards stacked one under another, each popping in on its turn
 * (`every` frames, or `at` frames per item), the list moving up so the newest stays in view.
 */
export function Timeline({ items, start = 0, every = 24, at }: { items: { date: string; text: string }[]; start?: number; every?: number; at?: number[] }) {
  const { f } = useLocal(start, 10)
  if (f < 0) return null
  const when = (i: number) => (at?.[i] !== undefined ? at[i] - start : i * every)
  const shown = items.filter((_, i) => f >= when(i)).length
  const gap = 26
  // About 52 characters fit on a line of a card; each card is as tall as its lines.
  const heights = items.map((it) => 96 + Math.max(1, Math.ceil(it.text.length / 44)) * 70)
  const tops = heights.map((_, i) => heights.slice(0, i).reduce((n, h) => n + h + gap, 0))
  const visible = 5
  const first = Math.max(0, shown - visible)
  const shift = tops[first] ?? 0
  const span = shown ? tops[shown - 1] + heights[shown - 1] - shift : 0
  const top = 540 - span / 2
  return (
    <AbsoluteFill style={{ background: '#0b0b0d' }}>
      {items.map((it, i) => {
        if (f < when(i)) return null
        const y = top + tops[i] - shift
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 960 - 740,
              top: y,
              width: 1480,
              height: heights[i],
              background: '#f6f1e7',
              borderRadius: 10,
              padding: '22px 36px',
              boxSizing: 'border-box',
              boxShadow: '0 20px 50px rgba(0,0,0,.45)',
              transform: `rotate(${i % 2 ? 0.8 : -0.8}deg)`,
              borderLeft: '8px solid #c0392b'
            }}
          >
            <div style={{ fontFamily: CODE, fontSize: 34, color: '#c0392b', letterSpacing: 1 }}>{it.date}</div>
            <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 56, color: '#1a1a1a', marginTop: 8, lineHeight: 1.25 }}>{it.text}</div>
          </div>
        )
      })}
    </AbsoluteFill>
  )
}

/**
 * A comparison chart (CodeHead's "time to crack"): one bar per item growing in turn, its value written after it.
 * `log` for values that span many orders of magnitude (seconds against trillions of years).
 */
export function Bars({ items, title, log = false, start = 0, every = 26, color = '#f5b74e' }: { items: { label: string; value: number; text?: string; hot?: boolean }[]; title?: string; log?: boolean; start?: number; every?: number; color?: string }) {
  const { f } = useLocal(start, 10)
  if (f < 0) return null
  const scale = (v: number) => (log ? Math.log10(Math.max(1, v)) : v)
  const max = Math.max(...items.map((i) => scale(i.value)), 1)
  const rowH = Math.min(230, 700 / Math.max(1, items.length))
  const top = 540 - (items.length * rowH) / 2 + (title ? 60 : 0)
  const longLabel = Math.max(6, ...items.map((i) => i.label.length))
  const longText = Math.max(0, ...items.map((i) => (i.text ?? '').length))
  const label = Math.round(Math.min(60, Math.max(40, Math.min(rowH * 0.32, 530 / (longLabel * 0.64), 360 / Math.max(1, longText * 0.6)))))
  // Label column, bar and value, as one block in the middle of the frame.
  const labelW = Math.min(600, longLabel * label * 0.64 + 64)
  const left = Math.max(40, (1920 - (labelW + 900 + longText * label * 0.6 + 40)) / 2)
  return (
    <AbsoluteFill style={{ background: '#121214' }}>
      {title && <div style={{ position: 'absolute', top: top - 150, left: 0, right: 0, textAlign: 'center', fontFamily: UI, fontWeight: 800, fontSize: 68, color: '#fafafa' }}>{title}</div>}
      {items.map((it, i) => {
        const p = on(f, i * every)
        if (p <= 0) return null
        const len = Math.max(14, (scale(it.value) / max) * 900)
        const c = it.hot ? '#ff6b4a' : color
        return (
          <div key={i} style={{ position: 'absolute', top: top + i * rowH, left, right: 0, height: rowH, display: 'flex', alignItems: 'center' }}>
            <div style={{ width: labelW, paddingRight: 36, boxSizing: 'border-box', textAlign: 'right', fontFamily: CODE, fontSize: label, color: '#e4e4e7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</div>
            <div style={{ width: len, height: Math.min(96, rowH * 0.55), background: `color-mix(in srgb, ${c} 35%, transparent)`, border: `4px solid ${c}`, borderRadius: 8 }} />
            {it.text && <div style={{ marginLeft: 28, fontFamily: CODE, fontWeight: 700, fontSize: label, color: c, whiteSpace: 'nowrap' }}>{it.text}</div>}
          </div>
        )
      })}
    </AbsoluteFill>
  )
}

/** An arrow between two points, with a small label on the way (INVESTMENT, LOAN, RENTS…). It is simply there on its frame. */
export function Flow({ from, to, label, color = '#3ddc97', start = 0, dur = 14, dashed = false, packets = 0, packet, speed = 40 }: { from: [number, number]; to: [number, number]; label?: string; color?: string; start?: number; dur?: number; dashed?: boolean; packets?: number; packet?: string; speed?: number }) {
  const { f, t } = useLocal(start, dur)
  if (f < 0) return null
  void packet
  void speed
  const [x1, y1] = from
  const [x2, y2] = to
  const ex = x1 + (x2 - x1) * t
  const ey = y1 + (y2 - y1) * t
  const a = Math.atan2(y2 - y1, x2 - x1)
  const len = Math.hypot(x2 - x1, y2 - y1) || 1
  let nx = -(y2 - y1) / len
  let ny = (x2 - x1) / len
  if (ny > 0 || (ny === 0 && nx > 0)) (nx = -nx), (ny = -ny)
  const off = 16 + Math.abs(nx) * 0.3 * (label?.length ?? 0) * 19
  const lx = (x1 + x2) / 2 + nx * off
  const ly = (y1 + y2) / 2 + ny * (off > 30 ? 30 : off)
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      <line x1={x1} y1={y1} x2={ex} y2={ey} stroke={color} strokeWidth={4} strokeDasharray={dashed ? '12 10' : undefined} />
      {t > 0.95 && <path d={`M${x2} ${y2}l${-18 * Math.cos(a - 0.45)} ${-18 * Math.sin(a - 0.45)}M${x2} ${y2}l${-18 * Math.cos(a + 0.45)} ${-18 * Math.sin(a + 0.45)}`} stroke={color} strokeWidth={4} fill="none" />}
      {/* Packets: still dots along the arrow (what flows), no travelling. */}
      {Array.from({ length: packets }, (_, i) => {
        const p = (i + 1) / (packets + 1)
        return <circle key={i} cx={x1 + (x2 - x1) * p} cy={y1 + (y2 - y1) * p} r={9} fill={color} />
      })}
      {label && t > 0.5 && (
        // Beside the arrow, on its upper side, so the line never runs through the word.
        <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontFamily={CODE} fontWeight={700} fontSize={Math.max(34, Math.min(44, (len * 0.95) / Math.max(1, (label?.length ?? 1) * 0.62)))} fill={color} letterSpacing={1} stroke="#000" strokeWidth={8} paintOrder="stroke">
          {label.toUpperCase()}
        </text>
      )}
    </svg>
  )
}

/** A cycle: things around a ring (build → test → deploy → …), each appearing on its beat. */
export function Loop({ items, x = 960, y = 540, r = 300, color = '#3ddc97', start = 0, every = 8, speed = 90 }: { items: string[]; x?: number; y?: number; r?: number; color?: string; start?: number; every?: number; speed?: number }) {
  const { f, t } = useLocal(start, 16)
  if (f < 0) return null
  const n = items.length
  const at = (k: number) => -Math.PI / 2 + (k / n) * Math.PI * 2
  void speed
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <circle cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth={4} strokeDasharray={`${2 * Math.PI * r * t} 99999`} transform={`rotate(-90 ${x} ${y})`} opacity={0.6} />
      </svg>
      {items.map((label, k) => {
        if (!on(f, k * every)) return null
        return (
          <div key={k} style={{ position: 'absolute', left: x + r * Math.cos(at(k)) - 190, top: y + r * Math.sin(at(k)) - 56, width: 380, height: 112, background: '#16161a', border: `3px solid ${color}`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: CODE, fontWeight: 700, fontSize: 42, color: '#fff' }}>
            {label.toUpperCase()}
          </div>
        )
      })}
    </AbsoluteFill>
  )
}

interface ChartData {
  title: string
  unit?: string
  points?: [number, number][]
  last?: number
  change?: number
  stats?: { label: string; value: number }[]
  source: string
}

/** Reads a chart file (public/m/*.json) once; the render waits for it. */
function useChart(name: string): ChartData | null {
  const [data, setData] = React.useState<ChartData | null>(null)
  const [handle] = React.useState(() => delayRender(`chart ${name}`))
  React.useEffect(() => {
    fetch(staticFile(name))
      .then((r) => r.json())
      .then((d: ChartData) => {
        setData(d)
        continueRender(handle)
      })
      .catch((e) => cancelRender(e))
  }, [name, handle])
  return data
}

const short = (n: number) => (Math.abs(n) >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e4 ? `${(n / 1e3).toFixed(0)}K` : n >= 100 ? n.toFixed(0) : n.toFixed(2))

/** A real line chart (stock price, weekly downloads), the last value and the change in green or red. */
export function Chart({ name, start = 0, dur = 40, color }: { name: string; start?: number; dur?: number; color?: string }) {
  const data = useChart(name)
  const { f, t } = useLocal(start, dur)
  if (f < 0 || !data) return null
  // Numbers without a line (a repository) are shown as Stats.
  if (!data.points?.length) return data.stats ? <Stats name={name} start={start} /> : null
  const pts = data.points
  const ys = pts.map((p) => p[1])
  const lo = Math.min(...ys)
  const hi = Math.max(...ys)
  const W = 1500
  const H = 560
  const X = (i: number) => 210 + (i / (pts.length - 1)) * W
  const Y = (v: number) => 860 - ((v - lo) / (hi - lo || 1)) * H
  const up = (data.change ?? 0) >= 0
  const line = color ?? (up ? '#3ddc97' : '#ff4d4d')
  const shown = Math.max(2, Math.ceil(pts.length * t))
  const d = pts.slice(0, shown).map((p, i) => `${i ? 'L' : 'M'}${X(i)} ${Y(p[1])}`).join('')
  const end = pts[shown - 1]
  const value = (data.last ?? end[1]) * t
  const year = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  return (
    <AbsoluteFill style={{ background: '#0b0b0d' }}>
      <div style={{ position: 'absolute', left: 210, top: 90, fontFamily: UI, fontWeight: 800, fontSize: 64, color: '#fff' }}>{data.title}</div>
      <div style={{ position: 'absolute', right: 210, top: 70, textAlign: 'right', fontFamily: CODE, fontWeight: 700 }}>
        <div style={{ fontSize: 84, color: '#fff' }}>
          {data.unit === '$' ? '$' : ''}
          {short(value)}
          {data.unit && data.unit !== '$' ? ` ${data.unit}` : ''}
        </div>
        {data.change !== undefined && t > 0.8 && (
          <div style={{ fontSize: 40, color: up ? '#3ddc97' : '#ff4d4d' }}>
            {up ? '▲' : '▼'} {Math.abs(data.change * 100).toFixed(0)}%
          </div>
        )}
      </div>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {[0, 0.5, 1].map((k) => (
          <g key={k}>
            <line x1={210} x2={210 + W} y1={Y(lo + (hi - lo) * k)} y2={Y(lo + (hi - lo) * k)} stroke="#26262c" strokeWidth={2} />
            <text x={190} y={Y(lo + (hi - lo) * k) + 8} textAnchor="end" fontFamily={CODE} fontSize={32} fill="#9a9aa2">
              {short(lo + (hi - lo) * k)}
            </text>
          </g>
        ))}
        <path d={`${d}L${X(shown - 1)} 860L210 860Z`} fill={line} opacity={0.12} />
        <path d={d} fill="none" stroke={line} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={X(shown - 1)} cy={Y(end[1])} r={12} fill={line} style={{ filter: `drop-shadow(0 0 12px ${line})` }} />
        <text x={210} y={910} fontFamily={CODE} fontSize={32} fill="#9a9aa2">{year(pts[0][0])}</text>
        <text x={210 + W} y={910} textAnchor="end" fontFamily={CODE} fontSize={32} fill="#9a9aa2">{year(pts[pts.length - 1][0])}</text>
      </svg>
      <div style={{ position: 'absolute', left: 210, bottom: 60, fontFamily: UI, fontSize: 20, color: '#55555c' }}>Source: {data.source}</div>
    </AbsoluteFill>
  )
}

/** Big numbers (GitHub stars, forks, issues), one after another on their beats. */
export function Stats({ name, start = 0, every = 10 }: { name: string; start?: number; every?: number }) {
  const data = useChart(name)
  const { f } = useLocal(start, 1)
  if (f < 0 || !data) return null
  if (!data.stats) return data.points ? <Chart name={name} start={start} /> : null
  return (
    <AbsoluteFill style={{ background: '#0b0b0d', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: CODE, fontWeight: 700, fontSize: 58, color: '#9d9d9d', marginBottom: 60 }}>{data.title}</div>
      <div style={{ display: 'flex', gap: 120 }}>
        {data.stats.map((s, i) => {
          const p = on(f, i * every)
          return (
            <div key={i} style={{ textAlign: 'center', opacity: p }}>
              <div style={{ fontFamily: MEME, fontSize: 150, color: i ? '#fff' : '#ffd400', lineHeight: 1 }}>{short(Math.round(s.value))}</div>
              <div style={{ fontFamily: UI, fontWeight: 700, fontSize: 46, color: '#9d9d9d', marginTop: 14 }}>{s.label}</div>
            </div>
          )
        })}
      </div>
      <div style={{ position: 'absolute', bottom: 60, fontFamily: UI, fontSize: 20, color: '#55555c' }}>Source: {data.source}</div>
    </AbsoluteFill>
  )
}

/** A pointing hand at (x, y), there on its frame. */
export function Hand({ x, y, start = 0, dir = 'left' }: { x: number; y: number; start?: number; dir?: 'left' | 'right' | 'up' | 'down' }) {
  const { f } = useLocal(start, 10)
  if (f < 0) return null
  const rot = { left: 0, right: 180, up: 90, down: -90 }[dir]
  return <div style={{ position: 'absolute', left: x - 50, top: y - 50, fontSize: 100, transform: `rotate(${rot}deg) scaleX(-1)`, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.6))' }}>👉</div>
}

/** A red circle drawn around something, like a marker on a screenshot. */
export function Circle({ x, y, rx = 220, ry = 90, start = 0, color = '#ff2d2d' }: { x: number; y: number; rx?: number; ry?: number; start?: number; color?: string }) {
  const { f } = useLocal(start, 14)
  if (f < 0) return null
  const len = Math.PI * 2 * Math.sqrt((rx * rx + ry * ry) / 2) * 1.1
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
      <path
        d={`M${x - rx} ${y} C${x - rx} ${y - ry * 1.1} ${x + rx * 1.05} ${y - ry * 1.05} ${x + rx} ${y} C${x + rx * 0.98} ${y + ry * 1.1} ${x - rx * 1.1} ${y + ry} ${x - rx * 0.92} ${y - ry * 0.25}`}
        fill="none"
        stroke={color}
        strokeWidth={9}
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * A cut-out (a person, a product, a logo) as a sticker: a white outline and a shadow, slapped on top, Fireship's
 * collage. It is simply there on its frame, or `from` an edge of the frame it slides in over 4 frames; `glow` puts a
 * coloured halo round the outline. Put several on a coloured background for the Photoshop look.
 */
export function Sticker({ name, x = 960, y = 560, h = 760, rotate = -4, start = 0, flip = false, from, glow }: { name: string; x?: number; y?: number; h?: number; rotate?: number; start?: number; flip?: boolean; from?: 'left' | 'right' | 'top' | 'bottom'; glow?: string }) {
  const { f } = useLocal(start)
  if (f < 0) return null
  const o = 7
  const outline = [`${o}px 0`, `-${o}px 0`, `0 ${o}px`, `0 -${o}px`, `${o * 0.7}px ${o * 0.7}px`, `-${o * 0.7}px ${o * 0.7}px`, `${o * 0.7}px -${o * 0.7}px`, `-${o * 0.7}px -${o * 0.7}px`]
    .map((d) => `drop-shadow(${d} 0 #fff)`)
    .join(' ')
  const halo = glow ? ` drop-shadow(0 0 14px ${glow}) drop-shadow(0 0 30px ${glow})` : ''
  // Off the frame to its place: the whole way over 4 frames, fast out, no bounce.
  const t = from ? interpolate(f, [0, 4], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 1
  const away = { left: [-(x + h), 0], right: [1920 - x + h, 0], top: [0, -(y + h)], bottom: [0, 1080 - y + h] }[from ?? 'left']
  const dx = from ? away[0] * (1 - t) : 0
  const dy = from ? away[1] * (1 - t) : 0
  const move = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))${flip ? ' scaleX(-1)' : ''} rotate(${rotate}deg)`
  // A logo ("-logo" file) sits on a white card, so dark lettering shows on the black frame.
  if (/-logo\.\w+$/.test(name))
    return (
      <div style={{ position: 'absolute', left: x, top: y, transform: move, background: '#fff', borderRadius: h * 0.08, padding: h * 0.12, boxShadow: glow ? `0 0 0 6px ${glow}, 0 0 40px ${glow}` : '0 18px 40px rgba(0,0,0,.5)' }}>
        <Img src={staticFile(name)} style={{ display: 'block', height: h * 0.76, maxWidth: h * 2.6, objectFit: 'contain' }} />
      </div>
    )
  return <Img src={staticFile(name)} style={{ position: 'absolute', left: x, top: y, height: h, transform: move, filter: `${outline}${halo} drop-shadow(0 18px 24px rgba(0,0,0,.45))` }} />
}

/** A tag on something: bold capitals on a solid colour, with an optional pointer line to (toX, toY). */
export function Label({ x, y, text, color = '#ff2d2d', ink = '#fff', to, start = 0, rotate = -3, size = 56 }: { x: number; y: number; text: string; color?: string; ink?: string; to?: [number, number]; start?: number; rotate?: number; size?: number }) {
  const { f, t } = useLocal(start, 6)
  if (f < 0) return null
  return (
    <>
      {to && (
        <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
          <line x1={x} y1={y} x2={x + (to[0] - x) * t} y2={y + (to[1] - y) * t} stroke={color} strokeWidth={6} strokeLinecap="round" />
          {t > 0.95 && <circle cx={to[0]} cy={to[1]} r={9} fill={color} />}
        </svg>
      )}
      <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) rotate(${rotate}deg) scale(${0.7 + 0.3 * t})`, opacity: t, background: color, color: ink, fontFamily: MEME, fontSize: size, padding: `${size * 0.15}px ${size * 0.4}px`, textTransform: 'uppercase', whiteSpace: 'nowrap', boxShadow: '0 8px 20px rgba(0,0,0,.4)' }}>
        {text}
      </div>
    </>
  )
}

/**
 * A big title card on black: a few words, one in the accent. With `num` it is Fireship's chapter card: the number in a
 * red square, the title huge in white condensed capitals beside it.
 */
export function TitleCard({ text, accent, start = 0, color = '#ff8a1f', num }: { text: string; accent?: string; start?: number; color?: string; num?: number | string }) {
  const { f } = useLocal(start, 8)
  if (f < 0) return null
  const words = text.split(/(\s+)/).map((wd, i) => (
    <span key={i} style={{ color: accent && wd.toLowerCase() === accent.toLowerCase() ? color : undefined }}>
      {wd}
    </span>
  ))
  if (num !== undefined) {
    const size = Math.min(210, 1400 / Math.max(4, text.length * 0.5))
    return (
      <AbsoluteFill style={{ background: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 56, padding: '0 120px' }}>
          <div style={{ flexShrink: 0, width: 230, height: 230, background: '#e5252a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MEME, fontSize: 170, color: '#fff' }}>{`${num}.`.replace(/\.\.$/, '.')}</div>
          <div style={{ fontFamily: MEME, fontSize: size, lineHeight: 0.95, color: '#fff', textTransform: 'uppercase' }}>{words}</div>
        </div>
      </AbsoluteFill>
    )
  }
  return (
    <AbsoluteFill style={{ background: '#000', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: MEME, fontSize: 150, color: '#fff', textTransform: 'uppercase', textAlign: 'center', padding: '0 120px', lineHeight: 1.05 }}>{words}</div>
    </AbsoluteFill>
  )
}

/**
 * Fireship's quote card: someone's words in white on a black box over the picture behind (or the wallpaper), the
 * words that matter (`mark`) cut out in a white highlight, and who said it under it.
 */
export function Quote({ text, mark, who, bg, start = 0 }: { text: string; mark?: string; who?: string; bg?: string; start?: number }) {
  const { f } = useLocal(start, 8)
  if (f < 0) return null
  const size = Math.round(Math.max(56, Math.min(84, 2900 / Math.max(20, text.length))))
  const at = mark ? text.toLowerCase().indexOf(mark.toLowerCase()) : -1
  const body =
    at < 0 ? (
      text
    ) : (
      <>
        {text.slice(0, at)}
        <span style={{ background: '#fff', color: '#000', padding: '0 10px', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}>{text.slice(at, at + mark!.length)}</span>
        {text.slice(at + mark!.length)}
      </>
    )
  return (
    <AbsoluteFill style={{ background: WALL, alignItems: 'center', justifyContent: 'center' }}>
      {bg && <Img src={staticFile(bg)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.55)' }} />}
      <div style={{ position: 'relative', maxWidth: 1400, background: '#000', padding: '64px 80px', boxShadow: '0 30px 90px rgba(0,0,0,.5)' }}>
        <div style={{ fontFamily: UI, fontWeight: 700, fontSize: size, lineHeight: 1.35, color: '#fff' }}>{body}</div>
        {who && <div style={{ fontFamily: CODE, fontSize: 32, color: '#a1a1aa', marginTop: 34 }}>— {who}</div>}
      </div>
    </AbsoluteFill>
  )
}

// ---------- more ways to teach an idea (each a different shape, so no visual repeats) ----------

const PANEL = '#121214'
const AMBER = '#f5b74e'
const HOT = '#ff6b4a'
const DIM = '#3f3f46'

/** A title over a teaching visual, the same everywhere. */
function VisualTitle({ text }: { text?: string }) {
  if (!text) return null
  return <div style={{ position: 'absolute', top: 90, left: 0, right: 0, textAlign: 'center', fontFamily: UI, fontWeight: 800, fontSize: 84, color: '#fafafa' }}>{text}</div>
}

/**
 * A share of a whole as a grid of squares (40 of every 100 wafers, 1 in 3 users): `lit` of `total` light up in turn,
 * the number written big beside it.
 */
export function Dots({ total = 100, lit, title, label, start = 0, color = AMBER, dur = 40 }: { total?: number; lit: number; title?: string; label?: string; start?: number; color?: string; dur?: number }) {
  const { f } = useLocal(start, 10)
  if (f < 0) return null
  // A square-ish grid (10 x 10 for a hundred), as big as the left two thirds allow.
  const cols = total <= 24 ? Math.min(total, 8) : total <= 100 ? 10 : 20
  const rows = Math.ceil(total / cols)
  const size = Math.min(72, 900 / cols - 8, (title ? 760 : 860) / rows - 8)
  void dur
  const lightN = lit
  const share = Math.round((lit / total) * 100)
  return (
    <AbsoluteFill style={{ background: PANEL }}>
      <VisualTitle text={title} />
      <div style={{ position: 'absolute', left: 180, top: 540 - (rows * (size + 8)) / 2 + (title ? 70 : 0), display: 'grid', gridTemplateColumns: `repeat(${cols}, ${size}px)`, gap: 8 }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} style={{ width: size, height: size, borderRadius: size * 0.2, background: i < lightN ? color : 'transparent', border: `3px solid ${i < lightN ? color : DIM}`, boxSizing: 'border-box' }} />
        ))}
      </div>
      <div style={{ position: 'absolute', right: 160, top: 540 + (title ? 40 : 0), transform: 'translateY(-50%)', textAlign: 'right' }}>
        <div style={{ fontFamily: UI, fontWeight: 800, fontSize: 200, lineHeight: 1, color }}>{share}%</div>
        {label && <div style={{ fontFamily: UI, fontSize: 58, color: '#d4d4d8', marginTop: 16, maxWidth: 700 }}>{label}</div>}
      </div>
    </AbsoluteFill>
  )
}

/**
 * Two things side by side, row by row (a table that builds): headers `a` and `b`, each row a label and a value for
 * each. "yes"/"no" (or ✓/✗) show as green ticks and red crosses. `win` marks the column that comes out ahead.
 */
export function Compare({ a, b, rows, title, start = 0, every = 16, win }: { a: string; b: string; rows: { label: string; a: string; b: string }[]; title?: string; start?: number; every?: number; win?: 'a' | 'b' }) {
  const { f } = useLocal(start, 10)
  if (f < 0) return null
  const cell = (v: string) => {
    const yes = /^(yes|✓|true)$/i.test(v.trim())
    const no = /^(no|✗|×|false)$/i.test(v.trim())
    return <span style={{ color: yes ? '#3ddc84' : no ? HOT : '#f4f4f5', fontSize: yes || no ? 76 : 56, fontWeight: 700 }}>{yes ? '✓' : no ? '✗' : v}</span>
  }
  const rowH = Math.min(150, 680 / Math.max(1, rows.length))
  const top = 540 - ((rows.length + 1) * rowH) / 2 + (title ? 50 : 0)
  const col = (side: 'a' | 'b') => ({ width: 520, textAlign: 'center' as const, borderRadius: 14, background: win === side ? 'color-mix(in srgb, #3ddc84 10%, transparent)' : undefined })
  return (
    <AbsoluteFill style={{ background: PANEL }}>
      <VisualTitle text={title} />
      <div style={{ position: 'absolute', left: 140, right: 140, top, fontFamily: UI }}>
        <div style={{ display: 'flex', height: rowH, alignItems: 'center', fontWeight: 800, fontSize: 64, color: '#fafafa' }}>
          <div style={{ flex: 1 }} />
          <div style={{ ...col('a'), color: win === 'a' ? '#3ddc84' : '#fafafa' }}>{a}</div>
          <div style={{ ...col('b'), color: win === 'b' ? '#3ddc84' : '#fafafa' }}>{b}</div>
        </div>
        {rows.map((r, i) => {
          const p = on(f, 10 + i * every)
          return (
            <div key={i} style={{ display: 'flex', height: rowH, alignItems: 'center', borderTop: `2px solid ${DIM}`, opacity: p }}>
              <div style={{ flex: 1, fontSize: 54, color: '#c4c4cc', fontFamily: CODE }}>{r.label}</div>
              <div style={col('a')}>{cell(r.a)}</div>
              <div style={col('b')}>{cell(r.b)}</div>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

/**
 * Layers stacked like slabs (a system, the memory hierarchy, a network stack), built from the bottom up; `hot` lights
 * the one that matters and `sub` says something small on it.
 */
export function Stack({ layers, title, start = 0, every = 12 }: { layers: { label: string; sub?: string; hot?: boolean; color?: string }[]; title?: string; start?: number; every?: number }) {
  const { f, t } = useLocal(start, 10)
  if (f < 0) return null
  const n = layers.length
  const h = Math.min(130, 640 / Math.max(1, n) - 18)
  const top = 540 - (n * (h + 18)) / 2 + (title ? 50 : 0)
  return (
    <AbsoluteFill style={{ background: PANEL }}>
      <VisualTitle text={title} />
      {layers.map((l, i) => {
        // Built from the bottom: the last layer first.
        const k = n - 1 - i
        const p = on(f, k * every)
        if (p <= 0) return null
        const c = l.color ?? (l.hot ? HOT : AMBER)
        const w = 1100 - i * 40
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 960 - w / 2,
              top: top + i * (h + 18),
              width: w,
              height: h,
              borderRadius: 14,
              border: `3px solid ${l.hot ? c : DIM}`,
              background: l.hot ? `color-mix(in srgb, ${c} 22%, #121214)` : '#1c1c21',
              boxShadow: l.hot ? `0 0 60px color-mix(in srgb, ${c} 30%, transparent)` : '0 14px 0 #0b0b0d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 48px',
              boxSizing: 'border-box',
              transform: `scale(${l.hot ? 1 + 0.03 * t : 1})`
            }}
          >
            <span style={{ fontFamily: UI, fontWeight: 800, fontSize: Math.min(54, h * 0.42), color: l.hot ? '#fff' : '#e4e4e7' }}>{l.label}</span>
            {l.sub && <span style={{ fontFamily: CODE, fontSize: Math.min(38, h * 0.3), color: l.hot ? c : '#a1a1aa' }}>{l.sub}</span>}
          </div>
        )
      })}
    </AbsoluteFill>
  )
}

/**
 * Steps in a row with a packet travelling through them (a request, a build, how a token is made): each step lights as
 * the packet reaches it. `hot` (a step number, from 0) marks the slow or broken one.
 */
export function Pipeline({ steps, title, start = 0, every = 22, hot, packet }: { steps: string[]; title?: string; start?: number; every?: number; hot?: number; packet?: string }) {
  const { f } = useLocal(start, 10)
  if (f < 0) return null
  const n = steps.length
  const gap = 1640 / Math.max(1, n)
  const w = Math.min(320, gap - 70)
  const y = 560 + (title ? 30 : 0)
  // The packet jumps from step to step on each beat (no glide).
  const pos = Math.max(0, Math.min(n - 1, Math.floor((f - 8) / Math.max(1, every)) + (f >= 8 ? 1 : 0) - 1))
  const x = (i: number) => 140 + gap * i + gap / 2
  return (
    <AbsoluteFill style={{ background: PANEL }}>
      <VisualTitle text={title} />
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <line x1={x(0)} y1={y} x2={x(n - 1)} y2={y} stroke={DIM} strokeWidth={6} />
        <line x1={x(0)} y1={y} x2={x(0) + (x(n - 1) - x(0)) * (pos / Math.max(1, n - 1))} y2={y} stroke={AMBER} strokeWidth={6} />
      </svg>
      {steps.map((s, i) => {
        const reached = pos >= i - 0.05
        const c = i === hot ? HOT : AMBER
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x(i) - w / 2,
              top: y - 70,
              width: w,
              height: 140,
              borderRadius: 18,
              border: `3px solid ${reached ? c : DIM}`,
              background: reached ? `color-mix(in srgb, ${c} 16%, #121214)` : '#18181b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: 14,
              boxSizing: 'border-box',
              fontFamily: UI,
              fontWeight: 700,
              fontSize: Math.min(40, (w - 28) / Math.max(4, Math.min(s.length, 14) * 0.55)),
              color: reached ? '#fff' : '#a1a1aa'
            }}
          >
            {s}
          </div>
        )
      })}
      {packet ? (
        <div style={{ position: 'absolute', left: x(0) + (x(n - 1) - x(0)) * (pos / Math.max(1, n - 1)) - 34, top: y - 150, fontSize: 56, filter: 'drop-shadow(0 0 16px rgba(245,183,78,.8))' }}>{packet}</div>
      ) : (
        <div style={{ position: 'absolute', left: x(0) + (x(n - 1) - x(0)) * (pos / Math.max(1, n - 1)) - 18, top: y - 118, width: 36, height: 36, borderRadius: 18, background: AMBER, boxShadow: `0 0 30px ${AMBER}` }} />
      )}
    </AbsoluteFill>
  )
}

/**
 * A hierarchy, top down (one thing splits into kinds, a company into parts): the root, then each branch, then its
 * leaves, drawn in turn with lines.
 */
export function Tree({ root, branches, title, start = 0, every = 14 }: { root: string; branches: { label: string; leaves?: string[]; hot?: boolean }[]; title?: string; start?: number; every?: number }) {
  const { f } = useLocal(start, 10)
  if (f < 0) return null
  const n = branches.length
  const top = title ? 230 : 160
  const bx = (i: number) => 960 + (i - (n - 1) / 2) * Math.min(460, 1700 / Math.max(1, n))
  const node = (x: number, y: number, label: string, p: number, kind: 'root' | 'branch' | 'leaf', hot?: boolean) => {
    const c = hot ? HOT : AMBER
    const size = kind === 'root' ? 64 : kind === 'branch' ? 52 : 42
    return (
      <div
        key={`${kind}${label}${x}`}
        style={{
          position: 'absolute',
          left: x,
          top: y,
          transform: 'translate(-50%, -50%)',
          opacity: p,
          padding: kind === 'leaf' ? '10px 22px' : '18px 34px',
          borderRadius: 14,
          border: `3px solid ${kind === 'leaf' ? DIM : c}`,
          background: kind === 'root' ? `color-mix(in srgb, ${c} 20%, #121214)` : '#18181b',
          fontFamily: kind === 'leaf' ? CODE : UI,
          fontWeight: kind === 'leaf' ? 500 : 800,
          fontSize: size,
          color: '#f4f4f5',
          whiteSpace: 'nowrap'
        }}
      >
        {label}
      </div>
    )
  }
  const lines: React.ReactNode[] = []
  const nodes: React.ReactNode[] = [node(960, top, root, 1, 'root')]
  branches.forEach((b, i) => {
    const pb = on(f, 10 + i * every)
    const x = bx(i)
    lines.push(<line key={`b${i}`} x1={960} y1={top + 40} x2={960 + (x - 960) * pb} y2={top + 40 + (top + 230 - (top + 40)) * pb} stroke={DIM} strokeWidth={4} />)
    nodes.push(node(x, top + 260, b.label, pb, 'branch', b.hot))
    ;(b.leaves ?? []).forEach((l, j) => {
      const pl = on(f, 20 + i * every + j * 6)
      const y = top + 400 + j * 90
      lines.push(<line key={`l${i}${j}`} x1={x} y1={top + 300 + (j ? (j - 1) * 90 + 110 : 0)} x2={x} y2={y - 30} stroke={DIM} strokeWidth={3} opacity={pl} />)
      nodes.push(node(x, y, l, pl, 'leaf'))
    })
  })
  return (
    <AbsoluteFill style={{ background: PANEL }}>
      <VisualTitle text={title} />
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {lines}
      </svg>
      {nodes}
    </AbsoluteFill>
  )
}

/**
 * A real picture with a magnifying lens on one detail of it (a chip's marking, a line of a chart, a face in a crowd):
 * the picture first, then the lens grows over `at` ([x, y, w, h] in the picture's own pixels) with a label.
 */
export function Magnify({ name, w, h, at, label, start = 0, zoom = 2.6 }: { name: string; w: number; h: number; at: [number, number, number, number]; label?: string; start?: number; zoom?: number }) {
  const { f } = useLocal(start, 10)
  if (f < 0) return null
  const k = Math.min(1920 / w, 1080 / h)
  const iw = w * k
  const ih = h * k
  const ox = (1920 - iw) / 2
  const oy = (1080 - ih) / 2
  const cx = ox + (at[0] + at[2] / 2) * k
  const cy = oy + (at[1] + at[3] / 2) * k
  const p = on(f, 14)
  const r = 230
  // The lens sits beside the detail, on the side with more room, joined to it by a line.
  const lx = cx < 960 ? Math.min(1920 - r - 60, cx + 480) : Math.max(r + 60, cx - 480)
  const ly = Math.max(r + 60, Math.min(1080 - r - 60, cy))
  const z = zoom * k
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      <Img src={staticFile(name)} style={{ position: 'absolute', left: ox, top: oy, width: iw, height: ih, filter: `brightness(${1 - 0.45 * p})` }} />
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity: p }}>
        <rect x={cx - (at[2] * k) / 2} y={cy - (at[3] * k) / 2} width={at[2] * k} height={at[3] * k} fill="none" stroke={AMBER} strokeWidth={5} rx={8} />
        <line x1={cx} y1={cy} x2={lx} y2={ly} stroke={AMBER} strokeWidth={5} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: lx - r,
          top: ly - r,
          width: r * 2,
          height: r * 2,
          borderRadius: '50%',
          overflow: 'hidden',
          border: `8px solid ${AMBER}`,
          boxShadow: '0 30px 80px rgba(0,0,0,.7)',
          transform: `scale(${p})`,
          background: '#000'
        }}
      >
        <Img src={staticFile(name)} style={{ position: 'absolute', width: w * z, height: h * z, maxWidth: 'none', left: r - (at[0] + at[2] / 2) * z, top: r - (at[1] + at[3] / 2) * z }} />
      </div>
      {label && (
        <div style={{ position: 'absolute', left: lx - 300, width: 600, top: ly + r + 24, textAlign: 'center', fontFamily: MEME, fontSize: 64, color: '#fff', textTransform: 'uppercase', WebkitTextStroke: '4px #000', paintOrder: 'stroke fill', opacity: p }}>
          {label}
        </div>
      )}
    </AbsoluteFill>
  )
}
