// Building blocks for the Dark Systems Diagram style: flat dark mock-ups of real things, layers, connectors and the
// lettering, ready to place. A part is a few lines of these instead of hundreds of lines of SVG, and every part of a
// video looks the same. All of them go inside <Board> and use its 1920 x 1080 space; `start` is the frame they appear.
// They are flat: each sets stroke="none" on its group, so the Board's pen outline (meant for drawn lines) stays off.
import React from 'react'
import { interpolate, Easing } from 'remotion'
import { useCurrentFrame } from 'remotion'
import { useScene } from './index'

/** The signal colours: one per idea, kept for the whole video. */
export const SIGNAL = { cyan: '#4cc4d6', amber: '#f6b73c', pink: '#f0569a', purple: '#9b7cf0', orange: '#e8873a' } as const
const PANEL = '#1c1d21'
const INNER = '#26272c'
const EDGE = '#2c2d33'
const DARK = '#101014'
const UI = "'Inter', 'Tamil', 'Segoe UI', sans-serif"
const MONO = "ui-monospace, 'Cascadia Mono', Consolas, 'Tamil', monospace"
const ease = Easing.bezier(0.2, 0.8, 0.2, 1)

/** 0 → 1 from `start` over `dur` frames, eased. */
export function useIn(start = 0, dur = 12) {
  const f = useCurrentFrame()
  return interpolate(f, [start, start + Math.max(1, dur)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease })
}

/** Appears at `start`: fades in and settles from slightly smaller, around its own centre. */
function Appear({ start = 0, cx, cy, children }: { start?: number; cx: number; cy: number; children: React.ReactNode }) {
  const t = useIn(start, 12)
  if (t <= 0) return null
  const k = 0.94 + 0.06 * t
  return (
    <g opacity={t} stroke="none" transform={`translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})`}>
      {children}
    </g>
  )
}

/** A dark rounded card: the base of every mock-up. */
export function Panel({ x, y, w, h, r = 16, fill = PANEL, start = 0, children }: { x: number; y: number; w: number; h: number; r?: number; fill?: string; start?: number; children?: React.ReactNode }) {
  return (
    <Appear start={start} cx={x + w / 2} cy={y + h / 2}>
      <rect x={x} y={y} width={w} height={h} rx={r} fill={fill} stroke={EDGE} strokeWidth={1.5} />
      {children}
    </Appear>
  )
}

/** A browser window: tab, back / forward / reload, and the address bar. `secure` shows https:// in amber. Children draw in the page area. */
export function Browser({ x, y, w = 640, h = 380, url = 'example.com', tab = 'New Tab', secure = false, start = 0, children }: { x: number; y: number; w?: number; h?: number; url?: string; tab?: string; secure?: boolean; start?: number; children?: React.ReactNode }) {
  const bar = 54
  return (
    <Panel x={x} y={y} w={w} h={h} start={start}>
      <rect x={x + 18} y={y + 12} width={Math.min(240, w * 0.4)} height={34} rx={9} fill={INNER} />
      <text x={x + 34} y={y + 35} fontFamily={UI} fontSize={17} fill="#c9c9d1">{tab}</text>
      <g stroke="#8a8a94" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={`M${x + 34} ${y + 76}h-14m6-6l-6 6 6 6`} />
        <path d={`M${x + 52} ${y + 76}h14m-6-6l6 6-6 6`} />
        <path d={`M${x + 96} ${y + 70}a7 7 0 1 0 2 6`} />
      </g>
      <rect x={x + 118} y={y + 58} width={w - 136} height={36} rx={18} fill={INNER} />
      <text x={x + 138} y={y + 82} fontFamily={UI} fontSize={18}>
        {secure && <tspan fill={SIGNAL.amber}>https:// </tspan>}
        <tspan fill="#ececf1">{url}</tspan>
      </text>
      <g transform={`translate(0 ${bar})`}>{children}</g>
    </Panel>
  )
}

/** A server: a round logo badge and rack rows with tick marks and two status dots. `logo` is up to three colours for a simple mark. */
export function Server({ x, y, w = 300, h = 170, rows = 3, logo = [SIGNAL.cyan], label, start = 0 }: { x: number; y: number; w?: number; h?: number; rows?: number; logo?: string[]; label?: string; start?: number }) {
  const { font } = useScene()
  const cx = x + 62
  const cy = y + h / 2
  const rowH = (h - 36) / rows
  const arc = (i: number) => {
    const a0 = (i / logo.length) * Math.PI * 2 - Math.PI / 2
    const a1 = ((i + 1) / logo.length) * Math.PI * 2 - Math.PI / 2 - 0.25
    const r = 24
    return `M${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)}A${r} ${r} 0 0 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}`
  }
  return (
    <Panel x={x} y={y} w={w} h={h} start={start}>
      <circle cx={cx} cy={cy} r={42} fill={INNER} />
      {logo.map((c, i) => (
        <path key={i} d={arc(i)} stroke={c} strokeWidth={10} fill="none" strokeLinecap="round" />
      ))}
      {Array.from({ length: rows }, (_, i) => {
        const ry = y + 18 + i * rowH
        return (
          <g key={i}>
            <rect x={x + 120} y={ry + 4} width={w - 138} height={rowH - 10} rx={8} fill={INNER} />
            {Array.from({ length: 5 }, (_, k) => (
              <line key={k} x1={x + 136 + k * 10} x2={x + 136 + k * 10} y1={ry + rowH / 2 - 7} y2={ry + rowH / 2 + 3} stroke="#5b5b64" strokeWidth={2} />
            ))}
            <circle cx={x + w - 46} cy={ry + rowH / 2 - 2} r={4} fill="#5b5b64" />
            <circle cx={x + w - 32} cy={ry + rowH / 2 - 2} r={4} fill={i === 0 ? SIGNAL.cyan : '#ececf1'} />
          </g>
        )
      })}
      {label && (
        <text x={x + w / 2} y={y + h + 44} textAnchor="middle" fontFamily={font} fontSize={34} fill="#ececf1">
          {label}
        </text>
      )}
    </Panel>
  )
}

/** A terminal with lines typed one after another (cps: characters per second). */
export function Terminal({ x, y, w = 620, h = 300, lines, start = 0, cps = 30, color = SIGNAL.cyan }: { x: number; y: number; w?: number; h?: number; lines: string[]; start?: number; cps?: number; color?: string }) {
  const f = useCurrentFrame()
  const { fps } = useScene()
  let shown = Math.max(0, Math.floor(((f - start - 8) / fps) * cps))
  return (
    <Panel x={x} y={y} w={w} h={h} start={start} fill="#121316">
      {['#f0569a', '#f6b73c', '#4cc4d6'].map((c, i) => (
        <circle key={c} cx={x + 26 + i * 22} cy={y + 24} r={6.5} fill={c} opacity={0.8} />
      ))}
      {lines.map((l, i) => {
        const n = Math.min(l.length, shown)
        shown -= n
        return n > 0 || i === 0 ? (
          <text key={i} x={x + 26} y={y + 74 + i * 36} fontFamily={MONO} fontSize={22} fill={i === 0 ? color : '#d7d7de'}>
            {(i === 0 ? '$ ' : '') + l.slice(0, n)}
          </text>
        ) : null
      })}
    </Panel>
  )
}

/** One layer of a system: a full-width dark bar with its name in marker capitals, in its colour. Children draw inside. */
export function Layer({ x = 160, y, w = 1600, h = 70, name, color, start = 0, children }: { x?: number; y: number; w?: number; h?: number; name: string; color: string; start?: number; children?: React.ReactNode }) {
  const { font } = useScene()
  return (
    <Panel x={x} y={y} w={w} h={h} r={14} start={start}>
      <text x={x + 26} y={y + h / 2 + 13} fontFamily={font} fontSize={34} fill={color}>
        {name.toUpperCase()}
      </text>
      {children}
    </Panel>
  )
}

/** A capsule label: the colour filled, the word dark. `mono` for technical tags (port 443, an IP address). */
export function Pill({ x, y, text, color = SIGNAL.cyan, size = 32, mono = false, start = 0 }: { x: number; y: number; text: string; color?: string; size?: number; mono?: boolean; start?: number }) {
  const { font } = useScene()
  // Tamil letters are wider than this kit's Latin lettering.
  const w = text.length * size * (/[0900-0D7F]/.test(text) ? 0.95 : mono ? 0.62 : 0.66) + size * 1.1
  const h = size * 1.5
  return (
    <Appear start={start} cx={x} cy={y}>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={h / 2} fill={color} />
      <text x={x} y={y + size * 0.36} textAnchor="middle" fontFamily={mono ? MONO : font} fontWeight={mono ? 700 : 400} fontSize={size} fill={DARK}>
        {mono ? text : text.toUpperCase()}
      </text>
    </Appear>
  )
}

/** A thick connector with ring ends that extends from (x1, y1) to (x2, y2). */
export function Connector({ x1, y1, x2, y2, color = SIGNAL.cyan, start = 0, dur = 18, width = 12 }: { x1: number; y1: number; x2: number; y2: number; color?: string; start?: number; dur?: number; width?: number }) {
  const t = useIn(start, dur)
  if (t <= 0) return null
  const ex = x1 + (x2 - x1) * t
  const ey = y1 + (y2 - y1) * t
  return (
    <g stroke="none">
      <line x1={x1} y1={y1} x2={ex} y2={ey} stroke={color} strokeWidth={width} strokeLinecap="round" />
      <circle cx={x1} cy={y1} r={10} fill="#0a0a0d" stroke={color} strokeWidth={5} />
      {t > 0.98 && <circle cx={x2} cy={y2} r={10} fill="#0a0a0d" stroke={color} strokeWidth={5} />}
    </g>
  )
}

/** A small card of data sliding from (x1, y1) to (x2, y2), e.g. "<html>" travelling down a connector. */
export function Packet({ x1, y1, x2, y2, text, color = SIGNAL.amber, start = 0, dur = 30 }: { x1: number; y1: number; x2: number; y2: number; text: string; color?: string; start?: number; dur?: number }) {
  const t = useIn(start, dur)
  if (useCurrentFrame() < start) return null
  const x = x1 + (x2 - x1) * t
  const y = y1 + (y2 - y1) * t
  const w = text.length * 13 + 36
  return (
    <g stroke="none">
      <rect x={x - w / 2} y={y - 22} width={w} height={44} rx={8} fill={INNER} stroke={EDGE} />
      <rect x={x - w / 2 + 6} y={y - 14} width={4} height={28} rx={2} fill={color} />
      <text x={x + 4} y={y + 7} textAnchor="middle" fontFamily={MONO} fontSize={20} fill={color}>
        {text}
      </text>
    </g>
  )
}

/** A message between two sides: a thin arrow drawn from `from` to `to` with a small pill label in the middle (SYN, ACK...). */
export function Message({ from, to, label, color = SIGNAL.cyan, start = 0, dur = 16 }: { from: [number, number]; to: [number, number]; label?: string; color?: string; start?: number; dur?: number }) {
  const t = useIn(start, dur)
  if (t <= 0) return null
  const [x1, y1] = from
  const x2 = x1 + (to[0] - x1) * t
  const y2 = y1 + (to[1] - y1) * t
  const a = Math.atan2(to[1] - y1, to[0] - x1)
  return (
    <g stroke="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={4} strokeLinecap="round" />
      {t > 0.9 && <path d={`M${to[0]} ${to[1]}l${-16 * Math.cos(a - 0.45)} ${-16 * Math.sin(a - 0.45)}M${to[0]} ${to[1]}l${-16 * Math.cos(a + 0.45)} ${-16 * Math.sin(a + 0.45)}`} stroke={color} strokeWidth={4} strokeLinecap="round" />}
      {label && t > 0.5 && <Pill x={(x1 + to[0]) / 2} y={(y1 + to[1]) / 2 - 26} text={label} color={color} size={20} start={start + dur / 2} />}
    </g>
  )
}

/** The section title at the top: white marker capitals with a short underline. `words` colours words: { TCP: SIGNAL.cyan }. */
export function SectionTitle({ text, y = 120, start = 0, words = {} }: { text: string; y?: number; start?: number; words?: Record<string, string> }) {
  const { font } = useScene()
  const t = useIn(start, 14)
  if (t <= 0) return null
  const parts = text.split(/(\s+)/)
  const under = Math.min(520, text.length * 22)
  return (
    <g opacity={t} stroke="none">
      <text x={960} y={y} textAnchor="middle" fontFamily={font} fontSize={64} fill="#ececf1">
        {parts.map((p, i) => (
          <tspan key={i} fill={words[p.replace(/[^\p{L}\p{M}\p{N}]/gu, '')] ?? '#ececf1'}>
            {p}
          </tspan>
        ))}
      </text>
      <line x1={960 - (under / 2) * t} x2={960 + (under / 2) * t} y1={y + 22} y2={y + 22} stroke="#ececf1" strokeWidth={3} strokeLinecap="round" />
    </g>
  )
}

/** A dashed box with a "?": a step that is explained later. */
export function Slot({ x, y, w = 120, h = 70, start = 0 }: { x: number; y: number; w?: number; h?: number; start?: number }) {
  const { font } = useScene()
  return (
    <Appear start={start} cx={x + w / 2} cy={y + h / 2}>
      <rect x={x} y={y} width={w} height={h} rx={14} fill="none" stroke="#5b5b64" strokeWidth={3} strokeDasharray="10 8" />
      <text x={x + w / 2} y={y + h / 2 + 14} textAnchor="middle" fontFamily={font} fontSize={38} fill="#6b6b74">
        ?
      </text>
    </Appear>
  )
}

/** The step tracker: numbered circles joined by a line. Steps before `current` are done (their colour, dimmed), `current` is bright, later ones grey. */
export function Steps({ x = 960, y = 940, count, current, colors = [SIGNAL.orange, SIGNAL.cyan, SIGNAL.pink, SIGNAL.amber, SIGNAL.purple], label, start = 0 }: { x?: number; y?: number; count: number; current: number; colors?: string[]; label?: string; start?: number }) {
  const { font } = useScene()
  const gap = 150
  const x0 = x - ((count - 1) * gap) / 2
  return (
    <Appear start={start} cx={x} cy={y}>
      <line x1={x0} x2={x0 + (count - 1) * gap} y1={y} y2={y} stroke="#3a3b42" strokeWidth={4} />
      {Array.from({ length: count }, (_, i) => {
        const n = i + 1
        const c = n <= current ? colors[i % colors.length] : '#3a3b42'
        return (
          <g key={i} opacity={n < current ? 0.55 : 1}>
            <circle cx={x0 + i * gap} cy={y} r={n === current ? 34 : 26} fill={c} />
            <text x={x0 + i * gap} y={y + 12} textAnchor="middle" fontFamily={UI} fontWeight={700} fontSize={n === current ? 32 : 24} fill={n <= current ? DARK : '#8a8a94'}>
              {n}
            </text>
          </g>
        )
      })}
      {label && (
        <text x={x} y={y + 92} textAnchor="middle" fontFamily={font} fontSize={40} fill="#ececf1">
          {label}
        </text>
      )}
    </Appear>
  )
}

/**
 * The focus pull: what is inside dims to 30% and blurs from `start` (when a question or section title comes in) and
 * comes back into focus at `end` (if given).
 */
export function Focus({ start, end, children }: { start: number; end?: number; children: React.ReactNode }) {
  const f = useCurrentFrame()
  const into = useIn(start, 12)
  const back = end === undefined ? 0 : interpolate(f, [end, end + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease })
  const d = into * (1 - back)
  const id = `focus-${start}-${end ?? 'x'}`
  return (
    <g opacity={1 - 0.7 * d} filter={d > 0.01 ? `url(#${id})` : undefined}>
      <defs>
        <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation={6 * d} />
        </filter>
      </defs>
      {children}
    </g>
  )
}
