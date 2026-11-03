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
import { AbsoluteFill, Easing, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'

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
export function Cuts({ at, children }: { at: number[]; children: React.ReactNode }) {
  const { durationInFrames } = useVideoConfig()
  const list = React.Children.toArray(children)
  return (
    <>
      {list.map((c, i) => (
        <Sequence key={i} from={at[i] ?? 0} durationInFrames={Math.max(1, (at[i + 1] ?? durationInFrames) - (at[i] ?? 0))} layout="none">
          {c}
        </Sequence>
      ))}
    </>
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
 * A screenshot of a page as a card on black, with an orange highlighter drawn over the sentence (`marks`, in the
 * picture's own pixels, as listed for the part). The camera eases toward the highlight.
 */
export function Page({ name, w, h, marks = [], start = 0, markAt = 18, color = '#ff8a1f', tilt = -1.5 }: { name: string; w: number; h: number; marks?: number[][]; start?: number; markAt?: number; color?: string; tilt?: number }) {
  const { f, t } = useLocal(start, 14)
  if (f < 0) return null
  const width = 1560
  const k = width / w
  const height = h * k
  // Where the highlight is, to move toward it.
  const my = marks.length ? (marks[0][1] + marks[marks.length - 1][1] + marks[marks.length - 1][3]) / 2 : h / 2
  const move = interpolate(f, [markAt, markAt + 40], [0, 1], { ...clamp, easing: ease })
  const zoom = 1 + 0.18 * move
  const dy = (540 - (90 + my * k)) * move
  let used = 0
  return (
    <AbsoluteFill style={{ background: '#0b0b0d', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: 960 - width / 2,
          top: 90,
          width,
          height,
          transform: `translateY(${dy + (1 - t) * 60}px) scale(${zoom}) rotate(${tilt * (1 - move * 0.6)}deg)`,
          transformOrigin: `50% ${90 + my * k}px`,
          opacity: t,
          boxShadow: '0 40px 120px rgba(0,0,0,.6)',
          borderRadius: 12,
          overflow: 'hidden'
        }}
      >
        <Img src={staticFile(name)} style={{ width, height, display: 'block' }} />
        <svg width={width} height={height} style={{ position: 'absolute', inset: 0, mixBlendMode: 'multiply' }}>
          {marks.map(([x, y, mw, mh], i) => {
            // Each line is swiped after the one before, like a highlighter.
            const len = mw * k
            const from = markAt + (used / 900) * 30
            used += len
            const p = interpolate(f, [from, from + Math.max(6, (len / 900) * 30)], [0, 1], { ...clamp, easing: ease })
            return <rect key={i} x={x * k - 4} y={y * k + mh * k * 0.1} width={(len + 8) * p} height={mh * k * 0.85} fill={color} opacity={0.75} rx={3} />
          })}
        </svg>
      </div>
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
export function Code({ code, lang = 'ts', file = 'index.ts', start = 0, cps = 45, lines = [] }: { code: string; lang?: string; file?: string; start?: number; cps?: number; lines?: number[] }) {
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
        <div style={{ padding: '24px 0', fontFamily: CODE, fontSize: 30, lineHeight: '46px' }}>
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
export function Box({ x, y, w = 260, h = 110, label, color = '#76b900', start = 0, sub }: { x: number; y: number; w?: number; h?: number; label: string; color?: string; start?: number; sub?: string }) {
  const { f, t } = useLocal(start, 8)
  if (f < 0) return null
  return (
    <div style={{ position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, background: color, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: `scale(${0.8 + 0.2 * t})`, opacity: t, fontFamily: CODE, fontWeight: 700, color: '#0b0b0d', fontSize: 26, letterSpacing: 1 }}>
      {label.toUpperCase()}
      {sub && <span style={{ fontSize: 20, fontWeight: 500, marginTop: 6 }}>{sub}</span>}
    </div>
  )
}

/** An arrow between two points, drawn on, with a small label on the way (INVESTMENT, LOAN, RENTS…). */
export function Flow({ from, to, label, color = '#3ddc97', start = 0, dur = 14, dashed = false }: { from: [number, number]; to: [number, number]; label?: string; color?: string; start?: number; dur?: number; dashed?: boolean }) {
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
      {label && t > 0.5 && (
        <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 14} textAnchor="middle" fontFamily={CODE} fontWeight={700} fontSize={20} fill={color} letterSpacing={1}>
          {label.toUpperCase()}
        </text>
      )}
    </svg>
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
