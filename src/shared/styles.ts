import type { StyleDef } from './types'

type S = Omit<StyleDef, 'stroke'> & { stroke?: StyleDef['stroke'] }
const none = { width: 0, jitter: 0, texture: 'none' as const }
const s = (x: S): StyleDef => ({ stroke: none, render: 'svg', engine: 'remotion', ...x })

export const BUILTIN_STYLES: StyleDef[] = [
  // ---------- 2D ----------
  s({
    id: 'hand-drawn-board', name: 'Hand-drawn Board', tags: ['Whiteboard', 'Explainer'], dim: '2D',
    description: 'A pen draws your story on a dark board, in sync with every word.',
    palette: { bg: '#07080a', ink: '#f2f2f2', accent: '#f5a623' }, stroke: { width: 3, jitter: 0.6, texture: 'pen' },
    guide: 'White pen line art on a near-black board, one orange accent. Things are drawn as they are said, then labelled in handwriting. Wide, calm compositions with lots of empty board.'
  }),
  s({
    id: 'ink-wash-cartoon', name: 'Ink-and-wash Cartoon', tags: ['Cartoon', 'Story'], dim: '2D',
    description: 'A hand-inked cartoon with a real story and a punchline, painted in soft washes.',
    palette: { bg: '#f4eedf', ink: '#1d1b1a', accent: '#d9534f', paper: '#e8dcc2' }, stroke: { width: 4, jitter: 0.9, texture: 'brush' },
    guide: 'Characters and props in confident black ink outlines, filled with soft, slightly blotchy watercolour washes (low-opacity fills that spill past the line). Each part is a small comic beat with a set-up and a payoff; give characters expressions and poses that act the line out. Warm paper background.'
  }),
  s({
    id: 'living-ink', name: 'Living Ink', tags: ['Ink', 'Flowing'], dim: '2D',
    description: 'Ink that blooms, flows and morphs from one idea into the next on rice paper.',
    palette: { bg: '#f3efe6', ink: '#111111', accent: '#b0302a' }, stroke: { width: 7, jitter: 1.3, texture: 'brush' },
    guide: 'Thick, tapered brush strokes. Shapes are never cut: ink drops bloom (circles scaling up with soft edges) and strokes morph into the next shape. Use the red accent like a seal stamp, once per part. Minimal text, written with the brush.'
  }),
  s({
    id: 'cut-paper-poster', name: 'Cut-paper Poster', tags: ['Poster', 'Kinetic type'], dim: '2D', engine: 'hyperframes',
    description: 'Bold poster layouts of cut paper and big type that slide into place, layer by layer.',
    palette: { bg: '#f2e6cf', ink: '#1c1c1c', accent: '#e4572e', paper: '#2e86ab' },
    guide: 'Swiss-poster layouts: huge words (160–260 px), torn-edge paper shapes in 3–4 flat colours, slight drop shadows, a halftone dot texture on one shape. Layers slide and snap in on the key words. Kinetic typography carries the meaning.'
  }),
  s({
    id: 'shadow-puppets', name: 'Shadow Puppets', tags: ['Silhouette', 'Theatre'], dim: '2D',
    description: 'Black cut-out silhouettes on a warm, back-lit screen, moved by their sticks.',
    palette: { bg: '#f0a64a', ink: '#120c08', accent: '#fff2c6' },
    guide: 'Everything is a solid black silhouette with jointed limbs and thin rods going off the bottom of the frame. The screen glows warm orange with a soft radial light and a faint flicker. Puppets move in arcs on twos. Text appears as cut-out lettering.'
  }),
  s({
    id: 'cutaways', name: 'Cutaways', tags: ['Cross-section', 'Technical'], dim: '2D',
    description: 'Things cut open to show how they work inside, with labels on leader lines.',
    palette: { bg: '#f5f3ee', ink: '#22303c', accent: '#e85d2a', paper: '#c9d6df' }, stroke: { width: 3, jitter: 0, texture: 'pen' },
    guide: 'Clean technical illustration. Draw the outside, then a slice opens (clip path or wipe) to reveal the inside parts in muted fills. Each part gets a thin leader line and a small caps label as it is mentioned. Use the accent for the part being explained.'
  }),
  s({
    id: 'paper-cutout', name: 'Paper Cut-out', tags: ['Papercraft', 'Stop-motion'], dim: '2D',
    description: 'Torn-edge paper shapes with real shadows, animated on twos.',
    palette: { bg: '#f2b632', ink: '#1b1b1b', accent: '#ef5a2a' },
    guide: 'Flat paper shapes with slightly irregular edges and soft drop shadows, stacked in layers. Animate on twos (hold each pose for 2 frames) for a stop-motion feel.'
  }),
  s({
    id: 'character-stories', name: 'Character Stories', tags: ['Characters', 'Narrative'], dim: '2D',
    description: 'Your characters act the story out in simple sets, scene by scene.',
    palette: { bg: '#fdf6ec', ink: '#2b2b33', accent: '#ff7a59' }, stroke: { width: 4, jitter: 0.2, texture: 'none' },
    guide: 'Character-led: every part shows the video\'s characters doing or reacting to what is said, with clear poses and expressions, in a simple flat set (a room, a street, a lab). Use speech bubbles sparingly. Cut between wide and close framing from part to part.'
  }),
  s({
    id: 'flat-cartoon', name: '2D Animation', tags: ['Cartoon', 'Flat'], dim: '2D',
    description: 'Bold outlines and flat colours, with bouncy cartoon motion.',
    palette: { bg: '#8fd3f4', ink: '#1b1b22', accent: '#ff5d73' }, stroke: { width: 4, jitter: 0.1, texture: 'none' },
    guide: 'Classic flat 2D animation: thick outlines, flat bright fills, squash and stretch on every move, anticipation before big actions, smears on fast moves.'
  }),
  s({
    id: 'cartoon-music-video', name: 'Cartoon Music Video', tags: ['Cartoon', 'Music'], dim: '2D', engine: 'hyperframes',
    description: 'A cartoon that bounces to the music, with every move landing on the beat.',
    palette: { bg: '#2b1055', ink: '#fff8e7', accent: '#ffd23f', paper: '#ff4f8b' },
    guide: 'Bright cartoon shapes and big lyric-style words that pop on the beat (every 0.5 s if no beat map is given). Bounce, squash, colour flashes and quick zooms. Keep it joyful and rhythmic.'
  }),
  s({
    id: 'notebook-sketch', name: 'Notebook Sketch', tags: ['Marker', 'Notebook'], dim: '2D',
    description: 'Marker drawings and handwriting on lined notebook paper.',
    palette: { bg: '#fbfaf5', ink: '#1d1d1f', accent: '#e8553d', paper: '#cfd8e8' }, stroke: { width: 4, jitter: 0.8, texture: 'marker' }
  }),
  s({
    id: 'chalkboard', name: 'Chalkboard', tags: ['Chalk', 'Classroom'], dim: '2D',
    description: 'Classroom chalk on a slate board, wiped and redrawn.',
    palette: { bg: '#1f2a26', ink: '#eaeee6', accent: '#f0d264' }, stroke: { width: 4, jitter: 1.2, texture: 'chalk' }
  }),
  s({
    id: 'pencil-sketch', name: 'Pencil Sketch', tags: ['Pencil', 'Graphite'], dim: '2D',
    description: 'Soft graphite drawings and shading on cream paper.',
    palette: { bg: '#efeadf', ink: '#4a4a4a', accent: '#8a8a8a' }, stroke: { width: 2, jitter: 1, texture: 'pencil' }
  }),
  s({
    id: 'risograph', name: 'Risograph Print', tags: ['Print', 'Halftone'], dim: '2D',
    description: 'Bold inks roll onto paper as halftone dots, slightly out of register.',
    palette: { bg: '#f1ece2', ink: '#1a7f86', accent: '#ff5a36' }, stroke: { width: 3, jitter: 0.3, texture: 'none' }
  }),
  s({
    id: 'sumi-ink', name: 'Sumi Ink', tags: ['Ink', 'Brush'], dim: '2D',
    description: 'Brush strokes and ink drops that bloom and soak into rice paper.',
    palette: { bg: '#f3f0e8', ink: '#141414', accent: '#b0302a' }, stroke: { width: 8, jitter: 1.4, texture: 'brush' }
  }),
  s({
    id: 'blueprint', name: 'Blueprint', tags: ['Technical', 'Isometric'], dim: '2D',
    description: 'Isometric drawings drafted live in white line on a cobalt grid.',
    palette: { bg: '#1747b8', ink: '#e8f0ff', accent: '#9fd0ff' }, stroke: { width: 2, jitter: 0, texture: 'pen' }
  }),
  s({
    id: 'engraving', name: 'Banknote Engraving', tags: ['Engraved', 'Money'], dim: '2D',
    description: 'Fine engraved lines and guilloche patterns, like the art on a banknote.',
    palette: { bg: '#e4ead9', ink: '#2c4a3a', accent: '#7a8f5d' }, stroke: { width: 1.2, jitter: 0, texture: 'pen' }
  }),
  s({
    id: 'cartoon-history', name: 'Cartoon History', tags: ['Cartoon', 'Theatre'], dim: '2D',
    description: 'Flat cartoon scenes on a stage, framed like a history lesson.',
    palette: { bg: '#24324a', ink: '#f6e7c8', accent: '#c8372d' }, stroke: { width: 3, jitter: 0.2, texture: 'none' }
  }),
  s({
    id: 'neon-ledger', name: 'Neon Ledger', tags: ['Neon', 'Data'], dim: '2D', engine: 'hyperframes',
    description: 'Glowing lines and numbers on deep black, for money and growth stories.',
    palette: { bg: '#05060a', ink: '#e9fbff', accent: '#33e1a1' }, stroke: { width: 2.5, jitter: 0, texture: 'pen' },
    guide: 'Data-first: counters, growing bars and line charts that draw themselves, with a soft neon glow (CSS drop-shadow). Big numbers carry each part.'
  }),
  s({
    id: 'systems-diagram', name: 'Dark Systems Diagram', tags: ['Diagram', 'Tech'], dim: '2D', font: 'marker',
    description: 'Flat dark mock-ups of real screens and machines, wired together in layers, labelled in bold marker capitals.',
    palette: { bg: '#0a0a0d', ink: '#ececf1', accent: '#4cc4d6', paper: '#1c1d21' }, stroke: { width: 6, jitter: 0, texture: 'none' },
    guide: `How tech works, drawn as a clean product diagram on near-black. Precise, calm, nothing hand-wobbly except the lettering.

Things on screen
- The background is plain near-black (palette.bg). No grid, no texture, no glow.
- Real things are flat UI mock-ups, filled, never outlined: rounded panels in palette.paper (#1c1d21, radius 14–18) with inner
  bars a step lighter (#26272c). Draw them with plain SVG rects and text, not <Draw>.
  A browser: a tab ("New Tab"), back / forward / reload icons, and an address bar with the URL in Inter.
  A server: a card with a round logo badge on the left and three rack rows (tick marks ||||| and two status dots).
  Also phones, terminals, routers (circle with four arrows), certificates (a card with "ISSUED TO" rows and check marks).
- Systems in layers: stacked full-width rounded bars (about 70 px tall), each with its layer name on the left in marker
  capitals in its own colour (e.g. HTTP, TLS, TCP, IP). What happens in a layer happens inside its bar.
- Two sides talking (client and server): two columns of bars; messages are thin arrows that slant across from one
  column to the other, each with a tiny pill label (SYN, ACK, CLIENT HELLO).

Colour
- One signal colour per idea, kept for the whole video: cyan #4cc4d6, amber #f6b73c, pink #f0569a, purple #9b7cf0,
  orange #e8873a. Everything else is greys on black. Never more than three signal colours in one part.
- Pills: capsules filled with the colour, the word in dark marker capitals (#101014). Technical tags (port 443, IP
  address) are smaller pills in a monospace font.

Lettering
- Labels and titles use the marker font: fontFamily={font} from useScene() (in HTML: font-family: 'Marker'). Write
  them as capitals or title case; never lowercase.
- A section title sits at the top centre in white marker, with a short thin underline. A question title can colour its
  key words in their signal colours ("How do TCP and HTTP work together?").
- Small interface text (URLs, tab names, numbers on screen) is Inter, white or grey.

Connections and motion
- Connectors are thick capsule lines (12 px) in the idea's colour with ring ends (circle r 10, stroke 5, filled black).
  Data moving along them is a small card (e.g. "<html>" in amber mono) sliding along the line.
- Motion is clean and exact: things pop in or slide a short way, lines extend, nothing wobbles (<Draw clean>).
- Focus pull: when a question or a new section appears, everything else dims to about 30% and blurs (SVG
  feGaussianBlur, stdDeviation 6) while the title writes in; then the scene comes back into focus.
- Not explained yet: a dashed rounded box with a "?" holds the place of a step that comes later.
- A sequence ends on a step tracker: numbered circles joined by a line, done steps in their colours, the current one
  bright, later ones grey.

Logos: draw a brand only when the narration names it, as a simple mark made of shapes (a few coloured arcs), never
an exact copy.`
  }),
  s({
    id: 'watercolour', name: 'Watercolour', tags: ['Paint', 'Soft'], dim: '2D',
    description: 'Washes of colour bleed into textured paper behind fine ink lines.',
    palette: { bg: '#f6f2ea', ink: '#2e3a46', accent: '#5b8fc7' }, stroke: { width: 2, jitter: 0.5, texture: 'brush' }
  }),

  // ---------- 3D (real three.js scenes) ----------
  s({
    id: 'paper-plane-3d', name: '3D Paper Plane', tags: ['3D', 'Paper'], dim: '3D', render: 'three',
    description: 'A paper plane flies low over a landscape cut from layers of paper, lit like a photograph.',
    palette: { bg: '#f3e9d8', ink: '#2a2a2a', accent: '#e4572e', paper: '#efe3cc' },
    guide: 'Layered paper landscape (extruded wavy hills and cut-paper trees in pastel teal, coral and cream) with the PaperPlane flying through it, the camera following low behind. Warm "paper" lighting with long soft shadows. Labels are small paper tags.'
  }),
  s({
    id: 'popup-book-3d', name: '3D Pop-up Book', tags: ['3D', 'Pop-up'], dim: '3D', render: 'three',
    description: 'Pages open and paper scenes fold up out of them, one idea per spread.',
    palette: { bg: '#2a1f1a', ink: '#f7efe2', accent: '#ffb347', paper: '#3a2b22' },
    guide: 'An open book on a dark table. Each idea folds up out of the pages: flat paper pieces rotate up from 0 to 90 degrees around their bottom edge (use useProgress). Paper material, warm key light, camera slowly pushing in.'
  }),
  s({
    id: 'blueprint-3d', name: '3D Blueprint Build', tags: ['3D', 'Technical'], dim: '3D', render: 'three',
    description: 'Machines assemble themselves in glowing blueprint lines, piece by piece.',
    palette: { bg: '#0b2a6b', ink: '#e8f0ff', accent: '#9fd0ff', paper: '#0e3380' },
    guide: 'Dark cobalt space with a faint grid floor. Parts appear as LineBox wireframes (draw 0 → 1), slide into place to assemble the object, then fill faintly. Night lighting, slow orbiting camera. Labels in white on thin leader lines in the overlay.'
  }),
  s({
    id: 'pencil-3d', name: '3D Pencil Sketch', tags: ['3D', 'Pencil'], dim: '3D', render: 'three',
    description: 'Objects sketched in graphite lines that turn slowly in 3D on cream paper.',
    palette: { bg: '#efe9dc', ink: '#3a3a3a', accent: '#9a9a9a', paper: '#efe9dc' },
    guide: 'Cream paper world. Objects are LineBox / edge drawings in graphite (#3a3a3a) with very faint faces, drawn in, then the camera turns around them. Studio light, no colour except a single graphite accent.'
  }),
  s({
    id: 'little-worlds-3d', name: 'Little 3D Worlds', tags: ['3D', 'Toy'], dim: '3D', render: 'three',
    description: 'A tiny toy world on a floating island, with soft clay buildings and people.',
    palette: { bg: '#cfe8ff', ink: '#2c3e50', accent: '#ff7a59', paper: '#9bd18b' },
    guide: 'A round floating island (green cylinder) with clay houses, trees (cones), roads and tiny capsule people. Tilt-shift feel: camera high and close, slow moves, sunny studio lighting. Things pop in with usePop as they are named.'
  }),
  s({
    id: 'interactive-3d', name: '3D Interactive Explainer', tags: ['3D', 'Explainer'], dim: '3D', render: 'three',
    description: 'One object turns, opens and explodes into its parts while each part is explained.',
    palette: { bg: '#0f1117', ink: '#e6edf7', accent: '#4f9cff', paper: '#151926' },
    guide: 'A product-shot of one object on a dark stage. As each part is mentioned, it slides out (exploded view), glows with the accent and gets a label on a leader line in the overlay. The camera orbits to show the side being explained.'
  }),
  s({
    id: 'cinematic-3d', name: 'Cinematic 3D', tags: ['3D', 'Lit'], dim: '3D', render: 'three',
    description: 'Lit, shaded objects floating in a dark space, with slow camera moves.',
    palette: { bg: '#0b0f1a', ink: '#e8eefc', accent: '#7cc4ff' },
    guide: 'Dark, moody product lighting, glowing accent details, fog, slow dolly moves.'
  }),
  s({
    id: 'short-3d', name: 'Quick Facts 3D', tags: ['3D', 'Fast'], dim: '3D', render: 'three',
    description: 'Glossy 3D close-ups that change every couple of seconds, made for fast facts.',
    palette: { bg: '#1a1410', ink: '#fff4e6', accent: '#ffb547' },
    guide: 'Fast pace: a new glossy close-up every 1.5–2 s, punchy camera pushes, one bold fact on screen at a time in big type.'
  }),
  s({
    id: 'soft-3d', name: 'Soft 3D', tags: ['Clay', 'Rounded'], dim: '3D', render: 'three',
    description: 'Rounded, soft-lit 3D shapes in pastel colours, like a toy box.',
    palette: { bg: '#e9e4f5', ink: '#3b3561', accent: '#ff7aa2' },
    guide: 'Pastel clay shapes with rounded edges (spheres, capsules, rounded boxes), soft studio light, gentle bounces.'
  }),
  s({
    id: 'isometric-3d', name: 'Isometric City', tags: ['Isometric', 'Low-poly'], dim: '3D', render: 'three',
    description: 'A tiny isometric world that builds itself block by block.',
    palette: { bg: '#0f1626', ink: '#e6edf7', accent: '#4f9cff' },
    guide: 'Orthographic-feeling camera (narrow fov 20, far away), low-poly blocks rising from the ground one by one, blue night palette with lit windows (Glow).'
  })
]

export const SHOWPIECES = [
  { id: 'big-number', name: 'Big number', description: 'One number fills the screen and counts up to the word.' },
  { id: 'map-zoom', name: 'Map zoom', description: 'Fly from the whole planet down to one street.' },
  { id: 'globe-trip', name: 'Globe trip', description: 'A line travels around a spinning globe.' },
  { id: 'typewriter', name: 'Typewriter title', description: 'The key sentence types itself, letter by letter.' },
  { id: 'split-screen', name: 'Split screen', description: 'Before and after, side by side.' },
  { id: 'chart-build', name: 'Chart build', description: 'Bars and lines draw in as the numbers are said.' },
  { id: 'kinetic-type', name: 'Kinetic type', description: 'Big words slide, scale and stack as they are spoken (best as an HTML part).' },
  { id: 'exploded-view', name: 'Exploded view', description: 'An object comes apart in 3D so each piece can be named.' }
]
