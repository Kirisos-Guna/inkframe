// Thumbnail kit: bold, high-contrast pieces for one still frame (the 1920x1080 space, rendered at 1280x720).
// Everything here is static: a thumbnail is one picture, so nothing animates.
import React from 'react'
import { AbsoluteFill, Img, staticFile, useVideoConfig } from 'remotion'
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
  const w = text.length * size * (/[0900-0D7F]/.test(text) ? 0.95 : 0.62) + size * 0.9
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

/** Poster colours: the cream white and the three loud ones FetchDecode-style thumbnails use, one per line. */
const INK: Record<string, string> = { white: '#f4efe3', red: '#ff2b2b', yellow: '#ffc21a', orange: '#ff5a1f', green: '#39ff7a' }

/**
 * A FetchDecode-style thumbnail, the whole picture in one block: black, 2 or 3 huge heavy words stacked on the left
 * (each line as big as its length allows, cream white with ONE line in red, yellow or orange), and one big real
 * picture on the right, a person or the object the video is about, fading into the black. Optional: a small tagline
 * in tracked capitals over a red bar (`tag`), a green terminal line with a cursor (`term`), and a row of small logos
 * at the top (`logos`). `subject` is a file of the video ("m/…-cut.png" cut-out, or a photo "m/….jpg").
 */
export function Poster({
  lines,
  subject,
  tag,
  term,
  logos = [],
  side = 'right',
  bg = '#050505'
}: {
  lines: { text: string; color?: string }[]
  subject?: string
  tag?: string
  term?: string
  logos?: string[]
  side?: 'right' | 'left'
  bg?: string
}) {
  const { width } = useVideoConfig()
  const k = width / W
  const cut = !!subject && /-cut\.\w+$/.test(subject)
  const logo = !!subject && /-logo\.\w+$/.test(subject)
  const right = side === 'right'
  // The words' column: a little over half the frame, the picture takes the rest (and runs under the words' edge).
  const colX = right ? 70 : 900
  const colW = 1000
  const extra = (tag ? 90 : 0) + (term ? 90 : 0) + (logos.length ? 110 : 0)
  // Each line as big as its length allows (Anton capitals are about half an em wide), all lines fitting the height.
  const est = (t: string) => Math.max(2, t.length) * 0.46
  const want = lines.map((l) => Math.min(lines.length > 2 ? 330 : 430, colW / est(l.text)))
  const total = want.reduce((a, b) => a + b * 0.92, 0)
  const room = 980 - extra
  const fit = total > room ? room / total : 1
  const sizes = want.map((s) => Math.round(s * fit))
  const block = sizes.reduce((a, b) => a + b * 0.92, 0) + extra
  let y = Math.max(50, (H - block) / 2) + (logos.length ? 110 : 0)
  const fade = right ? 'linear-gradient(to right, transparent 0%, #000 32%)' : 'linear-gradient(to left, transparent 0%, #000 32%)'
  return (
    <AbsoluteFill style={{ background: bg, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `scale(${k})`, transformOrigin: '0 0' }}>
        {subject && (
          <div style={{ position: 'absolute', top: 0, bottom: 0, width: 1150, [right ? 'right' : 'left']: 0 }}>
            {logo ? (
              // A logo on a light card, so dark lettering shows on the black, in the middle of the picture's side.
              <div style={{ position: 'absolute', top: '50%', [right ? 'right' : 'left']: 70, transform: 'translateY(-50%) rotate(-3deg)', background: '#f4efe3', borderRadius: 40, padding: '60px 70px', boxShadow: '0 30px 80px rgba(0,0,0,.8), 0 0 80px rgba(255,255,255,.08)' }}>
                <Img src={staticFile(subject)} style={{ display: 'block', height: 300, maxWidth: 520, objectFit: 'contain' }} />
              </div>
            ) : cut ? (
              <Img
                src={staticFile(subject)}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  [right ? 'right' : 'left']: 20,
                  height: 1060,
                  maxWidth: 1100,
                  objectFit: 'contain',
                  objectPosition: 'bottom',
                  filter: 'drop-shadow(0 0 40px rgba(0,0,0,.9)) drop-shadow(-6px 0 24px rgba(255,255,255,.18)) contrast(1.08) saturate(1.1)'
                }}
              />
            ) : (
              <Img
                src={staticFile(subject)}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'contrast(1.12) saturate(1.15) brightness(0.92)', WebkitMaskImage: fade, maskImage: fade }}
              />
            )}
            {/* The light falls off toward the bottom and the edge, like a studio shot. */}
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 60% 35%, transparent 45%, rgba(0,0,0,.55) 100%)' }} />
          </div>
        )}
        {logos.length > 0 && (
          <div style={{ position: 'absolute', left: colX, top: 50, display: 'flex', gap: 34, alignItems: 'center' }}>
            {logos.slice(0, 5).map((l) => (
              <div key={l} style={{ background: '#f4efe3', borderRadius: 16, padding: '10px 16px' }}>
                <Img src={staticFile(l)} style={{ display: 'block', height: 56, maxWidth: 150, objectFit: 'contain' }} />
              </div>
            ))}
          </div>
        )}
        <svg width={W} height={H} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          {lines.map((l, i) => {
            const size = sizes[i]
            y += size * (i === 0 ? 0.86 : 0.92)
            const fill = INK[l.color ?? 'white'] ?? l.color
            const long = est(l.text) * size > colW
            return (
              <text
                key={i}
                x={colX}
                y={y}
                fontFamily="'Meme', Impact, 'Arial Black', sans-serif"
                fontSize={size}
                fill={fill}
                letterSpacing={-size * 0.01}
                style={{ textTransform: 'uppercase' }}
                {...(long ? { textLength: colW, lengthAdjust: 'spacingAndGlyphs' } : {})}
                filter="drop-shadow(0 10px 18px rgba(0,0,0,.6))"
              >
                {l.text.toUpperCase()}
              </text>
            )
          })}
        </svg>
        {(() => {
          let ty = y + 40
          const out: React.ReactNode[] = []
          if (tag) {
            out.push(
              <div key="tag" style={{ position: 'absolute', left: colX + 6, top: ty, fontFamily: "'Inter', 'Segoe UI', sans-serif", fontWeight: 800, fontSize: 46, letterSpacing: 6, color: '#f4efe3', textTransform: 'uppercase', borderTop: '7px solid #ff2b2b', paddingTop: 10 }}>
                {tag}
              </div>
            )
            ty += 90
          }
          if (term)
            out.push(
              <div key="term" style={{ position: 'absolute', left: colX + 6, top: ty, fontFamily: "'Code', 'Cascadia Mono', Consolas, monospace", fontSize: 52, color: INK.green }}>
                {'> '}
                {term}
                <span style={{ display: 'inline-block', width: 28, height: 50, background: INK.green, marginLeft: 8, verticalAlign: 'middle' }} />
              </div>
            )
          return out
        })()}
      </div>
    </AbsoluteFill>
  )
}
