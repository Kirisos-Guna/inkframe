# The method: how to draw one part

You are drawing **one part** of an explainer video. A part is 5 to 15 seconds of voiceover. You write it as a
React component in TypeScript (Remotion), using the scene kit in `@kit`. The app renders it, puts all parts
together and lays the voiceover on top.

## Rules
1. **One idea at a time.** One clear picture per part, built up in 2 to 4 beats. No clutter.
2. **In sync with the words.** Every beat starts on the word that introduces it: `at('tower')` gives the frame where
   "tower" is spoken. Draw things *as they are said*, never before.
3. **Fill the frame, stay inside it.** The drawing space is 1920 x 1080. Keep everything between x 120–1800 and
   y 100–980. Text is at least 44 px, titles 80–120 px. At most ~8 words of on-screen text at a time.
4. **Use the style.** Colours come from `palette` (`bg`, `ink`, `accent`). The Board already sets stroke colour and
   texture; only use `accent` for the one thing the eye must find.
5. **Keep moving.** Something should be drawing, moving or changing at least every 1.5 seconds. End on a held,
   complete picture for the last ~15 frames.
6. **Only the kit, React and remotion.** No other imports, no network, no `fetch`, no random numbers that change per
   frame (use fixed values or `random('seed')` from remotion).
7. The file must `export default function Scene()`.

## The kit
```tsx
import { useScene, Board, Draw, shape, Write, Typewriter, Pop, Fade, Move, Travel, Count, Character, Picture, useCamera } from '@kit'

const { frame, fps, dur, at, palette, words, text, characters, material, font } = useScene()
// dur = frames in this part. at('word', nth?, fallbackFrame?) = frame the word is spoken.

<Board camera={useCamera([{ at: 0, zoom: 1, x: 960, y: 540 }, { at: 90, zoom: 1.6, x: 1300, y: 500 }])}>  // background + texture, optional camera
<Draw d={svgPath} start={f} dur={30} color? width? fill? dashed? />   // pen-draws any SVG path
shape.rect(x,y,w,h,r?) shape.circle(cx,cy,r) shape.line(x1,y1,x2,y2) shape.arrow(x1,y1,x2,y2) shape.curve(x1,y1,x2,y2,bend?) shape.wave(x,y,w,amp?,n?)
<Write text="the feed" x={960} y={900} size={56} start={f} align="middle" color? />   // handwriting reveal
<Typewriter text="..." x y size start cps />                        // typed text
<Pop start={f} x={cx} y={cy}>...</Pop>                              // springs children in
<Fade start={f} out={f2}>...</Fade>   <Move from={[0,0]} to={[200,0]} start dur>...</Move>
<Travel d={path} start={f} dur={40} />                              // a dot (or children) moving along a path
<Count to={12000} prefix="$" x={960} y={560} start={f} />           // number counting up
<Character name="Ada" x={400} y={980} height={560} pose="Point" expression="Happy" start={f} />
   poses: Stand Wave Point 'Point up' 'Thumbs up' Cheer Shrug Think 'Arms crossed' Present Hold 'Hands on hips' Facepalm Explain Walk
   expressions: Neutral Happy Laughing Surprised Sad Angry Thinking Wink Worried Smug
<Picture name="logo.png" x y w h start />                           // one of the user's material files
```
Plain SVG elements (`<path>`, `<circle>`, `<text>`, `<g>`…) work too inside `<Board>`. Text in raw `<text>` needs
`stroke="none" fill={palette.ink} fontFamily={font}`.

## Real 3D (only when STYLE.md says the style is 3D)
Use `@kit/three`, `three` and `@react-three/fiber`. The whole part is one `<Stage3D>`; text goes on top of it in a
`<Board>`-free `<AbsoluteFill>` (from `@kit`) with an `<svg viewBox="0 0 1920 1080">` overlay if you need labels.
```tsx
import { useScene, AbsoluteFill, Write } from '@kit'
import { Stage3D, useProgress, usePop, Paper, Clay, Glow, LineBox, PaperPlane, THREE } from '@kit/three'

export default function Scene() {
  const { at, dur, palette } = useScene()
  const fly = useProgress(at('plane', 1, 10), 60)          // 0 → 1 while the plane flies in
  const pop = usePop(at('city', 1, 70))
  return (
    <AbsoluteFill>
      <Stage3D light="paper" camera={[{ at: 0, pos: [0, 4, 12], look: [0, 1, 0] }, { at: dur, pos: [3, 3, 8], look: [0, 1, 0] }]}>
        <group position={[-6 + fly * 6, 2 + Math.sin(fly * 6) * 0.2, 0]} rotation={[0, -Math.PI / 2, 0.1]}><PaperPlane /></group>
        <mesh position={[2, 0.75, -2]} scale={pop} castShadow><boxGeometry args={[1.5, 1.5, 1.5]} /><Clay color={palette.accent} /></mesh>
      </Stage3D>
    </AbsoluteFill>
  )
}
```
- Units are metres-ish: keep the subject within about 10 units of the origin; the ground is at y = 0.
- Move the camera with keys (`at` = frame). Slow, eased moves look expensive; avoid spinning the camera.
- `useProgress(start, dur)` gives 0 → 1 for any motion; `usePop(start)` gives a scale for things that appear.
- Materials: `Paper` (matte paper, cut-outs, pop-up books), `Clay` (soft toy worlds), `Glow` (lit details),
  `LineBox` (blueprint and pencil builds; `draw` 0 → 1 fades the edges in), `PaperPlane`.
- Plain three.js geometry works: `boxGeometry`, `cylinderGeometry`, `sphereGeometry`, `coneGeometry`,
  `extrudeGeometry` with a `THREE.Shape` for cut-out silhouettes.

## Example
```tsx
import { useScene, Board, Draw, shape, Write, Pop } from '@kit'

export default function Scene() {
  const { at, palette } = useScene()
  const phone = at('phone', 1, 0)
  const send = at('send', 1, 45)
  return (
    <Board>
      <Draw d={shape.rect(810, 260, 300, 560, 40)} start={phone} dur={30} />
      <Draw d={shape.line(900, 300, 1020, 300)} start={phone + 20} dur={10} />
      <Write text="your prompt" x={960} y={480} size={44} start={phone + 30} align="middle" />
      <Pop start={send} x={960} y={720}>
        <Draw d={shape.rect(870, 680, 180, 80, 40)} color={palette.accent} start={send} dur={14} />
        <Write text="send" x={960} y={735} size={44} start={send + 6} align="middle" color={palette.accent} />
      </Pop>
      <Draw d={shape.arrow(1130, 720, 1500, 460)} start={send + 20} dur={20} color={palette.accent} />
    </Board>
  )
}
```
