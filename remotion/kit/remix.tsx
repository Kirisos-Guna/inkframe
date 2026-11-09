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
import { AbsoluteFill, cancelRender, continueRender, delayRender, Easing, Freeze, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'

import { CutAt, useFrameFor, usePartFrame } from './index'
import { fitText, memeLayout } from '../../src/shared/memes'
import { flashFree } from './flash'
import { clipToBoxes, type Rect } from './geometry'
export { flashFree }

const MEME = "'Meme', Impact, 'Arial Black', sans-serif"
const CODE = "'Code', 'Cascadia Mono', Consolas, monospace"
const UI = "'Inter', 'Tamil', 'Segoe UI', sans-serif"
const ease = Easing.bezier(0.2, 0.8, 0.2, 1)
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

/**
 * Frames since `start` (a frame of the part, like at('word')), and a 0 → 1 ease over `dur` frames. Inside a <Cuts>
 * shot that begins later than `start`, it counts from the shot's first frame.
 */
function useLocal(start = 0, dur = 12) {
  // Something timed to come in after its part ends would never be seen (an arrow pointing at nothing): it comes in
  // at the latest two thirds of a second before the end.
  const { durationInFrames } = useVideoConfig()
  start = Math.min(start, Math.max(0, durationInFrames - 20))
  const f = useFrameFor(start) - start
  return { f, t: interpolate(f, [0, Math.max(1, dur)], [0, 1], { ...clamp, easing: ease }) }
}

/** Shows its children one after another: the first from at[0], the next from at[1]… until the part ends. */
export function Cuts({ at, children, whip = false }: { at: number[]; children: React.ReactNode; whip?: boolean }) {
  const { durationInFrames, fps } = useVideoConfig()
  // Inside another shot, Remotion counts from that shot's start; the times given here are frames of the part.
  const outer = React.useContext(CutAt)
  const shots = flashFree(React.Children.toArray(children), at, durationInFrames, Math.round(fps * 0.8))
  return (
    <>
      {shots.map(({ c, from, to }, i) => (
        <Sequence key={i} from={from - outer} durationInFrames={Math.max(1, to - from)} layout="none">
          <CutAt.Provider value={from}>{whip && i > 0 ? <WhipIn>{c}</WhipIn> : c}</CutAt.Provider>
        </Sequence>
      ))}
    </>
  )
}


/** The next shot slams in from the right with a motion blur (a whip pan), over 6 frames. */
function WhipIn({ children }: { children: React.ReactNode }) {
  const f = useCurrentFrame()
  const t = interpolate(f, [0, 6], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) })
  if (t >= 1) return <>{children}</>
  return <AbsoluteFill style={{ transform: `translateX(${(1 - t) * 420}px)`, filter: `blur(${(1 - t) * 18}px)` }}>{children}</AbsoluteFill>
}

/**
 * Snap zooms: at each frame in `at` the picture jumps closer (by `amount`), on the word that matters, and stays there;
 * a later punch goes closer again. `x`, `y` is what it zooms toward (default the centre).
 */
export function Punch({ at, amount = 0.14, x = 960, y = 540, children }: { at: number[]; amount?: number; x?: number; y?: number; children: React.ReactNode }) {
  const f = usePartFrame()
  let k = 1
  for (const a of at) k += amount * interpolate(f, [a, a + 3], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) })
  return <AbsoluteFill style={{ transform: `scale(${k})`, transformOrigin: `${x}px ${y}px` }}>{children}</AbsoluteFill>
}

/** A short camera shake at each frame in `at` (a punchline, an impact), dying away over 10 frames. */
export function Shake({ at, power = 16, children }: { at: number[]; power?: number; children: React.ReactNode }) {
  const f = usePartFrame()
  let dx = 0
  let dy = 0
  for (const a of at) {
    const t = f - a
    if (t < 0 || t > 10) continue
    const fade = 1 - t / 10
    dx += Math.sin(t * 2.7 + a) * power * fade
    dy += Math.cos(t * 3.3 + a * 1.7) * power * 0.7 * fade
  }
  return <AbsoluteFill style={{ transform: `translate(${dx}px, ${dy}px)` }}>{children}</AbsoluteFill>
}

/**
 * A freeze frame: from `at` the picture stops, loses some colour and zooms in a little, with an optional label
 * ("Yep, that's me.") — the "record scratch" moment.
 */
export function FreezeFrame({ at, label, children }: { at: number; label?: string; children: React.ReactNode }) {
  const f = usePartFrame()
  const cut = React.useContext(CutAt)
  if (f < at) return <>{children}</>
  const t = interpolate(f, [at, at + 6], [0, 1], { ...clamp, easing: ease })
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

/** A picture filling the frame (a photo, a logo, B-roll), with a slow push in. `fit="contain"` keeps all of it. */
export function Shot({ name, start = 0, fit = 'cover', zoom = 1.08, bg = '#000' }: { name: string; start?: number; fit?: 'cover' | 'contain'; zoom?: number; bg?: string }) {
  const { f } = useLocal(start)
  const { durationInFrames } = useVideoConfig()
  if (f < 0) return null
  const k = interpolate(f, [0, durationInFrames], [1, zoom], clamp)
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
  tilt = -1.5,
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
  const { f, t } = useLocal(start, 14)
  const { durationInFrames } = useVideoConfig()
  if (f < 0) return null
  // The part of the picture shown: by default a close crop of the headline and the paragraph with the highlight (a
  // whole page is too small to read); the whole page only for a scrolling shot or when asked (crop={false}). A crop
  // is never a thin strip: it grows taller around the highlight until it fills most of the frame.
  const all0 = [...marks, ...marks2]
  const around = all0.length ? padBox(all0, w, h, focus) : focus
  const cropped = (crop ?? !scroll) && !!around
  const [fx, fy, fw, fh] = cropped ? roomy(around!, all0, w, h) : [0, 0, w, h]
  const width = cropped ? Math.min(1640, (fw / fh) * 860) : 1560
  const k = width / fw
  const tallView = scroll ? 900 / k : fh
  const height = Math.min(fh, tallView) * k
  const all = [...marks, ...marks2]
  const my = all.length ? (Math.min(...all.map((m) => m[1])) + Math.max(...all.map((m) => m[1] + m[3]))) / 2 - fy : fh / 2
  // A tall capture scrolls down to the sentence over the first part of the shot.
  const scrollTo = scroll ? Math.max(0, Math.min(fh - tallView, my - tallView * 0.4)) : 0
  const sy = scroll ? interpolate(f, [6, Math.max(20, durationInFrames * 0.5)], [0, scrollTo], { ...clamp, easing: ease }) : 0
  const move = interpolate(f, [markAt, markAt + 40], [0, 1], { ...clamp, easing: ease })
  const zoom = 1 + (cropped ? 0.06 : 0.18) * move
  const top = (1080 - height) / 2
  const dy = scroll || cropped ? 0 : (540 - (top + my * k)) * move
  const bars = (list: number[][], fill: string, from0: number) => {
    // Each line is swiped after the one before, like a highlighter: all of them within about 0.9 s, however big the
    // crop shows them (timed by on-screen length, a close crop never finished its last line in a short shot).
    const total = list.reduce((n, m) => n + m[2], 0) || 1
    let used = 0
    return list.map(([x, y, mw, mh], i) => {
      const len = mw * k
      const from = from0 + (used / total) * 26
      used += mw
      const p = interpolate(f, [from, from + Math.max(4, (mw / total) * 26)], [0, 1], { ...clamp, easing: ease })
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
    <AbsoluteFill style={{ background: '#0b0b0d', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: 960 - width / 2,
          top,
          width,
          height,
          transform: `translateY(${dy + (1 - t) * 60}px) scale(${zoom}) rotate(${tilt * (1 - move * 0.6)}deg)`,
          transformOrigin: `50% ${my * k}px`,
          opacity: t,
          boxShadow: '0 40px 120px rgba(0,0,0,.6)',
          borderRadius: 12,
          overflow: 'hidden',
          background: '#fff',
          // Where the crop cuts through text (a headline wider than the highlight), the edge fades instead of chopping it.
          ...(cropped && focus && fx + fw < focus[0] + focus[2] - 8 ? { WebkitMaskImage: 'linear-gradient(90deg, #000 86%, transparent)', maskImage: 'linear-gradient(90deg, #000 86%, transparent)' } : {})
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
          const [mx, my0, , mh] = marks[0]
          const room = (mx - fx) * k
          const size = Math.max(44, Math.min(120, mh * k * 1.5, room * 0.85))
          const p = interpolate(f, [markAt + 28, markAt + 38], [0, 1], { ...clamp, easing: ease })
          if (p <= 0) return null
          const nudge = Math.sin((f - markAt) / 4) * size * 0.08
          return (
            <div style={{ position: 'absolute', left: room - size * 1.02 + nudge - (1 - p) * 60, top: (my0 - fy - sy) * k + (mh * k - size) / 2, fontSize: size, lineHeight: 1, opacity: p, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.45))' }}>👉</div>
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
  const start = focus && left - focus[0] < line * 3 ? focus[0] : left - line
  // Two and a half lines of room on the left: the margin a pointing hand sits in.
  const x0 = Math.max(0, start - line * 2.5)
  const x1 = Math.min(w, Math.max(right + line * 1.5, x0 + line * 22))
  const y0 = Math.max(0, Math.min(...marks.map((m) => m[1])) - line * 3.5)
  const y1 = Math.min(h, Math.max(...marks.map((m) => m[1] + m[3])) + line * 3.5)
  return [x0, y0, x1 - x0, y1 - y0]
}

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
export function Split({ left, right, start = 0 }: { left: React.ReactNode; right: React.ReactNode; start?: number }) {
  const { f, t } = useLocal(start, 10)
  if (f < 0) return null
  const half = (node: React.ReactNode, side: 0 | 1) => (
    <div style={{ position: 'absolute', top: 0, bottom: 0, left: side ? 960 : 0, width: 960, overflow: 'hidden', transform: `translateX(${(1 - t) * (side ? 120 : -120)}px)` }}>
      <div style={{ position: 'absolute', left: -480, top: 0, width: 1920, height: 1080, transform: 'scale(.52)', transformOrigin: '50% 50%' }}>{node}</div>
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

/** A real post (the captured embed), centred, popping in. */
export function Post({ name, w, h, start = 0 }: { name: string; w: number; h: number; start?: number }) {
  const { f } = useLocal(start)
  const { fps } = useVideoConfig()
  if (f < 0) return null
  const s = spring({ frame: f, fps, config: { damping: 14, mass: 0.7 } })
  const k = Math.min(1300 / w, 900 / h)
  return (
    <AbsoluteFill style={{ background: '#000', alignItems: 'center', justifyContent: 'center' }}>
      <Img src={staticFile(name)} style={{ width: w * k, height: h * k, transform: `scale(${0.85 + 0.15 * s}) rotate(${(1 - s) * -3}deg)`, borderRadius: 18 }} />
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
  const { f, t } = useLocal(start, 6)
  if (f < 0) return null
  const r = w && h ? fitted(w, h) : { x: 0, y: 0, w: 1920, h: 1080 }
  const layout = memeLayout(template)
  const boxes = layout?.boxes ?? [
    { at: [0.02, 0.01, 0.96, 0.2] as const, kind: 'label' as const },
    { at: [0.02, 0.79, 0.96, 0.2] as const, kind: 'label' as const }
  ]
  const words = layout && texts?.length ? texts : [top, bottom]
  const s = 1.03 - 0.03 * t
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      {w && h && <Img src={staticFile(name)} style={{ position: 'absolute', inset: -60, width: 2040, height: 1200, objectFit: 'cover', filter: 'blur(40px) brightness(0.45)' }} />}
      <AbsoluteFill style={{ transform: `scale(${s})` }}>
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
  const { f, t } = useLocal(start, 5)
  if (f < 0) return null
  return (
    <AbsoluteFill style={{ opacity: t }}>
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
 * A code editor like VS Code: title bar, a tab with the file name, line numbers, real syntax colours, typed as it is
 * said (`cps` characters a second). `lines` highlights line numbers (1-based) after typing.
 */
export function Code({ code, lang = 'ts', file = 'index.ts', start = 0, cps = 45, lines = [], tree }: { code: string; lang?: string; file?: string; start?: number; cps?: number; lines?: number[]; tree?: string[] }) {
  const { f, t } = useLocal(start, 10)
  const { fps } = useVideoConfig()
  if (f < 0) return null
  const grammar = Prism.languages[lang] ?? Prism.languages[{ js: 'javascript', sh: 'bash', shell: 'bash', py: 'python', yml: 'yaml' }[lang] ?? 'javascript']
  // Typed in at most about 1.2 s, so the rest of the shot is for reading it.
  let left = Math.max(0, Math.floor(((f - 4) / fps) * Math.max(cps, code.length / 1.2)))
  const typed = left >= code.length
  const rows = code.split('\n')
  // As big as the editor allows: a short snippet is read from across the room, a long one still fits.
  const longest = Math.max(12, ...rows.map((r) => r.replace(/\t/g, '  ').length))
  const font = Math.round(Math.max(24, Math.min(54, (1560 - 140 - (tree ? 300 : 0)) / (longest * 0.6), 860 / (rows.length * 1.5))))
  return (
    <AbsoluteFill style={{ background: '#0b0b0d', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 1560, borderRadius: 14, overflow: 'hidden', background: '#1e1e1e', boxShadow: '0 40px 120px rgba(0,0,0,.6)', opacity: t, transform: `translateY(${(1 - t) * 40}px)` }}>
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

/** A terminal: the command typed, then its output appearing line by line. */
export function Shell({ command, output = [], start = 0, cps = 30 }: { command: string; output?: string[]; start?: number; cps?: number }) {
  const { f, t } = useLocal(start, 10)
  const { fps } = useVideoConfig()
  if (f < 0) return null
  const typedChars = Math.max(0, Math.floor(((f - 4) / fps) * Math.max(cps, command.length / 0.6)))
  const doneAt = 8 + (command.length / cps) * fps
  const outN = Math.max(0, Math.floor((f - doneAt - 6) / 5))
  return (
    <AbsoluteFill style={{ background: '#0b0b0d', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 1500, minHeight: 560, borderRadius: 14, background: '#0d1117', boxShadow: '0 40px 120px rgba(0,0,0,.6)', padding: '30px 40px', fontFamily: CODE, fontSize: 30, lineHeight: '46px', color: '#c9d1d9', opacity: t }}>
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

/**
 * A diagram on black that fills the frame: it finds where its Boxes, Flows, Loops and Labels are (from their x, y, w,
 * h, from and to) and zooms and centres them to fill about 88% of the frame, however small they were placed.
 */
export function Diagram({ children, bg = '#000', fill = 0.88 }: { children: React.ReactNode; bg?: string; fill?: number }) {
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
export function boxSize(label: string, w = 340, h = 136) {
  const font = Math.min(34, 690 / Math.max(1, label.length * 0.6))
  return { w: Math.max(w, Math.min(760, label.length * font * 0.6 + 80)), h, font }
}

export function Box({ x, y, w: w0, h: h0, label, color = '#76b900', start = 0, sub, icon, pulse = false, solid = false }: { x: number; y: number; w?: number; h?: number; label: string; color?: string; start?: number; sub?: string; icon?: string; pulse?: boolean; solid?: boolean }) {
  const { f, t } = useLocal(start, 8)
  if (f < 0) return null
  const { w, h, font } = boxSize(label, w0, h0)
  // A pulse: a ring that grows out of the box and fades, once a second.
  const beat = pulse ? (f % 30) / 30 : 0
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
        transform: `scale(${0.8 + 0.2 * t + (pulse ? 0.03 * Math.sin(beat * Math.PI) : 0)})`,
        opacity: t,
        fontFamily: CODE,
        fontWeight: 700,
        color: solid ? '#0b0b0d' : '#f4f4f5',
        fontSize: font,
        whiteSpace: 'nowrap',
        boxShadow: solid ? undefined : `0 0 40px color-mix(in srgb, ${color} 18%, transparent)`
      }}
    >
      {pulse && <div style={{ position: 'absolute', inset: -6 - beat * 40, border: `4px solid ${color}`, borderRadius: 12 + beat * 20, opacity: 1 - beat }} />}
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
  const { fps } = useVideoConfig()
  if (f < 0) return null
  const when = (i: number) => (at?.[i] !== undefined ? at[i] - start : i * every)
  const shown = items.filter((_, i) => f >= when(i)).length
  const gap = 26
  // About 52 characters fit on a line of a card; each card is as tall as its lines.
  const heights = items.map((it) => 96 + Math.max(1, Math.ceil(it.text.length / 52)) * 48)
  const tops = heights.map((_, i) => heights.slice(0, i).reduce((n, h) => n + h + gap, 0))
  const visible = 5
  const first = Math.max(0, shown - visible)
  const shift = tops[first] ?? 0
  const lift = interpolate(f, [when(Math.max(0, shown - 1)), when(Math.max(0, shown - 1)) + 10], [0, 1], { ...clamp, easing: ease })
  const span = shown ? tops[shown - 1] + heights[shown - 1] - shift : 0
  const top = 540 - span / 2
  return (
    <AbsoluteFill style={{ background: '#0b0b0d' }}>
      {items.map((it, i) => {
        if (f < when(i)) return null
        const s = spring({ frame: f - when(i), fps, config: { damping: 14, mass: 0.6 } })
        const y = top + tops[i] - shift + (i === shown - 1 ? (1 - lift) * 40 : 0)
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 960 - 560,
              top: y,
              width: 1120,
              height: heights[i],
              background: '#f6f1e7',
              borderRadius: 10,
              padding: '22px 36px',
              boxSizing: 'border-box',
              boxShadow: '0 20px 50px rgba(0,0,0,.45)',
              transform: `scale(${0.85 + 0.15 * s}) rotate(${(i % 2 ? 0.8 : -0.8) * s}deg)`,
              opacity: s,
              borderLeft: '8px solid #c0392b'
            }}
          >
            <div style={{ fontFamily: CODE, fontSize: 26, color: '#c0392b', letterSpacing: 1 }}>{it.date}</div>
            <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 38, color: '#1a1a1a', marginTop: 8, lineHeight: 1.25 }}>{it.text}</div>
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
  const rowH = Math.min(150, 640 / Math.max(1, items.length))
  const top = 540 - (items.length * rowH) / 2 + (title ? 40 : 0)
  return (
    <AbsoluteFill style={{ background: '#121214' }}>
      {title && <div style={{ position: 'absolute', top: top - 120, left: 0, right: 0, textAlign: 'center', fontFamily: UI, fontWeight: 700, fontSize: 52, color: '#fafafa' }}>{title}</div>}
      {items.map((it, i) => {
        const p = interpolate(f, [i * every, i * every + 22], [0, 1], { ...clamp, easing: ease })
        if (p <= 0) return null
        const len = Math.max(8, (scale(it.value) / max) * 900) * p
        const c = it.hot ? '#ff6b4a' : color
        return (
          <div key={i} style={{ position: 'absolute', top: top + i * rowH, left: 0, right: 0, height: rowH, display: 'flex', alignItems: 'center', opacity: Math.min(1, p * 3) }}>
            <div style={{ width: 560, paddingRight: 36, textAlign: 'right', fontFamily: CODE, fontSize: 34, color: '#d4d4d8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</div>
            <div style={{ width: len, height: Math.min(64, rowH * 0.5), background: `color-mix(in srgb, ${c} 30%, transparent)`, border: `3px solid ${c}`, borderRadius: 6 }} />
            {it.text && <div style={{ marginLeft: 24, fontFamily: CODE, fontSize: 32, color: c, opacity: p >= 1 ? 1 : 0, whiteSpace: 'nowrap' }}>{it.text}</div>}
          </div>
        )
      })}
    </AbsoluteFill>
  )
}

/** An arrow between two points, drawn on, with a small label on the way (INVESTMENT, LOAN, RENTS…). */
export function Flow({ from, to, label, color = '#3ddc97', start = 0, dur = 14, dashed = false, packets = 0, packet, speed = 40 }: { from: [number, number]; to: [number, number]; label?: string; color?: string; start?: number; dur?: number; dashed?: boolean; packets?: number; packet?: string; speed?: number }) {
  const { f, t } = useLocal(start, dur)
  if (f < 0) return null
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
      {t >= 1 &&
        Array.from({ length: packets }, (_, i) => {
          // Each packet takes `speed` frames end to end; they are spaced evenly along the arrow.
          const p = ((f - dur) / speed + i / packets) % 1
          const px = x1 + (x2 - x1) * p
          const py = y1 + (y2 - y1) * p
          const fade = Math.min(1, p * 8, (1 - p) * 8)
          return packet ? (
            <text key={i} x={px} y={py + 12} textAnchor="middle" fontSize={34} opacity={fade}>
              {packet}
            </text>
          ) : (
            <circle key={i} cx={px} cy={py} r={9} fill={color} opacity={fade} style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
          )
        })}
      {label && t > 0.5 && (
        // Beside the arrow, on its upper side, so the line never runs through the word.
        <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontFamily={CODE} fontWeight={700} fontSize={Math.max(20, Math.min(32, (len * 0.95) / Math.max(1, (label?.length ?? 1) * 0.62)))} fill={color} letterSpacing={1} stroke="#000" strokeWidth={8} paintOrder="stroke">
          {label.toUpperCase()}
        </text>
      )}
    </svg>
  )
}

/** A cycle: things around a ring (build → test → deploy → …), drawn in turn, with a dot going round and round. */
export function Loop({ items, x = 960, y = 540, r = 300, color = '#3ddc97', start = 0, every = 8, speed = 90 }: { items: string[]; x?: number; y?: number; r?: number; color?: string; start?: number; every?: number; speed?: number }) {
  const { f, t } = useLocal(start, 16)
  if (f < 0) return null
  const n = items.length
  const at = (k: number) => -Math.PI / 2 + (k / n) * Math.PI * 2
  const spin = at(0) + ((f / speed) % 1) * Math.PI * 2
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <circle cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth={4} strokeDasharray={`${2 * Math.PI * r * t} 99999`} transform={`rotate(-90 ${x} ${y})`} opacity={0.6} />
        {t >= 1 && <circle cx={x + r * Math.cos(spin)} cy={y + r * Math.sin(spin)} r={13} fill={color} style={{ filter: `drop-shadow(0 0 10px ${color})` }} />}
      </svg>
      {items.map((label, k) => {
        const p = interpolate(f, [k * every, k * every + 8], [0, 1], { ...clamp, easing: ease })
        if (p <= 0) return null
        return (
          <div key={k} style={{ position: 'absolute', left: x + r * Math.cos(at(k)) - 150, top: y + r * Math.sin(at(k)) - 46, width: 300, height: 92, background: '#16161a', border: `3px solid ${color}`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: CODE, fontWeight: 700, fontSize: 31, color: '#fff', transform: `scale(${0.7 + 0.3 * p})`, opacity: p }}>
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

/** A real line chart (stock price, weekly downloads) drawn left to right, the last value counting up, the change in green or red. */
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
      <div style={{ position: 'absolute', left: 210, top: 90, fontFamily: UI, fontWeight: 800, fontSize: 52, color: '#fff' }}>{data.title}</div>
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
            <text x={190} y={Y(lo + (hi - lo) * k) + 8} textAnchor="end" fontFamily={CODE} fontSize={22} fill="#77777f">
              {short(lo + (hi - lo) * k)}
            </text>
          </g>
        ))}
        <path d={`${d}L${X(shown - 1)} 860L210 860Z`} fill={line} opacity={0.12} />
        <path d={d} fill="none" stroke={line} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={X(shown - 1)} cy={Y(end[1])} r={12} fill={line} style={{ filter: `drop-shadow(0 0 12px ${line})` }} />
        <text x={210} y={910} fontFamily={CODE} fontSize={22} fill="#77777f">{year(pts[0][0])}</text>
        <text x={210 + W} y={910} textAnchor="end" fontFamily={CODE} fontSize={22} fill="#77777f">{year(pts[pts.length - 1][0])}</text>
      </svg>
      <div style={{ position: 'absolute', left: 210, bottom: 60, fontFamily: UI, fontSize: 20, color: '#55555c' }}>Source: {data.source}</div>
    </AbsoluteFill>
  )
}

/** Big numbers that count up (GitHub stars, forks, issues), one after another. */
export function Stats({ name, start = 0, every = 10 }: { name: string; start?: number; every?: number }) {
  const data = useChart(name)
  const { f } = useLocal(start, 1)
  if (f < 0 || !data) return null
  if (!data.stats) return data.points ? <Chart name={name} start={start} /> : null
  return (
    <AbsoluteFill style={{ background: '#0b0b0d', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: CODE, fontWeight: 700, fontSize: 46, color: '#9d9d9d', marginBottom: 60 }}>{data.title}</div>
      <div style={{ display: 'flex', gap: 120 }}>
        {data.stats.map((s, i) => {
          const p = interpolate(f, [i * every, i * every + 24], [0, 1], { ...clamp, easing: ease })
          return (
            <div key={i} style={{ textAlign: 'center', opacity: Math.min(1, p * 3), transform: `translateY(${(1 - p) * 40}px)` }}>
              <div style={{ fontFamily: MEME, fontSize: 150, color: i ? '#fff' : '#ffd400', lineHeight: 1 }}>{short(Math.round(s.value * p))}</div>
              <div style={{ fontFamily: UI, fontWeight: 700, fontSize: 34, color: '#9d9d9d', marginTop: 14 }}>{s.label}</div>
            </div>
          )
        })}
      </div>
      <div style={{ position: 'absolute', bottom: 60, fontFamily: UI, fontSize: 20, color: '#55555c' }}>Source: {data.source}</div>
    </AbsoluteFill>
  )
}

/** A pointing hand that slides in and taps at (x, y). */
export function Hand({ x, y, start = 0, dir = 'left' }: { x: number; y: number; start?: number; dir?: 'left' | 'right' | 'up' | 'down' }) {
  const { f, t } = useLocal(start, 10)
  if (f < 0) return null
  const bob = Math.sin(f / 4) * 8
  const rot = { left: 0, right: 180, up: 90, down: -90 }[dir]
  return <div style={{ position: 'absolute', left: x - 50 + (1 - t) * 160, top: y - 50 + bob, fontSize: 100, transform: `rotate(${rot}deg) scaleX(-1)`, opacity: t, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.6))' }}>👉</div>
}

/** A red circle drawn around something, like a marker on a screenshot. */
export function Circle({ x, y, rx = 220, ry = 90, start = 0, color = '#ff2d2d' }: { x: number; y: number; rx?: number; ry?: number; start?: number; color?: string }) {
  const { f, t } = useLocal(start, 14)
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
        strokeDasharray={len}
        strokeDashoffset={len * (1 - t)}
      />
    </svg>
  )
}

/**
 * A cut-out (a person, a product, a logo) as a sticker: a white outline and a shadow, popping in with a little tilt.
 * Put several on a coloured background (<AbsoluteFill style={{ background: '#8b5cf6' }}>) for the Photoshop look.
 */
export function Sticker({ name, x = 960, y = 560, h = 760, rotate = -4, start = 0, flip = false }: { name: string; x?: number; y?: number; h?: number; rotate?: number; start?: number; flip?: boolean }) {
  const { f } = useLocal(start)
  const { fps } = useVideoConfig()
  if (f < 0) return null
  const s = spring({ frame: f, fps, config: { damping: 11, mass: 0.6 } })
  const o = 7
  const outline = [`${o}px 0`, `-${o}px 0`, `0 ${o}px`, `0 -${o}px`, `${o * 0.7}px ${o * 0.7}px`, `-${o * 0.7}px ${o * 0.7}px`, `${o * 0.7}px -${o * 0.7}px`, `-${o * 0.7}px -${o * 0.7}px`]
    .map((d) => `drop-shadow(${d} 0 #fff)`)
    .join(' ')
  const move = `translate(-50%, -50%) scale(${0.6 + 0.4 * s}${flip ? ', 1) scaleX(-1' : ''}) rotate(${rotate * s}deg)`
  // A logo ("-logo" file) sits on a white card, so dark lettering shows on the black frame.
  if (/-logo\.\w+$/.test(name))
    return (
      <div style={{ position: 'absolute', left: x, top: y, transform: move, background: '#fff', borderRadius: h * 0.08, padding: h * 0.12, boxShadow: '0 18px 40px rgba(0,0,0,.5)' }}>
        <Img src={staticFile(name)} style={{ display: 'block', height: h * 0.76, maxWidth: h * 2.6, objectFit: 'contain' }} />
      </div>
    )
  return (
    <Img
      src={staticFile(name)}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        height: h,
        transform: `translate(-50%, -50%) scale(${0.6 + 0.4 * s}${flip ? ', 1) scaleX(-1' : ''}) rotate(${rotate * s}deg)`,
        filter: `${outline} drop-shadow(0 18px 24px rgba(0,0,0,.45))`
      }}
    />
  )
}

/** A tag on something: bold capitals on a solid colour, with an optional pointer line to (toX, toY). */
export function Label({ x, y, text, color = '#ff2d2d', ink = '#fff', to, start = 0, rotate = -3, size = 40 }: { x: number; y: number; text: string; color?: string; ink?: string; to?: [number, number]; start?: number; rotate?: number; size?: number }) {
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

/** A big title card on black: a few words, one in the accent. */
export function TitleCard({ text, accent, start = 0, color = '#ff8a1f' }: { text: string; accent?: string; start?: number; color?: string }) {
  const { f, t } = useLocal(start, 8)
  if (f < 0) return null
  return (
    <AbsoluteFill style={{ background: '#000', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: MEME, fontSize: 150, color: '#fff', textTransform: 'uppercase', textAlign: 'center', padding: '0 120px', lineHeight: 1.05, transform: `scale(${1.15 - 0.15 * t})`, opacity: t }}>
        {text.split(/(\s+)/).map((wd, i) => (
          <span key={i} style={{ color: accent && wd.toLowerCase() === accent.toLowerCase() ? color : undefined }}>
            {wd}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  )
}
