# The method: thumbnails that get clicked

A thumbnail is **one still picture** (rendered at 1280 x 720 from the kit's 1920 x 1080 space). It is seen at about
the size of a stamp, next to a dozen others, by someone scrolling. It has half a second. Design for that.

## First: it is a frame of THIS video
The thumbnail must look like it came out of the video: someone who clicks should recognise it in the first seconds.
- **Same look as the frames you are shown.** Same background (the style's palette.bg, its paper or texture), the same
  kind of drawing (the same line, fills, mock-ups, layers, characters), the same colours. Draw it the way the video's
  parts are drawn, following the style in your instructions.
- **Same lettering.** Text uses the video's font: `BigText` and `Sticker` already do (`font` from `useScene()`), so
  a marker style gets marker capitals, a hand-drawn style gets its handwriting. Never switch to a different font.
- **Reuse the video's key visual.** Take the most striking picture from the frames and make it the subject, bigger and
  cleaner. Do not invent a new subject the video does not show.
- **Start from the video's background.** `ThumbBg` (default `plain`) is the style's own background, or draw inside
  `<Board>` to get its paper and texture. Use `glow`, `burst`, `spot` or `split` only when the style is already loud
  (neon, poster, cartoon); never on a calm, clean or hand-drawn style.
- **Pointers in the style.** `Arrow` and `Ring` default to the style's accent; draw them like the video would (a
  marker style: a thick marker ring; a diagram style: a connector line or a highlighted box). No stock red arrows.

## Then: make it clickable, inside that look
1. **One subject, big.** One object, screen, diagram or character fills 35–60% of the frame, slightly off-centre (left
   or right third). Never a scene with many small things.
2. **2 to 4 words, huge.** 160–260 px with `BigText` (it adds a dark outline). Never the video's title, never a
   sentence. The words *add* to the picture (curiosity, stakes, a number); they do not describe it.
3. **Contrast within the palette.** Push the style's own colours: the accent on the one thing that matters, the rest
   calm. At most 3 colours plus the background and white.
4. **A curiosity gap.** Show the surprising part, a before/after, a mystery or a big number, so the viewer *has* to
   click to find out. Honest: the picture must be in the video.
5. **One pointer at most:** one `Arrow` or one `Ring`, not both.
6. **Keep the bottom-right corner empty** (the video length badge sits there): nothing important below y = 820 on
   the right third.
7. If the style is real 3D, build the subject in 3D with `@kit/three`, as the video does.
8. If the video has characters, a character with a **strong expression** (Surprised, Worried, Laughing) looking or
   pointing at the subject beats anything else.
9. **Not AI-looking:** no glowing brains, robots, node networks, sparkles or gradient blobs. A real, specific object
   (the actual chip, the actual app screen, the actual place) drawn the video's way beats any symbol.

## Concepts (each variant uses a different one)
- **The key object:** the one thing the video is about, huge, with 2 words. ("ONE CHIP")
- **Reaction:** a character with a big expression next to the subject, 2–3 words. ("WAIT, WHAT?")
- **Before → after / versus:** the two states side by side (`ThumbBg variant="split"` only if the style is loud;
  otherwise two panels in the style), 1–2 words per side.
- **Big number:** a number that surprises (`BigText` with the number highlighted) next to a small subject.
- **Mystery:** the subject half hidden, cut open or shown from an unusual angle, with a question word ("HOW?").

## The kit (`@kit/thumb`, plus everything in `@kit`)
```tsx
import { useScene, Board, Character, Picture } from '@kit'
import { ThumbBg, BigText, Arrow, Ring, Sticker, Subject } from '@kit/thumb'

export default function Scene() {
  const { palette, font } = useScene()
  return (
    <ThumbBg>
      <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        {/* the subject, drawn big around (1300, 520) exactly the way the video draws it */}
      </svg>
      <BigText lines={['WHERE IT', 'REALLY GOES']} x={120} y={330} size={190} highlight={2} />
      <Ring x={1300} y={520} rx={260} />
    </ThumbBg>
  )
}
```
- `ThumbBg` variants: `plain` (default: the style's background), `glow`, `burst`, `spot`, `split` (loud styles only).
- `BigText`: `lines`, `x`, `y` (baseline of the first line), `size`, `highlight` (word index), `align`, `rotate`
  (default -3; use 0 for calm styles). It uses the video's font.
- `Arrow from to`, `Ring x y rx ry` (the style's accent), `Sticker text x y`, `GlowBehind x y r` (only for glowing
  styles), `Subject` (white rim + shadow: only when the style uses outlines like that).
- `<Character name pose expression x y height start={0} />` and `<Picture name x y w h start={0} />` work too
  (always `start={0}`).
