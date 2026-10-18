import { useApp } from '@/store/app'
import { BUILTIN_STYLES } from '@shared/styles'

// Small hand-made SVG scenes that show each built-in style. Custom (learned) styles show their sample frame.
export function StylePreview({ id }: { id: string }) {
  const custom = useApp((s) => s.styles.find((x) => x.id === id))
  const st = BUILTIN_STYLES.find((s) => s.id === id) ?? custom
  if (!st) return <div className="h-full w-full bg-card2" />
  if (st.custom && st.source) return <img src={window.api.media.url(st.source)} className="h-full w-full object-cover" />
  const { bg, ink, accent, paper } = st.palette
  const font = st.stroke.texture === 'marker' || st.stroke.texture === 'chalk' ? 'Segoe Print, Comic Sans MS, cursive' : 'Segoe Print, cursive'
  return (
    <svg viewBox="0 0 320 180" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <rect width="320" height="180" fill={bg} />
      {id === 'hand-drawn-board' && (
        <g stroke={ink} fill="none" strokeWidth="1.4" strokeLinecap="round">
          <text x="40" y="22" fill={ink} fontSize="8" fontFamily={font} stroke="none">same face   same video   same edit</text>
          <line x1="20" y1="70" x2="230" y2="70" />
          {[50, 95, 140, 185].map((x) => (
            <g key={x}>
              <rect x={x - 6} y="52" width="12" height="16" rx="2" />
              <circle cx={x - 25} cy="74" r="4" />
            </g>
          ))}
          <rect x="245" y="45" width="55" height="35" rx="4" />
          <rect x="255" y="55" width="10" height="16" />
          <rect x="268" y="55" width="10" height="16" />
          <rect x="281" y="55" width="10" height="16" />
          <text x="258" y="92" fill={ink} fontSize="7" fontFamily={font} stroke="none">the feed</text>
          <line x1="20" y1="150" x2="300" y2="150" />
          <circle cx="160" cy="132" r="4" />
          <line x1="160" y1="136" x2="160" y2="146" />
          <text x="110" y="165" fill={ink} fontSize="8" fontFamily={font} stroke="none">people scroll straight</text>
        </g>
      )}
      {id === 'notebook-sketch' && (
        <g>
          {Array.from({ length: 12 }, (_, i) => (
            <line key={i} x1="0" x2="320" y1={18 + i * 14} y2={18 + i * 14} stroke={paper} strokeWidth="0.6" />
          ))}
          <g stroke={ink} fill="none" strokeWidth="2">
            <rect x="30" y="25" width="85" height="65" />
            <circle cx="72" cy="45" r="8" />
            <path d="M72 53v18M60 62h24M72 71l-10 12M72 71l10 12" />
            <path d="M125 40q15 -10 30 0" stroke={accent} />
            <path d="M165 15h110v150l-8 -5-8 5-8-5-8 5-8-5-8 5-8-5-8 5-8-5-8 5-8-5-8 5-8-5z" fill="#fff" />
          </g>
          <text x="200" y="35" fontSize="10" fontFamily={font} fill={ink}>RECEIPT</text>
          {['ARTIST', 'ANIMATOR', 'EDITOR', 'MUSIC'].map((t, i) => (
            <text key={t} x="178" y={55 + i * 13} fontSize="7" fontFamily={font} fill={ink}>{t}<tspan x="255">$0</tspan></text>
          ))}
          <text x="178" y="130" fontSize="8" fontFamily={font} fill={ink}>TOTAL</text>
          <text x="222" y="133" fontSize="16" fontFamily={font} fill={ink}>$0.00</text>
          <ellipse cx="240" cy="128" rx="32" ry="13" stroke={accent} strokeWidth="2" fill="none" />
        </g>
      )}
      {id === 'chalkboard' && (
        <g stroke={ink} fill="none" strokeWidth="2" opacity=".92" fontFamily={font}>
          <text x="120" y="35" fill={ink} stroke="none" fontSize="15">how it works</text>
          <circle cx="70" cy="100" r="26" stroke="#e96a6a" />
          <text x="54" y="105" fill={ink} stroke="none" fontSize="14">idea</text>
          <path d="M100 95q25 -20 45 0" />
          <rect x="140" y="85" width="50" height="28" />
          <text x="147" y="104" fill={ink} stroke="none" fontSize="14">plan</text>
          <path d="M195 95q25 -20 45 0" />
          <text x="232" y="105" fill={ink} stroke="none" fontSize="14">result</text>
          <path d="M240 112h40" stroke={accent} />
          <path d="M262 55l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z" stroke={accent} />
        </g>
      )}
      {id === 'pencil-sketch' && (
        <g stroke={ink} fill="none" strokeWidth="1">
          <path d="M20 145l60-60 30 25 40-50 50 55 40-30 60 60z" fill="url(#hatch)" />
          <defs>
            <pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="4" stroke={ink} strokeWidth="1" opacity=".55" />
            </pattern>
          </defs>
          <circle cx="250" cy="40" r="12" />
          <path d="M60 50q60 -30 120 -20l40 -8-25 15" />
          <text x="110" y="168" fontSize="13" fontFamily={font} fill={ink} stroke="none">the first draft</text>
        </g>
      )}
      {id === 'risograph' && (
        <g>
          <defs>
            <pattern id="dots" width="5" height="5" patternUnits="userSpaceOnUse">
              <circle cx="2.5" cy="2.5" r="1.6" fill={ink} />
            </pattern>
          </defs>
          <rect x="30" y="35" width="110" height="75" fill="url(#dots)" stroke="#1d3d4a" strokeWidth="2" />
          <path d="M75 55l30 18-30 18z" fill="#1d3d4a" />
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <rect x={180 + i * 24} y={140 - i * 22} width="16" height={20 + i * 22} fill={ink} />
              <circle cx={188 + i * 24} cy={132 - i * 22} r="6" fill={accent} />
            </g>
          ))}
          <line x1="170" y1="160" x2="300" y2="160" stroke="#1d3d4a" strokeWidth="2" />
        </g>
      )}
      {id === 'sumi-ink' && (
        <g>
          <path d="M160 30a60 60 0 1 0 55 35" fill="none" stroke={ink} strokeWidth="9" strokeLinecap="round" opacity=".9" />
          <circle cx="110" cy="130" r="8" fill={ink} opacity=".6" />
          <text x="118" y="100" fontSize="26" fontStyle="italic" fontFamily="Georgia, serif" fill={ink}>breathe</text>
        </g>
      )}
      {id === 'paper-cutout' && (
        <g>
          <rect y="140" width="320" height="40" fill="#f6f1e6" />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect x={60 + i * 55} y={130 - i * 28} width="40" height={30 + i * 28} fill={ink} />
              <rect x={60 + i * 55} y={130 - i * 28} width="40" height="5" fill={accent} />
            </g>
          ))}
          <path d="M40 150L270 40" stroke="#fff" strokeWidth="3" />
          <path d="M270 40v-25l20 8z" fill={accent} />
        </g>
      )}
      {id === 'blueprint' && (
        <g>
          <defs>
            <pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M16 0H0V16" fill="none" stroke="#ffffff" strokeOpacity=".12" />
            </pattern>
          </defs>
          <rect width="320" height="180" fill="url(#grid)" />
          <g stroke={ink} fill="none" strokeWidth="1.2">
            <path d="M80 110l70 -35 110 55-70 35z" />
            <path d="M120 95v-35l30 -15v35M150 45l30 15v35" />
            <path d="M190 105v-50l20 10v50M210 65l20 -10" />
            <circle cx="195" cy="40" r="5" />
            <path d="M210 30v-15l12 4" />
          </g>
        </g>
      )}
      {id === 'engraving' && (
        <g stroke={ink} fill="none" strokeWidth=".7">
          {Array.from({ length: 22 }, (_, i) => (
            <ellipse key={i} cx="160" cy="90" rx={20 + i * 6} ry={10 + i * 3} opacity=".5" />
          ))}
          <rect x="10" y="10" width="300" height="160" strokeWidth="2" />
          <circle cx="270" cy="40" r="16" strokeWidth="1.5" />
          <text x="135" y="98" fontSize="18" fill={ink} stroke="none" fontFamily="Georgia, serif">ONE</text>
        </g>
      )}
      {id === 'cartoon-history' && (
        <g>
          <rect x="20" y="20" width="280" height="140" fill="#2f4062" stroke="#d9b56a" strokeWidth="5" />
          <rect x="125" y="40" width="70" height="90" fill={accent} stroke="#d9b56a" strokeWidth="3" />
          <circle cx="160" cy="85" r="18" fill="#f2c94c" />
          <rect x="40" y="50" width="60" height="70" fill="#3b5078" />
          <rect x="220" y="50" width="60" height="70" fill="#3b5078" />
        </g>
      )}
      {id === 'neon-ledger' && (
        <g>
          <text x="160" y="40" textAnchor="middle" fontSize="13" fill={ink}>from idea to first sale</text>
          <path d="M30 150l50-20 40 10 50-45 40 15 70-75" fill="none" stroke={accent} strokeWidth="3" style={{ filter: 'drop-shadow(0 0 4px #33e1a1)' }} />
          <circle cx="280" cy="35" r="5" fill={accent} />
        </g>
      )}
      {id === 'watercolour' && (
        <g>
          <ellipse cx="90" cy="70" rx="90" ry="40" fill="#8fb6de" opacity=".45" />
          <ellipse cx="240" cy="60" rx="100" ry="45" fill="#bcd3ea" opacity=".5" />
          <path d="M0 140q80-50 160-10t160-20v70H0z" fill="#9cc29b" opacity=".6" />
          <path d="M0 150q80-40 160 -5t160 -10" stroke={ink} fill="none" />
          <rect x="250" y="95" width="10" height="25" fill={ink} />
        </g>
      )}
      {id === 'flat-cartoon' && (
        <g stroke={ink} strokeWidth="3" strokeLinejoin="round">
          <rect y="135" width="320" height="45" fill="#7ac36a" />
          <circle cx="270" cy="38" r="18" fill="#ffd34d" />
          <rect x="40" y="75" width="70" height="60" fill="#fff" />
          <path d="M32 78l43 -35 43 35z" fill={accent} />
          <rect x="65" y="105" width="18" height="30" fill="#b06a3b" />
          <circle cx="190" cy="78" r="16" fill="#f2c29b" />
          <rect x="176" y="96" width="28" height="36" rx="6" fill="#4f6fd8" />
          <path d="M204 104l20 -18" fill="none" />
          <path d="M176 132l-6 14M204 132l6 14" fill="none" />
        </g>
      )}
      {id === 'cinematic-3d' && (
        <g>
          <defs>
            <radialGradient id="c3a" cx=".35" cy=".3">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset=".45" stopColor={accent} />
              <stop offset="1" stopColor="#0d2a4a" />
            </radialGradient>
            <linearGradient id="c3b" x1="0" x2="1">
              <stop offset="0" stopColor="#2b3a5c" />
              <stop offset="1" stopColor="#101828" />
            </linearGradient>
          </defs>
          <ellipse cx="160" cy="150" rx="120" ry="14" fill="#000" opacity=".5" />
          <path d="M70 120l50 -25 50 25-50 25z" fill="#3a4d78" />
          <path d="M70 120v18l50 25v-18z" fill="url(#c3b)" />
          <path d="M170 120v18l-50 25v-18z" fill="#1a2440" />
          <circle cx="215" cy="80" r="34" fill="url(#c3a)" />
        </g>
      )}
      {id === 'short-3d' && (
        <g>
          <defs>
            <radialGradient id="s3a" cx=".3" cy=".25">
              <stop offset="0" stopColor="#fff" />
              <stop offset=".35" stopColor={accent} />
              <stop offset="1" stopColor="#5a2e00" />
            </radialGradient>
          </defs>
          <rect width="320" height="180" fill="url(#s3a)" opacity=".12" />
          <circle cx="160" cy="92" r="52" fill="url(#s3a)" />
          <text x="160" y="168" textAnchor="middle" fontSize="18" fontWeight="800" fill={ink}>
            DID YOU KNOW?
          </text>
        </g>
      )}
      {id === 'soft-3d' && (
        <g>
          <defs>
            <radialGradient id="g1" cx=".35" cy=".3">
              <stop offset="0" stopColor="#fff" />
              <stop offset="1" stopColor={accent} />
            </radialGradient>
            <radialGradient id="g2" cx=".35" cy=".3">
              <stop offset="0" stopColor="#fff" />
              <stop offset="1" stopColor="#8f84ff" />
            </radialGradient>
          </defs>
          <ellipse cx="160" cy="150" rx="110" ry="12" fill="#000" opacity=".1" />
          <circle cx="120" cy="105" r="38" fill="url(#g1)" />
          <rect x="175" y="70" width="70" height="70" rx="18" fill="url(#g2)" />
        </g>
      )}
      {id === 'isometric-3d' && (
        <g>
          {[
            [110, 110, 40],
            [160, 85, 70],
            [210, 110, 30],
            [160, 135, 20]
          ].map(([x, y, h], i) => (
            <g key={i}>
              <path d={`M${x} ${y}l25 -12 25 12-25 12z`} transform={`translate(-25 ${-h})`} fill="#7fb3ff" />
              <path d={`M${x - 25} ${y - h}v${h}l25 12v-${h}z`} fill="#3b6fc2" />
              <path d={`M${x} ${y - h + 12}v${h}l25 -12v-${h}z`} fill="#2a548f" />
            </g>
          ))}
        </g>
      )}
      {!BUILTIN_STYLES.some((b) => b.id === id) && (
        <g stroke={ink} fill="none" strokeWidth={Math.max(1, st.stroke.width)}>
          <path d="M40 130q60-80 120-30t120-40" />
          <circle cx="250" cy="50" r="14" stroke={accent} />
          <text x="40" y="160" fill={ink} stroke="none" fontSize="14" fontFamily={font}>{st.name}</text>
        </g>
      )}
    </svg>
  )
}
