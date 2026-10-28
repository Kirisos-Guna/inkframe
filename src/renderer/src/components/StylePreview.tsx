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
      {id === 'systems-diagram' && (
        <g fontFamily="'Permanent Marker', cursive">
          {/* Browser */}
          <rect x="28" y="30" width="130" height="62" rx="7" fill={paper} />
          <rect x="34" y="34" width="40" height="9" rx="3" fill="#26272c" />
          <text x="38" y="41" fontSize="5" fill="#c9c9d1" fontFamily="Inter, sans-serif">New Tab</text>
          <rect x="34" y="46" width="118" height="10" rx="5" fill="#26272c" />
          <text x="40" y="53.5" fontSize="5.5" fontFamily="Inter, sans-serif">
            <tspan fill="#f6b73c">https://</tspan>
            <tspan fill="#ececf1"> example.com</tspan>
          </text>
          {/* Connector with data on it */}
          <rect x="88" y="98" width="6" height="34" rx="3" fill={accent} />
          <circle cx="91" cy="98" r="4" fill={bg} stroke={accent} strokeWidth="2" />
          <circle cx="91" cy="132" r="4" fill={bg} stroke={accent} strokeWidth="2" />
          <rect x="44" y="108" width="28" height="12" rx="6" fill={accent} />
          <text x="58" y="117" fontSize="7" textAnchor="middle" fill="#101014">TCP</text>
          <rect x="108" y="108" width="34" height="12" rx="6" fill="#f6b73c" />
          <text x="125" y="117" fontSize="7" textAnchor="middle" fill="#101014">HTTP</text>
          {/* Server */}
          <rect x="62" y="138" width="60" height="34" rx="6" fill={paper} />
          <circle cx="76" cy="155" r="8" fill="#26272c" />
          <path d="M76 149a6 6 0 1 0 6 6h-6" fill="none" stroke="#f0569a" strokeWidth="2" />
          {[145, 154, 163].map((y) => (
            <rect key={y} x="88" y={y - 3} width="28" height="6" rx="2" fill="#26272c" />
          ))}
          {/* Layers on the right */}
          <text x="236" y="26" fontSize="10" textAnchor="middle" fill={ink}>SECURE THIS</text>
          <line x1="206" y1="30" x2="266" y2="30" stroke={ink} strokeWidth="0.8" />
          {[
            ['HTTP', '#f6b73c'],
            ['TLS', '#f0569a'],
            ['TCP', accent],
            ['IP', '#9b7cf0']
          ].map(([t, c], i) => (
            <g key={t}>
              <rect x="180" y={42 + i * 30} width="120" height="22" rx="5" fill={paper} />
              <text x="187" y={57 + i * 30} fontSize="9" fill={c}>
                {t}
              </text>
            </g>
          ))}
          <rect x="226" y="80" width="50" height="5" rx="2.5" fill="#f0569a" />
          <circle cx="226" cy="82.5" r="3.5" fill={bg} stroke="#f0569a" strokeWidth="1.6" />
          <circle cx="276" cy="82.5" r="3.5" fill={bg} stroke="#f0569a" strokeWidth="1.6" />
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
      {id === 'ink-wash-cartoon' && (
        <g>
          <rect x="40" y="40" width="150" height="100" fill="#7fb0d6" opacity=".35" />
          <ellipse cx="225" cy="95" rx="55" ry="40" fill="#e8a87c" opacity=".45" />
          <g stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round">
            <rect x="60" y="60" width="110" height="70" rx="6" />
            <path d="M90 95h50M90 110h30" />
            <circle cx="230" cy="80" r="18" />
            <path d="M230 98v34M230 110l-16 14M230 110l18 -12M230 132l-12 20M230 132l12 20" />
            <path d="M222 76h2M236 76h2M224 86q6 5 12 0" />
          </g>
          <text x="245" y="55" fontSize="14" fontFamily={font} fill={accent}>!</text>
        </g>
      )}
      {id === 'living-ink' && (
        <g fill={ink}>
          <path d="M60 120 C 90 40, 150 40, 170 90 S 240 150, 270 70" fill="none" stroke={ink} strokeWidth="10" strokeLinecap="round" />
          <circle cx="275" cy="62" r="12" />
          <circle cx="110" cy="140" r="7" opacity=".7" />
          <circle cx="122" cy="148" r="3" opacity=".6" />
          <rect x="250" y="130" width="22" height="22" fill={accent} rx="2" />
        </g>
      )}
      {id === 'cut-paper-poster' && (
        <g>
          <path d="M0 120 L120 60 L320 140 V180 H0Z" fill={paper} />
          <path d="M180 0 H320 V80 Q260 100 200 70Z" fill={accent} />
          <circle cx="250" cy="40" r="22" fill="#f6d55c" />
          <text x="22" y="70" fontSize="44" fontWeight="900" fontFamily="Impact, Segoe UI Black, sans-serif" fill={ink}>BIG</text>
          <text x="22" y="108" fontSize="30" fontWeight="900" fontFamily="Impact, Segoe UI Black, sans-serif" fill={ink}>IDEAS</text>
        </g>
      )}
      {id === 'shadow-puppets' && (
        <g>
          <radialGradient id="spg" cx=".5" cy=".45" r=".7">
            <stop offset="0" stopColor="#ffe6a8" />
            <stop offset="1" stopColor="#c46a12" />
          </radialGradient>
          <rect width="320" height="180" fill="url(#spg)" />
          <g fill={ink} stroke={ink}>
            <circle cx="110" cy="70" r="14" />
            <path d="M98 84 h24 l6 50 h-36z" />
            <path d="M120 90 l30 -12" strokeWidth="5" />
            <path d="M230 120 q-40 -50 -10 -70 q30 -10 40 30 q10 30 -30 40z" />
            <path d="M110 134 L110 180 M150 78 L170 180 M240 120 L240 180" strokeWidth="1.5" />
          </g>
        </g>
      )}
      {id === 'cutaways' && (
        <g>
          <rect x="60" y="40" width="140" height="100" rx="14" fill={paper} stroke={ink} strokeWidth="2" />
          <path d="M130 40 V140" stroke={ink} strokeDasharray="4 4" />
          <rect x="138" y="52" width="54" height="76" rx="6" fill="#fff" stroke={ink} />
          <circle cx="165" cy="76" r="12" fill={accent} />
          <rect x="148" y="98" width="34" height="18" fill="#9fb8c8" />
          <g stroke={ink} strokeWidth="1">
            <path d="M177 76 L240 50 H290" />
            <path d="M182 107 L240 120 H290" />
          </g>
          <text x="244" y="46" fontSize="10" fill={ink} fontFamily="Segoe UI">MOTOR</text>
          <text x="244" y="116" fontSize="10" fill={ink} fontFamily="Segoe UI">BATTERY</text>
        </g>
      )}
      {id === 'character-stories' && (
        <g>
          <rect y="130" width="320" height="50" fill="#e9dcc6" />
          <rect x="30" y="40" width="70" height="90" fill="#cfe3f0" stroke={ink} strokeWidth="3" />
          <g stroke={ink} strokeWidth="3">
            <circle cx="170" cy="80" r="16" fill="#f2c29b" />
            <rect x="156" y="98" width="28" height="34" rx="6" fill={accent} />
            <circle cx="245" cy="84" r="14" fill="#c98f6a" />
            <rect x="232" y="100" width="26" height="32" rx="6" fill="#4f6fd8" />
          </g>
          <path d="M190 40 h70 v26 h-50 l-10 10 v-10 h-10z" fill="#fff" stroke={ink} strokeWidth="2" />
          <text x="200" y="58" fontSize="12" fontFamily={font} fill={ink}>Wait, what?</text>
        </g>
      )}
      {id === 'cartoon-music-video' && (
        <g>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <rect key={i} x={20 + i * 37} y={150 - (i % 4) * 22 - 20} width="22" height={(i % 4) * 22 + 20} rx="4" fill={i % 2 ? paper : accent} />
          ))}
          <circle cx="160" cy="62" r="30" fill={accent} stroke={ink} strokeWidth="4" />
          <path d="M148 58h4M168 58h4M148 72q12 10 24 0" stroke="#2b1055" strokeWidth="4" fill="none" />
          <text x="236" y="44" fontSize="26" fill={ink}>♪</text>
          <text x="40" y="40" fontSize="20" fill={ink}>♫</text>
        </g>
      )}
      {id === 'paper-plane-3d' && (
        <g>
          <circle cx="250" cy="40" r="20" fill="#f4a261" />
          <path d="M0 110 q60 -30 120 -5 t200 -15 V180 H0z" fill="#e76f51" opacity=".85" />
          <path d="M0 130 q80 -25 160 0 t160 -10 V180 H0z" fill="#2a9d8f" />
          <path d="M0 150 q70 -15 150 5 t170 -5 V180 H0z" fill="#264653" />
          <path d="M120 90 l70 -28 -36 34z" fill="#fffaf0" />
          <path d="M120 90 l34 6 2 12z" fill="#e8dfcf" />
        </g>
      )}
      {id === 'popup-book-3d' && (
        <g>
          <path d="M20 150 L160 130 L300 150 L300 160 L160 140 L20 160Z" fill="#f2e6d0" />
          <path d="M160 130 V140" stroke="#8a6a50" />
          <path d="M70 140 L70 80 L110 60 L150 80 L150 135Z" fill="#f7efe2" stroke="#8a6a50" />
          <path d="M100 135 V105 h20 v30" fill={accent} />
          <path d="M190 135 L210 70 L230 135Z" fill="#7fb069" />
          <path d="M235 135 L250 90 L265 135Z" fill="#5b8c51" />
          <ellipse cx="160" cy="158" rx="150" ry="8" fill="#000" opacity=".35" />
        </g>
      )}
      {id === 'blueprint-3d' && (
        <g stroke={ink} fill="none" strokeWidth="1.3">
          <defs>
            <pattern id="bg3" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M20 0H0V20" stroke="#fff" strokeOpacity=".08" />
            </pattern>
          </defs>
          <rect width="320" height="180" fill="url(#bg3)" stroke="none" />
          <path d="M110 120 l50 -25 50 25 -50 25z M110 120 v-40 l50 -25 50 25 v40 M160 95 v-40" />
          <path d="M210 80 l30 -15" stroke={accent} />
          <path d="M240 65 l20 10 -30 15" stroke={accent} strokeDasharray="4 3" />
          <text x="240" y="58" fontSize="10" fill={ink} stroke="none" fontFamily="Segoe UI">rotor</text>
        </g>
      )}
      {id === 'pencil-3d' && (
        <g stroke={ink} fill="none" strokeWidth="1.2" opacity=".85">
          <path d="M100 120 l60 -30 60 30 -60 30z" />
          <path d="M100 120 v-50 l60 -30 60 30 v50 M160 90 v-50" />
          <path d="M100 70 l60 30 60 -30" strokeDasharray="3 3" />
          <path d="M115 128 l40 20 M125 124 l40 20 M135 120 l40 20" strokeWidth=".6" />
        </g>
      )}
      {id === 'little-worlds-3d' && (
        <g>
          <ellipse cx="160" cy="120" rx="110" ry="34" fill="#6fb36b" />
          <path d="M50 120 q110 70 220 0 v12 q-110 70 -220 0z" fill="#8a5a3b" />
          <rect x="110" y="85" width="30" height="28" fill="#fff4e0" />
          <path d="M106 86 l19 -16 19 16z" fill={accent} />
          <rect x="170" y="90" width="22" height="22" fill="#ffd36e" />
          <path d="M215 110 l10 -30 10 30z" fill="#3e8e41" />
          <path d="M80 112 l8 -22 8 22z" fill="#3e8e41" />
          <circle cx="150" cy="122" r="3" fill="#2c3e50" />
        </g>
      )}
      {id === 'interactive-3d' && (
        <g>
          <ellipse cx="160" cy="150" rx="110" ry="10" fill="#000" opacity=".5" />
          <rect x="110" y="60" width="100" height="70" rx="12" fill="#1f2638" stroke="#2d3956" />
          <rect x="150" y="30" width="60" height="28" rx="6" fill={accent} opacity=".9" />
          <rect x="230" y="80" width="40" height="40" rx="6" fill="#2a3450" stroke={accent} />
          <g stroke={ink} strokeWidth="1">
            <path d="M210 44 L250 30 H290" />
          </g>
          <text x="254" y="26" fontSize="10" fill={ink} fontFamily="Segoe UI">sensor</text>
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
