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
    guide: 'Characters and props in confident black ink outlines, filled with soft, slightly blotchy watercolour washes (low-opacity fills that spill past the line). Each part is a small comic beat with a set-up and a payoff; give the people and things in it expressions and poses that act the line out. Warm paper background.'
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
    guide: `How tech works, drawn as a clean product diagram on near-black. Precise and calm; only the lettering is hand-made.

Build every part from the building blocks in @kit/systems (inside <Board>, 1920 x 1080, start = frame it appears):
  import { SIGNAL, Browser, Server, Terminal, Panel, Layer, Pill, Connector, Packet, Message, SectionTitle, Slot, Steps, Focus } from '@kit/systems'
  <Browser x y w? h? url="google.com" secure? tab? start>{page content, y measured from below the address bar}</Browser>
  <Server x y w? h? logo={[SIGNAL.cyan, SIGNAL.pink]} label? start />      <Terminal x y lines={['curl google.com', ...]} start cps? />
  <Panel x y w h start>…</Panel>  (any other mock-up: phone, router, certificate)   <Layer y name="TCP" color={SIGNAL.cyan} start>…</Layer>
  <Pill x y text="HTTP" color={SIGNAL.amber} mono? start />   <Connector x1 y1 x2 y2 color start dur? />   <Packet x1 y1 x2 y2 text="<html>" start dur? />
  <Message from={[x,y]} to={[x,y]} label="SYN" color start />   <SectionTitle text="Secure this connection" words={{ TCP: SIGNAL.cyan }} start />
  <Slot x y start /> (a step explained later)   <Steps count={4} current={2} label="TLS secures it" start />   <Focus start end?>{everything to dim}</Focus>
Write your own SVG only for what the blocks do not have, in the same look: flat fills in #1c1d21 / #26272c, no outlines.

Look
- Plain near-black background. Real things are mock-ups (Browser, Server, Terminal, Panel), never icons or symbols.
- Systems are stacked Layers; two sides talking are two columns with Messages slanting between them.
- One SIGNAL colour per idea for the whole video (cyan, amber, pink, purple, orange); everything else greys. At most
  three colours in a part.
- Labels and titles in the marker font (Pill, Layer, SectionTitle do it); URLs and small interface text in Inter.
- Motion is exact: things appear, lines extend, packets slide. When a question or section title comes in, wrap the rest
  in <Focus> so it dims and blurs. A sequence ends on <Steps>.
- Brands only when the narration names them, as a simple mark (Server's logo colours), never an exact copy.`
  }),
  s({
    id: 'tech-remix', name: 'Fast Tech Remix', tags: ['Real media', 'Fast'], dim: '2D', realMedia: true,
    description: 'Real screenshots, posts, photos, memes, code and clips, cut every few seconds, with sharp captions. Fireship pace.',
    palette: { bg: '#000000', ink: '#ffffff', accent: '#ff8a1f' },
    guide: `A fast, funny tech explainer made of REAL media: the pages, posts, photos, memes, charts, code and clips listed
for each part. Not drawn: cut. Every part uses its listed media, in order, with the blocks in @kit/remix (no <Board>):
  import { Cuts, Punch, FreezeFrame, Shot, Clip, Page, Split, Post, Meme, Gif, Caption, Code, Shell, Diagram, Box,
    Flow, Loop, Chart, Stats, Bars, Timeline, Dots, Compare, Stack, Pipeline, Tree, Magnify, Hand, Circle, Sticker, Label,
    TitleCard, Quote } from '@kit/remix'
  import { AbsoluteFill } from '@kit'
  <Cuts at={[0, at('word'), …]} fx?={['cut', 'whip', 'glitch', …]}> one child per shot </Cuts>   each child fills the
    frame; cut on the word it is about. Hard cuts by default (Fireship). fx[i] is how shot i + 2 comes in: 'whip' (the
    picture tears in sideways as motion streaks, for a new topic or section), 'glitch' (bands shear and the colours
    split, for something broken, hacked or a twist). At most 2 whips and 1 glitch in a part; the rest are cuts.
  <Shot name="m/…jpg" fit? zoom? />  photo, logo, B-roll still        <Clip name="m/…mp4" from? />  a real clip or quote
  <Page name="m/…png" w h marks={…} marks2? focus? crop? scroll? underline? markAt? point? />  a page with its sentence
    highlighted (copy w, h, marks, marks2 and focus as listed). It shows only the headline and that paragraph, big,
    by default (never the whole page: too small to read); scroll: for a tall capture, moves down to the sentence;
    underline: a marker line instead; point: a hand points at the highlighted sentence (it moves with the page)
  <Post name="m/…png" w h />  a real post
  <Meme name="m/…jpg" w h template="Drake Hotline Bling" texts={['…', '…']} />  a meme: copy it exactly as listed; its
    captions sit in the template's own boxes (Drake's white side, Gru's boards). Never put a Caption on a meme.
  <Gif name="m/…mp4" w h text? />  a looping reaction GIF, as listed
  <Caption text="WE'RE SO CLOSE. PLS VENMO ME" />  a sarcastic line over a photo, page or clip (inside the same cut);
    at most 6 words, never on a meme, a GIF or code
  <Code code={…} lang="ts" file="index.ts" lines={[3]} tree={['src/', '  index.ts', '  db.ts', 'package.json']} />
    an editor; tree adds the file explorer        <Shell command="npm i x" output={['added 1 package']} />
  <Split left={<Code …/>} right={<Page …/>} />  two things side by side (the code and what it does, before and after);
    each side is shown at half size, so give each one big thing (short code, a close page), never a long file
  <Chart name="m/…json" />  a real line chart (price, downloads)     <Stats name="m/…json" />  GitHub numbers counting up
  <Bars title="Time to crack (log scale)" log items={[{ label: 'Password123', value: 1, text: 'seconds' },
    { label: 'river lamp cactus ocean', value: 3e5, text: 'about 4 days', hot: true }]} />  a comparison, bar by bar, for
    THE key comparison of the video (at most one per 4 parts): every other number goes on a picture (a Punch on it
    in its page, a Caption over a photo, Stats)
  <Timeline items={[{ date: '2026 · November 5', text: 'Apiiro publishes the research' }, …]} at?={[f, …]} />  how a story
    unfolded, dated paper cards stacking up (news, incidents, a disclosure)
  More ways to TEACH an idea, each a different shape. Pick the one that fits the idea:
  <Dots total={100} lit={40} title? label="could go to one project" />  a share of a whole (40%, 1 in 3)
  <Compare a="DDR5" b="HBM3E" win?="b" title? rows={[{ label: 'speed', a: '64 GB/s', b: '1.2 TB/s' },
    { label: 'upgradeable', a: 'yes', b: 'no' }]} />  two things side by side, a row per difference (yes/no as ✓/✗)
  <Stack title? layers={[{ label: 'Cache', sub: '~5 ns' }, { label: 'HBM', sub: 'the bottleneck', hot: true }, …]} />
    layers of a system, top to bottom (memory hierarchy, a network stack, what sits on what)
  <Pipeline title? steps={['prompt', 'load weights', 'read 140 GB', 'one token']} hot?={2} packet?="📦" />  how
    something flows step by step, a packet travelling through; hot marks the slow or broken step
  <Tree root="DRAM wafers" title? branches={[{ label: 'HBM', leaves: ['H100', 'B200'], hot: true }, …]} />  one thing
    splitting into kinds or parts
  <Magnify name="m/…png" w h at={[x, y, w, h]} label? />  a lens on one detail of a real picture or page (a chip's
    marking, one line of a chart), [x, y, w, h] in the picture's pixels (a page's marks give them)
  <Sticker name="m/…-cut.png" x y h rotate? from?="left" glow?="#ff3d6e" start? />  a cut-out person with a white
    outline, slapped on top of a shot (Fireship's collage); from: it slides in from that edge of the frame in 4 frames;
    glow: a coloured halo for the one that matters. A logo ("m/…-logo.png") shows on a white card. Never on top of text
    or another Sticker; a few at different start frames build a collage on one picture.
  <Label x y text="CEO, NVIDIA" to={[x, y]}? color? />  a tilted name tag, with an optional pointer line
  <TitleCard text="The scout" num={1} />  a chapter card: the number in a red square, the title huge beside it
    (without num: a few big words, accent= one word in orange)
  <Quote text="We will not train on your code" mark="not train" who="GitHub, 2023" bg?="m/…jpg" />  someone's exact
    words in a black box, the words that matter cut out in white, over their picture (bg) or the wallpaper
  Edits, wrapped around a shot: <Punch at={[at('trillion')]}> jumps in close on the word (a hard zoom cut, no glide);
    <FreezeFrame at={f} label="THIS GUY"> stops the picture with a record scratch, for the beat before a punchline.
  Diagrams: <Diagram> <Box x y label="NVIDIA" icon="🖥️" pulse? solid? color="#76b900" />
    <Flow from={[x,y]} to={[x,y]} label="investment" packets={3} packet="💰"? /> </Diagram>   Diagram zooms whatever is
    inside it to fill the frame, so lay it out at any size; build it up box by box (each Box and Flow appears on
    its start frame); packets mark what flows along the arrow; pulse rings the busy one. <Loop items={['build', 'test', 'deploy']} /> for a cycle (inside a Diagram too).
    At most 5 boxes in one diagram, 1 to 3 words per label. Aim arrows at box centres if you like: they are drawn
    from edge to edge. A Sticker or Label that belongs to the diagram goes INSIDE the <Diagram> (it zooms with it);
    never lay anything over a diagram from outside it. Boxes are outlined in their colour and size themselves to the
    label; solid fills one, for the single thing that matters.
  Pointers: on a page, use point (never a Hand placed over a Page: the page is cropped and zoomed, so coordinates you
    guess miss the words). A Hand or Circle only on a picture or code whose positions you know, aimed at a specific
    thing in it, at most one per shot: <Hand x y dir="left" start /> <Circle x y rx ry start />

Timing: every frame number is a frame of the part, what at('word') returns, also inside <Cuts> (start={at('knife')}
  inside the shot that begins at 'knife' comes in on that word). Something with no start comes in when its shot does.
  Every shot shows its main thing from its first frame: never a shot that is black or empty while it waits.

Motion, as Fireship does it: nothing floats, bounces, fades or drifts. Pictures are held dead still and the edit
  does the moving: a hard cut on the word, a Punch that jumps closer, a Sticker slapped on (or slid in from the edge),
  a highlight swiped across the sentence, a box or bar appearing on its word. A whip only where the topic turns, a
  glitch only for something broken. Build a long shot up in steps on the words (start=), never with a slow tween.

Phone first: most people watch on a phone, where the whole frame is a few inches wide. Every word on screen is at
  least 40 px (in 1920 x 1080), titles 80 px or more; at most about 8 words on a line and 4 lines of text in a shot.
  Show a few big words, not a paragraph: a page is a close crop of the highlighted sentence, code is 8 lines or
  fewer of under 40 characters, a diagram has at most 4 boxes close together. Any text you draw yourself (fontSize)
  follows the same sizes.

Pace and humour
- Every shot is on screen long enough to READ, cut exactly on the word it shows (at('word')): a photo or B-roll at
  least 1.5 s; a meme or GIF at least 3 s; a page with its highlight at least 2.5 s; a diagram at least 3 s; code at
  least 3.5 s plus 1 s for every 3 lines (it is shown whole; lines= lights the line that matters). A part of 10 seconds
  has 3 or 4 shots, never 6. Shots under 0.8 s are dropped by the kit. Keep a long shot alive inside it instead of
  cutting away: a Punch on the key word, a second highlight, the next box of the diagram.
- No small card or ticket parked in a corner across shots: it is too small to read and covers the picture. Every
  shot owns the whole frame.
- Fill the frame: the main thing in each shot takes at least half of the picture (a page close up on its sentence, a
  photo full frame, a meme full height, code big). Never a small thing alone in the middle of black.
- Real media first. Draw only what no real picture can show (a diagram of how it works), with Box, Flow and Loop;
  never thin hand-drawn line art.
- The concept comes first: most shots show the real thing that proves the line (the docs sentence highlighted, the
  real code, the real chart, a diagram of how it works). Humour is a light touch: the few memes or GIFs listed, a
  FreezeFrame or a sarcastic Caption on a truly ironic beat (at most one Caption per part), a Punch on the big
  number, a Sticker and Label for each person the story is about.
- Mix kinds: never three of the same in a row. Diagrams for how money or data flows; charts for numbers; code for how
  it works.
- Diagram colours: one flat colour per company or thing (NVIDIA green #76b900, AI companies purple #8b5cf6, banks
  teal #22b8cf, others orange #ff8a1f), arrows labelled in small capitals.
- If a part has no media listed, use a diagram, Bars, a Timeline or code, never an empty frame.

What Fireship and CodeHead do that a weak video does not
- Open on the real thing: the post, the headline (a Page whose highlight is the headline, big), a photo of the person
  or product with a Caption. Never a word card, a logo alone or a giant word cropped by the frame.
- Layer real media: a Sticker of the company's logo or the person on top of the page or clip about them, a Label on
  it, a Hand pointing at the line. One picture with three layers beats three bare cards.
- Numbers go ON a visual: a Punch on the number inside its highlighted sentence, Bars to compare, Stats or a Chart.
  TitleCard is for chapter cards only ("FLAW #2", the last line): at most 2 in the whole video, never two in a row.
- Teach with a few clean visuals (CodeHead): dark, one accent on the thing that matters, built step by step while it
  is explained, held long enough to follow. Choose the SHAPE from the idea: a share → Dots; this vs that → Compare;
  layers → Stack; a process → Pipeline; kinds of something → Tree; a cycle → Loop; how money or data flows between
  players → Diagram; numbers side by side → Bars; events over time → Timeline; a detail in a picture → Magnify.
  Never the same shape in two parts in a row, and no shape more than once per 4 parts: a video uses many of them.
- Every listed picture is used once: never the same meme, page or photo twice, and never flicking back and forth
  between two shots.
- Every part shows something NEW. Never draw again an idea an earlier part already drew (the same GPU-and-memory
  diagram with other labels is the same diagram): the second time, show the real thing instead (the paper's figure,
  the code, a photo of the hardware) or move the story on.
- Nothing small on black: no terminal or code of one or two lines as a whole shot (put the command in the code of a
  fuller shot, or say it with a Caption), no Diagram of a single box, no chart with one bar. If a shot would be mostly
  empty, it is the wrong shot.`
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
