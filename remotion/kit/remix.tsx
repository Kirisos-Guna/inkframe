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

const MEME = "'Meme', Impact, 'Arial Black', sans-serif"
const CODE = "'Code', 'Cascadia Mono', Consolas, monospace"
const UI = "'Inter', 'Tamil', 'Segoe UI', sans-serif"
const ease = Easing.bezier(0.2, 0.8, 0.2, 1)
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

/** Frames since `start`, and a 0 → 1 ease over `dur` frames. */
function useLocal(start = 0, dur = 12) {
  const f = useCurrentFrame() - start
  return { f, t: interpolate(f, [0, Math.max(1, dur)], [0, 1], { ...clamp, easing: ease }) }
}

/** Shows its children one after another: the first from at[0], the next from at[1]… until the part ends. */
export function Cuts({ at, children, whip = false }: { at: number[]; children: React.ReactNode; whip?: boolean }) {
  const { durationInFrames } = useVideoConfig()
  const list = React.Children.toArray(children)
  return (
    <>
      {list.map((c, i) => (
        <Sequence key={i} from={at[i] ?? 0} durationInFrames={Math.max(1, (at[i + 1] ?? durationInFrames) - (at[i] ?? 0))} layout="none">
          {whip && i > 0 ? <WhipIn>{c}</WhipIn> : c}
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
  const f = useCurrentFrame()
  let k = 1
  for (const a of at) k += amount * interpolate(f, [a, a + 3], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) })
  return <AbsoluteFill style={{ transform: `scale(${k})`, transformOrigin: `${x}px ${y}px` }}>{children}</AbsoluteFill>
}

/** A short camera shake at each frame in `at` (a punchline, an impact), dying away over 10 frames. */
export function Shake({ at, power = 16, children }: { at: number[]; power?: number; children: React.ReactNode }) {
  const f = useCurrentFrame()
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
  const f = useCurrentFrame()
  if (f < at) return <>{children}</>
  const t = interpolate(f, [at, at + 6], [0, 1], { ...clamp, easing: ease })
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${1 + 0.06 * t})`, filter: `saturate(${1 - 0.6 * t}) contrast(${1 + 0.15 * t})` }}>
        <Freeze frame={at}>{children}</Freeze>
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
  crop = false,
  scroll = false,
  underline = false,
  start = 0,
  markAt = 18,
  color = '#ff8a1f',
  tilt = -1.5
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
}) {
  const { f, t } = useLocal(start, 14)
  const { durationInFrames } = useVideoConfig()
  if (f < 0) return null
  // The part of the picture shown: the tight crop, or all of it.
  const [fx, fy, fw, fh] = crop && focus ? focus : [0, 0, w, h]
  const width = crop && focus ? Math.min(1640, (fw / fh) * 860) : 1560
  const k = width / fw
  const tallView = scroll ? 900 / k : fh
  const height = Math.min(fh, tallView) * k
  const all = [...marks, ...marks2]
  const my = all.length ? (Math.min(...all.map((m) => m[1])) + Math.max(...all.map((m) => m[1] + m[3]))) / 2 - fy : fh / 2
  // A tall capture scrolls down to the sentence over the first part of the shot.
  const scrollTo = scroll ? Math.max(0, Math.min(fh - tallView, my - tallView * 0.4)) : 0
  const sy = scroll ? interpolate(f, [6, Math.max(20, durationInFrames * 0.5)], [0, scrollTo], { ...clamp, easing: ease }) : 0
  const move = interpolate(f, [markAt, markAt + 40], [0, 1], { ...clamp, easing: ease })
  const zoom = 1 + (crop ? 0.06 : 0.18) * move
  const top = (1080 - height) / 2
  const dy = scroll || crop ? 0 : (540 - (top + my * k)) * move
  let used = 0
  const bars = (list: number[][], fill: string, from0: number) =>
    list.map(([x, y, mw, mh], i) => {
      // Each line is swiped after the one before, like a highlighter.
      const len = mw * k
      const from = from0 + (used / 900) * 30
      used += len
      const p = interpolate(f, [from, from + Math.max(6, (len / 900) * 30)], [0, 1], { ...clamp, easing: ease })
      const bx = (x - fx) * k - 4
      const by = (y - fy - sy) * k
      return underline ? (
        <rect key={`${fill}${i}`} x={bx} y={by + mh * k * 0.92} width={(len + 8) * p} height={Math.max(5, mh * k * 0.12)} fill={fill} rx={3} />
      ) : (
        <rect key={`${fill}${i}`} x={bx} y={by + mh * k * 0.1} width={(len + 8) * p} height={mh * k * 0.85} fill={fill} opacity={0.75} rx={3} />
      )
    })
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
          background: '#fff'
        }}
      >
        <Img src={staticFile(name)} style={{ position: 'absolute', left: -fx * k, top: -(fy + sy) * k, width: w * k, height: h * k, maxWidth: 'none' }} />
        <svg width={width} height={height} style={{ position: 'absolute', inset: 0, mixBlendMode: underline ? 'normal' : 'multiply' }}>
          {bars(marks, color, markAt)}
          {bars(marks2, '#ffe14d', markAt + 24)}
        </svg>
      </div>
    </AbsoluteFill>
  )
}

/** Two things side by side (code and what it does, before and after), each half the frame. */
export function Split({ left, right, start = 0 }: { left: React.ReactNode; right: React.ReactNode; start?: number }) {
  const { f, t } = useLocal(start, 10)
  if (f < 0) return null
  const half = (node: React.ReactNode, side: 0 | 1) => (
    <div style={{ position: 'absolute', top: 0, bottom: 0, left: side ? 960 : 0, width: 960, overflow: 'hidden', transform: `translateX(${(1 - t) * (side ? 120 : -120)}px)` }}>
      <div style={{ position: 'absolute', inset: 0, transform: 'scale(.5)', transformOrigin: '0 50%', width: 1920, height: 1080, top: 0 }}>{node}</div>
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

/** A meme: the template, with top and bottom captions. */
export function Meme({ name, top = '', bottom = '', start = 0 }: { name: string; top?: string; bottom?: string; start?: number }) {
  const { f, t } = useLocal(start, 6)
  if (f < 0) return null
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Img src={staticFile(name)} style={{ width: '100%', height: '100%', objectFit: 'contain', transform: `scale(${1.04 - 0.04 * t})` }} />
      <MemeText text={top} top />
      <MemeText text={bottom} top={false} />
    </AbsoluteFill>
  )
}

/** A Fireship-style caption over a shot: a short sarcastic line in meme capitals, at the bottom (or top). */
export function Caption({ text, start = 0, top = false, size = 88 }: { text: string; start?: number; top?: boolean; size?: number }) {
  const { f, t } = useLocal(start, 5)
  if (f < 0) return null
  return (
    <AbsoluteFill style={{ opacity: t }}>
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
  let left = Math.max(0, Math.floor(((f - 8) / fps) * cps))
  const typed = left >= code.length
  const rows = code.split('\n')
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
        <div style={{ flex: 1, padding: '24px 0', fontFamily: CODE, fontSize: 30, lineHeight: '46px' }}>
          {rows.map((row, i) => {
            const n = Math.min(row.length, left)
            left -= n + 1
            if (n <= 0 && left < 0 && i > 0) return null
            const shown = row.slice(0, n)
            const lit = typed && lines.includes(i + 1)
            return (
              <div key={i} style={{ display: 'flex', background: lit ? 'rgba(255,215,0,.12)' : undefined, borderLeft: lit ? '4px solid #ffd700' : '4px solid transparent' }}>
                <span style={{ width: 90, textAlign: 'right', paddingRight: 28, color: '#6e7681' }}>{i + 1}</span>
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
  const typedChars = Math.max(0, Math.floor(((f - 8) / fps) * cps))
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

/** A flat diagram box (like Fireship's company boxes): a solid colour, the name in dark capitals. */
export function Box({ x, y, w = 260, h = 110, label, color = '#76b900', start = 0, sub, icon, pulse = false }: { x: number; y: number; w?: number; h?: number; label: string; color?: string; start?: number; sub?: string; icon?: string; pulse?: boolean }) {
  const { f, t } = useLocal(start, 8)
  if (f < 0) return null
  // A pulse: a ring that grows out of the box and fades, once a second.
  const beat = pulse ? (f % 30) / 30 : 0
  return (
    <div style={{ position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, background: color, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: `scale(${0.8 + 0.2 * t + (pulse ? 0.03 * Math.sin(beat * Math.PI) : 0)})`, opacity: t, fontFamily: CODE, fontWeight: 700, color: '#0b0b0d', fontSize: 26, letterSpacing: 1 }}>
      {pulse && <div style={{ position: 'absolute', inset: -6 - beat * 40, border: `4px solid ${color}`, borderRadius: 12 + beat * 20, opacity: 1 - beat }} />}
      {icon && <span style={{ fontSize: 44, lineHeight: 1, marginBottom: 6 }}>{icon}</span>}
      {label.toUpperCase()}
      {sub && <span style={{ fontSize: 20, fontWeight: 500, marginTop: 6 }}>{sub}</span>}
    </div>
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
        <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 14} textAnchor="middle" fontFamily={CODE} fontWeight={700} fontSize={20} fill={color} letterSpacing={1}>
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
          <div key={k} style={{ position: 'absolute', left: x + r * Math.cos(at(k)) - 130, top: y + r * Math.sin(at(k)) - 40, width: 260, height: 80, background: '#16161a', border: `3px solid ${color}`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: CODE, fontWeight: 700, fontSize: 26, color: '#fff', transform: `scale(${0.7 + 0.3 * p})`, opacity: p }}>
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
