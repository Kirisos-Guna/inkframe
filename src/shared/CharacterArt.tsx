import type { CharacterDef } from './types'

export const POSES = ['Stand', 'Wave', 'Point', 'Point up', 'Thumbs up', 'Cheer', 'Shrug', 'Think', 'Arms crossed', 'Present', 'Hold', 'Hands on hips', 'Facepalm', 'Explain', 'Walk'] as const
export const EXPRESSIONS = ['Neutral', 'Happy', 'Laughing', 'Surprised', 'Sad', 'Angry', 'Thinking', 'Wink', 'Worried', 'Smug'] as const
export const DRAWN_IN = ['Flat', 'Pen', 'Paper', 'Watercolour', 'Ink', 'Pixel', 'Riso', 'Chalk', 'Blueprint', 'Soft 3D', 'Cartoon History'] as const

const DRAW: Record<string, { line: string; fill: boolean; width: number; bg?: string }> = {
  Flat: { line: '#1b1b1f', fill: true, width: 3 },
  Pen: { line: '#f4f4f4', fill: false, width: 3 },
  Paper: { line: '#2a2a2a', fill: true, width: 1.5 },
  Watercolour: { line: '#2e3a46', fill: true, width: 1.6 },
  Ink: { line: '#111', fill: false, width: 4.5 },
  Pixel: { line: '#111', fill: true, width: 4 },
  Riso: { line: '#1a7f86', fill: true, width: 2.5 },
  Chalk: { line: '#ecefe8', fill: false, width: 3.5 },
  Blueprint: { line: '#e8f0ff', fill: false, width: 2 },
  'Soft 3D': { line: 'none', fill: true, width: 0 },
  'Cartoon History': { line: '#2b1d14', fill: true, width: 3 }
}

type Arm = { l: string; r: string; handL: [number, number]; handR: [number, number] }
// Shoulders at (72,150) and (128,150). Paths are drawn from the shoulder to the hand.
const ARMS: Record<string, Arm> = {
  Stand: { l: 'M72 150 L58 200 L56 236', r: 'M128 150 L142 200 L144 236', handL: [56, 240], handR: [144, 240] },
  Wave: { l: 'M72 150 L58 200 L56 236', r: 'M128 150 L162 120 L176 74', handL: [56, 240], handR: [178, 68] },
  Point: { l: 'M72 150 L58 200 L56 236', r: 'M128 150 L170 160 L196 150', handL: [56, 240], handR: [200, 148] },
  'Point up': { l: 'M72 150 L58 200 L56 236', r: 'M128 150 L150 120 L152 70', handL: [56, 240], handR: [152, 64] },
  'Thumbs up': { l: 'M72 150 L58 200 L56 236', r: 'M128 150 L150 190 L168 160', handL: [56, 240], handR: [170, 154] },
  Cheer: { l: 'M72 150 L46 116 L36 76', r: 'M128 150 L154 116 L164 76', handL: [34, 70], handR: [166, 70] },
  Shrug: { l: 'M72 150 L48 172 L30 150', r: 'M128 150 L152 172 L170 150', handL: [28, 146], handR: [172, 146] },
  Think: { l: 'M72 150 L60 200 L92 196', r: 'M128 150 L138 190 L112 132', handL: [94, 196], handR: [110, 128] },
  'Arms crossed': { l: 'M72 150 L80 186 L126 180', r: 'M128 150 L120 190 L74 184', handL: [128, 180], handR: [72, 184] },
  Present: { l: 'M72 150 L58 200 L56 236', r: 'M128 150 L168 178 L196 168', handL: [56, 240], handR: [200, 166] },
  Hold: { l: 'M72 150 L66 190 L90 200', r: 'M128 150 L134 190 L110 200', handL: [92, 202], handR: [108, 202] },
  'Hands on hips': { l: 'M72 150 L46 180 L72 210', r: 'M128 150 L154 180 L128 210', handL: [74, 212], handR: [126, 212] },
  Facepalm: { l: 'M72 150 L58 200 L56 236', r: 'M128 150 L130 150 L108 104', handL: [104, 98], handR: [104, 98] },
  Explain: { l: 'M72 150 L50 184 L34 168', r: 'M128 150 L150 184 L166 168', handL: [32, 164], handR: [168, 164] },
  Walk: { l: 'M72 150 L52 196 L40 228', r: 'M128 150 L150 196 L166 222', handL: [38, 232], handR: [168, 226] }
}

export function CharacterArt({ c, size = '100%' }: { c: CharacterDef; size?: number | string }) {
  const d = DRAW[c.drawnIn] ?? DRAW.Pen
  const line = d.line
  const sw = d.width
  const f = (col: string) => (d.fill ? col : 'none')
  const arms = ARMS[c.pose] ?? ARMS.Stand
  const bodyW = c.body === 'Slim' ? 24 : c.body === 'Broad' ? 36 : 30
  const head = { Round: [34, 34], Oval: [31, 37], Square: [34, 34], Long: [28, 40], Wide: [40, 32] }[c.head]
  const hx = 100
  const hy = 92
  const e = c.expression
  const eyeR = c.eyes === 'Big' ? 8 : c.eyes === 'Dots' ? 2.6 : 6
  const mouth =
    e === 'Happy' || e === 'Wink' ? `M88 ${hy + 14} Q100 ${hy + 26} 112 ${hy + 14}`
    : e === 'Laughing' ? `M86 ${hy + 12} Q100 ${hy + 32} 114 ${hy + 12} Z`
    : e === 'Surprised' ? ''
    : e === 'Sad' || e === 'Worried' ? `M90 ${hy + 22} Q100 ${hy + 14} 110 ${hy + 22}`
    : e === 'Angry' ? `M90 ${hy + 20} L110 ${hy + 20}`
    : e === 'Smug' ? `M92 ${hy + 18} Q104 ${hy + 22} 112 ${hy + 14}`
    : `M92 ${hy + 18} L108 ${hy + 18}`
  const browY = hy - 14
  const brow = (x: number, side: 1 | -1) => {
    if (c.eyebrows === 'None') return null
    const tilt = e === 'Angry' ? 5 * side : e === 'Worried' || e === 'Sad' ? -4 * side : e === 'Surprised' ? 0 : 0
    const lift = e === 'Surprised' ? -5 : 0
    const w = c.eyebrows === 'Thick' ? sw * 1.8 : sw * 0.9
    const path = c.eyebrows === 'Arched'
      ? `M${x - 8} ${browY + lift + 2} Q${x} ${browY + lift - 5} ${x + 8} ${browY + lift + 2}`
      : `M${x - 8} ${browY + lift - tilt} L${x + 8} ${browY + lift + tilt}`
    return <path d={path} stroke={line === 'none' ? '#3b2a20' : line} strokeWidth={w} fill="none" strokeLinecap="round" />
  }
  const eye = (x: number, wink = false) => {
    if (wink) return <path d={`M${x - 6} ${hy - 2} Q${x} ${hy + 3} ${x + 6} ${hy - 2}`} stroke={line} strokeWidth={sw} fill="none" />
    if (c.eyes === 'Sleepy') return <path d={`M${x - 6} ${hy} L${x + 6} ${hy}`} stroke={line} strokeWidth={sw} />
    return (
      <g>
        <circle cx={x} cy={hy - 2} r={eyeR} fill={d.fill ? '#fff' : 'none'} stroke={line} strokeWidth={sw * 0.8} />
        <circle cx={x} cy={hy - 1} r={Math.max(1.6, eyeR * 0.45)} fill={d.fill ? c.eyeColour : line} />
        {c.eyes === 'Lashes' && <path d={`M${x - 6} ${hy - 8} l-3 -3 M${x + 6} ${hy - 8} l3 -3`} stroke={line} strokeWidth={sw * 0.7} />}
      </g>
    )
  }
  const hairPath = {
    Bob: `M${hx - head[0] - 3} ${hy + 18} Q${hx - head[0] - 6} ${hy - head[1] - 8} ${hx} ${hy - head[1] - 4} Q${hx + head[0] + 6} ${hy - head[1] - 8} ${hx + head[0] + 3} ${hy + 18} L${hx + head[0] - 4} ${hy + 18} Q${hx + head[0] - 4} ${hy - 16} ${hx} ${hy - 22} Q${hx - head[0] + 4} ${hy - 16} ${hx - head[0] + 4} ${hy + 18} Z`,
    Short: `M${hx - head[0]} ${hy - 6} Q${hx - head[0]} ${hy - head[1] - 8} ${hx} ${hy - head[1] - 6} Q${hx + head[0]} ${hy - head[1] - 8} ${hx + head[0]} ${hy - 6} Q${hx} ${hy - 26} ${hx - head[0]} ${hy - 6} Z`,
    Long: `M${hx - head[0] - 4} ${hy + 50} Q${hx - head[0] - 8} ${hy - head[1] - 10} ${hx} ${hy - head[1] - 5} Q${hx + head[0] + 8} ${hy - head[1] - 10} ${hx + head[0] + 4} ${hy + 50} L${hx + head[0] - 4} ${hy + 50} Q${hx + head[0] - 2} ${hy - 18} ${hx} ${hy - 22} Q${hx - head[0] + 2} ${hy - 18} ${hx - head[0] + 4} ${hy + 50} Z`,
    Bun: `M${hx - head[0]} ${hy - 4} Q${hx - head[0]} ${hy - head[1] - 6} ${hx} ${hy - head[1] - 4} Q${hx + head[0]} ${hy - head[1] - 6} ${hx + head[0]} ${hy - 4} Q${hx} ${hy - 24} ${hx - head[0]} ${hy - 4} Z M${hx - 12} ${hy - head[1] - 6} a12 12 0 1 1 24 0 a12 12 0 1 1 -24 0`,
    Curly: `M${hx - head[0] - 4} ${hy} ${Array.from({ length: 9 }, (_, i) => { const a = Math.PI + (i / 8) * Math.PI; return `Q${hx + Math.cos(a - 0.2) * (head[0] + 16)} ${hy - 6 + Math.sin(a - 0.2) * (head[1] + 16)} ${hx + Math.cos(a) * (head[0] + 4)} ${hy - 6 + Math.sin(a) * (head[1] + 4)}` }).join(' ')} Q${hx} ${hy - 24} ${hx - head[0] - 4} ${hy} Z`,
    Ponytail: `M${hx - head[0]} ${hy - 4} Q${hx - head[0]} ${hy - head[1] - 8} ${hx} ${hy - head[1] - 6} Q${hx + head[0]} ${hy - head[1] - 8} ${hx + head[0]} ${hy - 4} Q${hx} ${hy - 26} ${hx - head[0]} ${hy - 4} Z`,
    Afro: `M${hx - head[0] - 2} ${hy - 2} Q${hx - head[0] - 4} ${hy - head[1] - 10} ${hx} ${hy - head[1] - 8} Q${hx + head[0] + 4} ${hy - head[1] - 10} ${hx + head[0] + 2} ${hy - 2} Q${hx} ${hy - 22} ${hx - head[0] - 2} ${hy - 2} Z`,
    Spiky: `M${hx - head[0]} ${hy - 8} L${hx - head[0] + 4} ${hy - head[1] - 10} L${hx - 14} ${hy - head[1] - 2} L${hx - 6} ${hy - head[1] - 16} L${hx + 4} ${hy - head[1] - 3} L${hx + 14} ${hy - head[1] - 15} L${hx + 18} ${hy - head[1] - 1} L${hx + head[0]} ${hy - head[1] - 8} L${hx + head[0]} ${hy - 8} Q${hx} ${hy - 24} ${hx - head[0]} ${hy - 8} Z`,
    'Side part': `M${hx - head[0]} ${hy - 2} Q${hx - head[0] - 2} ${hy - head[1] - 8} ${hx - 6} ${hy - head[1] - 6} Q${hx + head[0] + 8} ${hy - head[1] - 10} ${hx + head[0]} ${hy - 4} Q${hx + 8} ${hy - 30} ${hx - 8} ${hy - 18} Q${hx - 20} ${hy - 12} ${hx - head[0]} ${hy - 2} Z`,
    Bald: ''
  }[c.hair]
  const hairBack =
    c.hair === 'Afro' ? `M${hx} ${hy - 4} m-${head[0] + 22} 0 a${head[0] + 22} ${head[1] + 18} 0 1 0 ${(head[0] + 22) * 2} 0 a${head[0] + 22} ${head[1] + 18} 0 1 0 -${(head[0] + 22) * 2} 0`
    : c.hair === 'Ponytail' ? `M${hx + head[0] - 6} ${hy - 20} Q${hx + head[0] + 26} ${hy - 10} ${hx + head[0] + 14} ${hy + 40} Q${hx + head[0] + 4} ${hy + 10} ${hx + head[0] - 6} ${hy - 6} Z`
    : ''
  const age = c.age ?? 'Adult'
  const facial = c.facialHair ?? 'None'
  const hat = c.hat ?? 'None'
  const hairLine = line === 'none' ? '#3b2a20' : line
  const outfitCol = c.outfit === 'Lab coat' ? '#f4f4f4' : c.outfitColour
  return (
    <svg viewBox="0 0 200 300" width={size} height={size} className="block">
      <defs>
        <radialGradient id={`soft-${c.id}`} cx=".35" cy=".3">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".55" />
          <stop offset="1" stopColor="#000000" stopOpacity=".12" />
        </radialGradient>
      </defs>
      <g strokeLinecap="round" strokeLinejoin="round" transform={age === 'Kid' ? 'translate(100 290) scale(0.78) translate(-100 -290)' : undefined}>
        {/* legs */}
        {(d.fill || c.pose === 'Walk') && (
          <path
            d={c.pose === 'Walk' ? `M90 226 L80 284 M110 226 L124 284` : `M88 226 L88 282 M112 226 L112 282`}
            stroke={line === 'none' ? '#33333a' : line}
            strokeWidth={d.fill ? 14 : sw}
            fill="none"
          />
        )}
        {!d.fill && (
          <path d={`M80 226 V280 H96 V226 M104 226 V280 H120 V226`} stroke={line} strokeWidth={sw} fill="none" opacity={c.pose === 'Walk' ? 0 : 1} />
        )}
        <path d="M74 284 q8 -10 22 0 z M104 284 q8 -10 22 0 z" fill={f('#2b2b30')} stroke={line} strokeWidth={sw} />
        {/* body */}
        <path
          d={
            c.outfit === 'Dress'
              ? `M${100 - bodyW} 150 Q${100 - bodyW - 2} 190 ${100 - bodyW - 16} 238 L${100 + bodyW + 16} 238 Q${100 + bodyW + 2} 190 ${100 + bodyW} 150 Q100 136 ${100 - bodyW} 150 Z`
              : `M${100 - bodyW} 150 Q${100 - bodyW - 4} 200 ${100 - bodyW + 2} 230 L${100 + bodyW - 2} 230 Q${100 + bodyW + 4} 200 ${100 + bodyW} 150 Q100 136 ${100 - bodyW} 150 Z`
          }
          fill={f(outfitCol)}
          stroke={line}
          strokeWidth={sw}
        />
        {c.outfit === 'Lab coat' && (
          <g stroke={line === 'none' ? '#999' : line} strokeWidth={sw * 0.8} fill="none">
            <path d="M100 140 L100 230 M88 142 L100 166 L112 142" />
            <circle cx="88" cy="180" r="5" />
            <path d="M88 175 q-6 -20 6 -32" />
          </g>
        )}
        {c.outfit === 'Suit' && <path d="M100 142 L94 164 L100 200 L106 164 Z" fill={f('#c8372d')} stroke={line} strokeWidth={sw * 0.7} />}
        {c.outfit === 'Hoodie' && <path d="M84 146 q16 18 32 0" fill="none" stroke={line} strokeWidth={sw} />}
        {c.outfit === 'Apron' && <rect x="84" y="170" width="32" height="56" fill={f('#3c8c5a')} stroke={line} strokeWidth={sw * 0.8} />}
        {c.outfit === 'Jacket' && (
          <g stroke={line} strokeWidth={sw * 0.8}>
            <path d="M90 142 L100 172 L110 142 Z" fill={f('#f2f2f2')} />
            <path d="M90 142 L84 176 L100 172 M110 142 L116 176 L100 172 M100 172 V230" fill="none" />
          </g>
        )}
        {c.outfit === 'Overalls' && (
          <g stroke={line} strokeWidth={sw * 0.8}>
            <path d="M84 176 H116 V230 H84 Z" fill={f('#3d5a99')} />
            <path d="M86 176 L82 146 M114 176 L118 146" fill="none" strokeWidth={sw * 1.4} />
            <circle cx="88" cy="182" r="2.5" fill={f('#f2c94c')} />
            <circle cx="112" cy="182" r="2.5" fill={f('#f2c94c')} />
          </g>
        )}
        {c.outfit === 'Sweater' && <path d="M86 146 q14 10 28 0 M80 222 h40" fill="none" stroke={line} strokeWidth={sw * 0.8} strokeDasharray="3 3" />}
        {/* arms */}
        {[arms.l, arms.r].map((a, i) => (
          <path key={i} d={a} stroke={line === 'none' ? outfitCol : line} strokeWidth={d.fill ? 12 : sw} fill="none" />
        ))}
        {d.fill && [arms.l, arms.r].map((a, i) => <path key={'o' + i} d={a} stroke={outfitCol} strokeWidth={8} fill="none" />)}
        {[arms.handL, arms.handR].map(([x, y], i) => (
          <circle key={'h' + i} cx={x} cy={y} r={7} fill={f(c.skin)} stroke={line} strokeWidth={sw} />
        ))}
        {/* neck + head */}
        <rect x="93" y={hy + head[1] - 6} width="14" height="14" fill={f(c.skin)} stroke={line} strokeWidth={sw * 0.8} />
        {hairBack && <path d={hairBack} fill={f(c.hairColour)} stroke={line} strokeWidth={sw} />}
        {c.head === 'Square' ? (
          <rect x={hx - head[0]} y={hy - head[1]} width={head[0] * 2} height={head[1] * 2} rx={12} fill={f(c.skin)} stroke={line} strokeWidth={sw} />
        ) : (
          <ellipse cx={hx} cy={hy} rx={head[0]} ry={head[1]} fill={f(c.skin)} stroke={line} strokeWidth={sw} />
        )}
        {c.drawnIn === 'Soft 3D' && <ellipse cx={hx} cy={hy} rx={head[0]} ry={head[1]} fill={`url(#soft-${c.id})`} />}
        {hairPath && <path d={hairPath} fill={f(c.hairColour)} stroke={line} strokeWidth={sw} />}
        {facial === 'Beard' && <path d={`M${hx - head[0] + 4} ${hy + 4} Q${hx - head[0] + 6} ${hy + head[1] + 8} ${hx} ${hy + head[1] + 10} Q${hx + head[0] - 6} ${hy + head[1] + 8} ${hx + head[0] - 4} ${hy + 4} Q${hx} ${hy + 14} ${hx - head[0] + 4} ${hy + 4} Z`} fill={f(c.hairColour)} stroke={line} strokeWidth={sw * 0.8} />}
        {facial === 'Stubble' && <path d={`M${hx - head[0] + 8} ${hy + 12} Q${hx} ${hy + head[1] + 6} ${hx + head[0] - 8} ${hy + 12}`} fill="none" stroke={hairLine} strokeWidth={sw * 2.4} strokeDasharray="1 3" opacity={0.6} />}
        {age === 'Older' && <path d={`M${hx - 12} ${hy - 22} q12 -4 24 0 M${hx - 9} ${hy - 27} q9 -3 18 0`} fill="none" stroke={hairLine} strokeWidth={sw * 0.5} opacity={0.6} />}
        {eye(hx - 13)}
        {eye(hx + 13, e === 'Wink')}
        {brow(hx - 13, -1)}
        {brow(hx + 13, 1)}
        {c.glasses && (
          <g fill="none" stroke={line === 'none' ? '#333' : line} strokeWidth={sw * 0.8}>
            <circle cx={hx - 13} cy={hy - 2} r={10} />
            <circle cx={hx + 13} cy={hy - 2} r={10} />
            <path d={`M${hx - 3} ${hy - 2} h6`} />
          </g>
        )}
        {c.nose === 'Dot' && <circle cx={hx} cy={hy + 6} r={1.8} fill={line === 'none' ? '#a0603a' : line} />}
        {c.nose === 'Button' && <path d={`M${hx - 3} ${hy + 8} q3 3 6 0`} stroke={line} strokeWidth={sw * 0.8} fill="none" />}
        {c.nose === 'Long' && <path d={`M${hx} ${hy} l-4 10 h5`} stroke={line} strokeWidth={sw * 0.8} fill="none" />}
        {e === 'Surprised' ? (
          <ellipse cx={hx} cy={hy + 19} rx={5} ry={6} fill={f('#5a2a2a')} stroke={line} strokeWidth={sw * 0.8} />
        ) : (
          <path d={mouth} stroke={line === 'none' ? '#5a2a2a' : line} strokeWidth={sw * 0.9} fill={e === 'Laughing' ? f('#7a2e2e') : 'none'} />
        )}
        {facial === 'Mustache' && <path d={`M${hx - 12} ${hy + 14} Q${hx - 6} ${hy + 8} ${hx} ${hy + 12} Q${hx + 6} ${hy + 8} ${hx + 12} ${hy + 14} Q${hx} ${hy + 16} ${hx - 12} ${hy + 14} Z`} fill={f(c.hairColour)} stroke={hairLine} strokeWidth={sw * 0.7} />}
        {hat === 'Cap' && (
          <g stroke={line} strokeWidth={sw}>
            <path d={`M${hx - head[0] - 2} ${hy - 12} Q${hx - head[0]} ${hy - head[1] - 14} ${hx} ${hy - head[1] - 12} Q${hx + head[0]} ${hy - head[1] - 14} ${hx + head[0] + 2} ${hy - 12} Z`} fill={f(c.outfitColour)} />
            <path d={`M${hx + head[0] - 4} ${hy - 14} q28 0 34 8 q-20 4 -34 0 z`} fill={f(c.outfitColour)} />
          </g>
        )}
        {hat === 'Beanie' && (
          <g stroke={line} strokeWidth={sw}>
            <path d={`M${hx - head[0] - 2} ${hy - 10} Q${hx - head[0]} ${hy - head[1] - 20} ${hx} ${hy - head[1] - 18} Q${hx + head[0]} ${hy - head[1] - 20} ${hx + head[0] + 2} ${hy - 10} Z`} fill={f(c.outfitColour)} />
            <rect x={hx - head[0] - 3} y={hy - 18} width={(head[0] + 3) * 2} height={10} rx={4} fill={f(c.outfitColour)} />
          </g>
        )}
        {hat === 'Hard hat' && (
          <g stroke={line} strokeWidth={sw}>
            <path d={`M${hx - head[0]} ${hy - 12} Q${hx - head[0]} ${hy - head[1] - 20} ${hx} ${hy - head[1] - 18} Q${hx + head[0]} ${hy - head[1] - 20} ${hx + head[0]} ${hy - 12} Z`} fill={f('#f2c230')} />
            <rect x={hx - head[0] - 10} y={hy - 15} width={(head[0] + 10) * 2} height={7} rx={3} fill={f('#f2c230')} />
            <path d={`M${hx} ${hy - head[1] - 17} V${hy - 13}`} fill="none" />
          </g>
        )}
        {c.headphones && (
          <g stroke={line === 'none' ? '#222' : line} strokeWidth={sw}>
            <path d={`M${hx - head[0] - 4} ${hy} Q${hx - head[0] - 6} ${hy - head[1] - 16} ${hx} ${hy - head[1] - 14} Q${hx + head[0] + 6} ${hy - head[1] - 16} ${hx + head[0] + 4} ${hy}`} fill="none" strokeWidth={sw * 1.6} />
            <rect x={hx - head[0] - 10} y={hy - 8} width={12} height={22} rx={5} fill={f('#2b2b30')} />
            <rect x={hx + head[0] - 2} y={hy - 8} width={12} height={22} rx={5} fill={f('#2b2b30')} />
          </g>
        )}
        {e === 'Thinking' && <path d="M150 50 a6 6 0 1 1 0.1 0 M160 34 a9 9 0 1 1 0.1 0" stroke={line} fill="none" strokeWidth={sw * 0.7} />}
      </g>
    </svg>
  )
}

export { newCharacter } from './characterDefaults'
