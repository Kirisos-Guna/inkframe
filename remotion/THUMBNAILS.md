# The method: thumbnails that get clicked

A thumbnail is **one still picture** (rendered at 1280 x 720 from the kit's 1920 x 1080 space). It is seen at about
the size of a stamp, next to a dozen others, by someone scrolling. It has half a second. Design for that.

## The rules
1. **One subject, big.** One object, person or character fills 35–60% of the frame, slightly off-centre (left or
   right third), with a glow or white rim so it pops off the background. Never a scene with many small things.
2. **2 to 4 words, huge.** 160–260 px, heavy (`BigText`), with a thick dark outline. Never the video's title, and never
   a full sentence. The words *add* to the picture (curiosity, stakes, a number), they do not describe it.
3. **Contrast first.** Bright subject on dark, or dark on bright. Saturated colours. At most 3 colours plus white and
   black. Text colour must contrast with what is behind it.
4. **A curiosity gap.** Show the surprising part, a before/after, a mystery or a big number, so the viewer *has* to
   click to find out. Honest: the picture must be in the video.
5. **Point at it.** One red `Arrow` or `Ring` on the key detail is often worth it. Not both, not two arrows.
6. **Keep the bottom-right corner empty** (the video length badge sits there): nothing important below y = 820 on
   the right third.
7. **Keep the video's look** (STYLE.md): the same drawing style and palette as the video, pushed louder: more
   saturation, bigger, more contrast. If the style is real 3D, build the subject in 3D with `@kit/three`.
8. If the video has characters, a character with a **strong expression** (Surprised, Worried, Laughing) looking or
   pointing at the subject beats anything else.

9. **Not AI-looking:** no glowing brains, robots, node networks, sparkles or gradient blobs. A real, specific object
   (the actual chip, the actual app screen, the actual place) drawn in the video's hand beats any symbol.

## Concepts (each variant uses a different one)
- **The glowing object:** the one thing the video is about, huge and glowing, with 2 words. ("ONE CHIP")
- **Reaction:** a character with a big expression next to the subject, 2–3 words. ("WAIT, WHAT?")
- **Before → after / versus:** `ThumbBg variant="split"`, the two states side by side, 1–2 words per side.
- **Big number:** a number that surprises (`BigText` with the number highlighted) next to a small subject.
- **Mystery:** the subject half hidden, cut open or shown from an unusual angle, with a question word ("HOW?").

## The kit (`@kit/thumb`, plus everything in `@kit`)
```tsx
import { useScene, Character, Picture } from '@kit'
import { ThumbBg, GlowBehind, BigText, Arrow, Ring, Sticker, Subject } from '@kit/thumb'

export default function Scene() {
  const { palette } = useScene()
  return (
    <ThumbBg variant="burst" focus={[1300, 500]}>
      <GlowBehind x={1300} y={520} r={420} />
      <Subject>
        <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
          {/* the subject, drawn big around (1300, 520) in the video's style */}
        </svg>
      </Subject>
      <BigText lines={['WHERE IT', 'REALLY GOES']} x={120} y={330} size={190} highlight={2} />
      <Arrow from={[760, 760]} to={[1080, 600]} />
    </ThumbBg>
  )
}
```
- `ThumbBg` variants: `glow` (radial glow at `focus`), `burst` (sun rays), `spot` (spotlight + floor shadow), `split`.
- `BigText`: `lines`, `x`, `y` (baseline of the first line), `size`, `highlight` (word index), `align`, `rotate`.
- `Arrow from to`, `Ring x y rx ry`, `Sticker text x y`, `GlowBehind x y r`, `Subject` (white rim + shadow).
- `<Character name pose expression x y height start={0} />` and `<Picture name x y w h start={0} />` work too
  (always `start={0}`).
