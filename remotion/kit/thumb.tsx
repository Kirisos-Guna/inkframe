// Thumbnail kit: bold, high-contrast pieces for one still frame (the 1920x1080 space, rendered at 1280x720).
// Everything here is static: a thumbnail is one picture, so nothing animates.
import React from 'react'
import { AbsoluteFill } from 'remotion'
import { useScene } from './index'

const W = 1920
const H = 1080

/** The video's lettering: its font, heavy only when it is Inter (the hand and marker fonts have one weight). */
const lettering = (font: string) => ({ fontFamily: font, fontWeight: font.includes('Inter') ? 900 : 400 })

/**
 * The background. 'plain' (the default) is the video's own background, as in its frames; the louder ones are a glow,
 * sun rays, a spotlight or a two-tone split, for styles that suit them.
 */
export function ThumbBg({
  variant = 'plain',
  from,
  to,
  focus = [1300, 480],
  children
}: {
  variant?: 'plain' | 'glow' | 'burst' | 'spot' | 'split'
  from?: string
  to?: string
  focus?: [number, number]
  children?: React.ReactNode
}) {
  const s = useScene()
  const a = from ?? s.palette.accent
  const b = to ?? s.palette.bg
  const [fx, fy] = focus
  return (
    <AbsoluteFill style={{ background: b }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <radialGradient id="tb-glow" cx={fx / W} cy={fy / H} r="0.75">
            <stop offset="0" stopColor={a} stopOpacity="0.95" />
            <stop offset="0.35" stopColor={a} stopOpacity="0.35" />
            <stop offset="1" stopColor={b} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="tb-vig" cx="0.5" cy="0.5" r="0.75">
            <stop offset="0.55" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.65" />
          </radialGradient>
        </defs>
        {variant === 'split' ? (
          <>
            <rect width={W / 2} height={H} fill={a} />
            <rect x={W / 2} width={W / 2} height={H} fill={b} />
            <path d={`M${W / 2 - 40} 0 L${W / 2 + 40} 0 L${W / 2 - 20} ${H} L${W / 2 - 100} ${H} Z`} fill="#fff" />
          </>
        ) : variant === 'plain' ? null : (
          <rect width={W} height={H} fill="url(#tb-glow)" />
        )}
        {variant === 'burst' &&
          Array.from({ length: 18 }, (_, i) => {
            const t0 = (i / 18) * Math.PI * 2
            const t1 = t0 + Math.PI / 36
            const R = 2400
            return <path key={i} d={`M${fx} ${fy} L${fx + Math.cos(t0) * R} ${fy + Math.sin(t0) * R} L${fx + Math.cos(t1) * R} ${fy + Math.sin(t1) * R} Z`} fill="#fff" opacity="0.09" />
          })}
        {variant === 'spot' && <ellipse cx={fx} cy={fy + 380} rx="520" ry="90" fill="#000" opacity="0.45" />}
        <rect width={W} height={H} fill="url(#tb-vig)" opacity={variant === 'plain' ? 0.5 : 1} />
      </svg>
      {children}
    </AbsoluteFill>
  )
}

/** A soft glow behind the subject, so it pops off the background. */
export function GlowBehind({ x, y, r = 360, color }: { x: number; y: number; r?: number; color?: string }) {
  const s = useScene()
  const c = color ?? s.palette.accent
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <radialGradient id={`gb-${x}-${y}`}>
          <stop offset="0" stopColor={c} stopOpacity="0.9" />
          <stop offset="0.5" stopColor={c} stopOpacity="0.3" />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={x} cy={y} r={r} fill={`url(#gb-${x}-${y})`} />
    </svg>
  )
}

/**
 * The headline: 1 to 3 short lines of huge heavy type with a thick dark outline and a drop shadow.
 * `highlight` is the index of a word (across all lines) that gets the accent colour on a tilted box.
 */
export function BigText({
  lines,
  x,
  y,
  size = 210,
  color = '#ffffff',
  highlight,
  highlightColor,
  align = 'start',
  rotate = -3
}: {
  lines: string[]
  x: number
  y: number
  size?: number
  color?: string
  highlight?: number
  highlightColor?: string
  align?: 'start' | 'middle' | 'end'
  rotate?: number
}) {
  const s = useScene()
  const hc = highlightColor ?? s.palette.accent
  let n = 0
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      <defs>
        <filter id="bt-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="14" stdDeviation="10" floodColor="#000" floodOpacity="0.55" />
        </filter>
      </defs>
      <g transform={`rotate(${rotate} ${x} ${y})`} filter="url(#bt-shadow)">
        {lines.map((line, li) => {
          const ly = y + li * size * 1.02
          const words = line.toUpperCase().split(/\s+/)
          return (
            <text
              key={li}
              x={x}
              y={ly}
              textAnchor={align}
              {...lettering(s.font)}
              fontSize={size}
              letterSpacing={-size * 0.03}
              fill={color}
              stroke="#0b0b0c"
              strokeWidth={size * 0.09}
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              {words.map((w, wi) => {
                const on = n++ === highlight
                return (
                  <tspan key={wi} fill={on ? hc : color}>
                    {w}
                    {wi < words.length - 1 ? ' ' : ''}
                  </tspan>
                )
              })}
            </text>
          )
        })}
      </g>
    </svg>
  )
}

/** A thick, slightly curved arrow that points at the thing to look at. */
export function Arrow({ from, to, color, width = 34 }: { from: [number, number]; to: [number, number]; color?: string; width?: number }) {
  // The style's accent unless told otherwise, so it looks like part of the video.
  color ??= useScene().palette.accent
  const [x1, y1] = from
  const [x2, y2] = to
  const mx = (x1 + x2) / 2 - (y2 - y1) * 0.25
  const my = (y1 + y2) / 2 + (x2 - x1) * 0.25
  const a = Math.atan2(y2 - my, x2 - mx)
  const h = width * 2.6
  const p1 = [x2 - h * Math.cos(a - 0.5), y2 - h * Math.sin(a - 0.5)]
  const p2 = [x2 - h * Math.cos(a + 0.5), y2 - h * Math.sin(a + 0.5)]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
      <g stroke="#0b0b0c" strokeWidth={width + 16} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d={`M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`} />
        <path d={`M${p1[0]} ${p1[1]} L${x2} ${y2} L${p2[0]} ${p2[1]}`} />
      </g>
      <g stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d={`M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`} />
        <path d={`M${p1[0]} ${p1[1]} L${x2} ${y2} L${p2[0]} ${p2[1]}`} />
      </g>
    </svg>
  )
}

/** A hand-drawn ring around the important thing. */
export function Ring({ x, y, rx = 220, ry, color, width = 22 }: { x: number; y: number; rx?: number; ry?: number; color?: string; width?: number }) {
  color ??= useScene().palette.accent
  const r2 = ry ?? rx * 0.75
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
      <path
        d={`M${x - rx} ${y} C${x - rx} ${y - r2 * 1.1} ${x + rx * 1.05} ${y - r2 * 1.05} ${x + rx} ${y} C${x + rx * 0.98} ${y + r2 * 1.1} ${x - rx * 1.1} ${y + r2} ${x - rx * 0.92} ${y - r2 * 0.25}`}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
      />
    </svg>
  )
}

/** A small tilted sticker for a number or one word ("$0", "NEW", "WHY?"). */
export function Sticker({ text, x, y, color, textColor = '#0b0b0c', rotate = 8, size = 90 }: { text: string; x: number; y: number; color?: string; textColor?: string; rotate?: number; size?: number }) {
  const s = useScene()
  const c = color ?? s.palette.accent
  const w = text.length * size * 0.62 + size * 0.9
  const h = size * 1.45
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
      <g transform={`rotate(${rotate} ${x} ${y})`}>
        <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={size * 0.28} fill={c} stroke="#0b0b0c" strokeWidth={10} />
        <text x={x} y={y + size * 0.35} textAnchor="middle" {...lettering(s.font)} fontSize={size} fill={textColor}>
          {text.toUpperCase()}
        </text>
      </g>
    </svg>
  )
}

/** Wraps any subject (SVG drawing, Character, Picture) and makes it bigger, with a white rim like a cut-out. */
export function Subject({ children, rim = 14 }: { children: React.ReactNode; rim?: number }) {
  return <div style={{ position: 'absolute', inset: 0, filter: `drop-shadow(0 0 ${rim / 2}px #fff) drop-shadow(0 0 ${rim / 2}px #fff) drop-shadow(0 18px 24px rgba(0,0,0,.55))` }}>{children}</div>
}
