# The method for HTML parts (HyperFrames)

This part is drawn as **one HTML page** that HyperFrames renders to video. The app has already written a starter
`index.html` in this part's folder with the right size, length, colours and fonts. Fill it in.

## Rules
1. **One idea at a time**, built in 2 to 4 beats, each starting on the word that introduces it. You get the second
   each word is spoken. Draw things *as they are said*, never before.
2. **The canvas is 1920 x 1080.** Keep content between x 120–1800 and y 100–980. Text at least 44 px, titles 80–120 px,
   at most ~8 words on screen at once.
3. **Every timed element** has `class="clip"`, `data-start="0"` and `data-duration` equal to the part length (they
   stay mounted; GSAP decides when they appear). Put elements inside `#root`, position them with CSS
   (`left/top/width/height`), and set their starting state in CSS (for example `opacity:0`).
4. **Animate only with the GSAP timeline** in the starter (`tl`, created paused, registered as
   `window.__timelines['root']`). Use absolute times: `tl.to('#cloud', { opacity: 1, y: -20, duration: 0.6 }, 2.35)`.
   No `setTimeout`, no `requestAnimationFrame`, no CSS `animation`/`transition`, no `Math.random()` (use fixed values).
5. **Pen drawing:** inline `<svg>` paths with `pathLength="1"`, `stroke-dasharray:1; stroke-dashoffset:1` in CSS, then
   `tl.to('#p1', { strokeDashoffset: 0, duration: 0.8, ease: 'power1.inOut' }, t)`. `DrawSVGPlugin` is also loaded.
6. **Only local files:** `gsap.min.js`, `DrawSVGPlugin.min.js` and the files in `assets/` (the user's material,
   `inter.woff2` and `hand.woff2`). No CDN links, no fetch, no web fonts from the internet.
7. **Fonts:** `font-family: 'Hand'` for handwriting (Caveat) and `'Inter'` for clean text. Both are declared in the
   starter. Do not use other fonts.
8. End on a held, complete picture for the last ~0.5 s.

## Craft: it must look made by a person, not generated
Viewers spot "AI video" in a second. These are the tells to avoid, and what an illustrator does instead.

**Never use the clichés.** No glowing brains, circuit-board brains, robots or robot hands, neural-network node
graphs, light bulbs for "idea", gears for "process", rocket ships for "growth", floating sparkles or particles,
abstract gradient blobs, glowing orbs, hexagon grids, emoji, or a globe with connecting lines. If the narration says
"AI", draw the *actual* thing: a chat window on a phone, a data-centre aisle, a GPU board with its fans, a person
typing.

**Draw specific, observed things.** A real object has telling details: the notch on a phone, the cable ties on a
server rack, the crumpled corner of a receipt, a coffee ring on a desk. Two or three such details make a drawing feel
observed rather than generic. Draw the real silhouette, not a rounded rectangle with a label.

**Compose like an illustrator.** Asymmetric layouts on thirds, not everything centred. One big thing and a few small
ones, not many equal boxes in a row. Overlap shapes. Leave real empty space. Vary the camera from part to part: wide,
close, from above.

**Few words, in the hand of the drawing.** Label at most 2–3 things, short and lowercase, with a small leader line,
not in boxes. Never put the narration on screen word for word.

**Time it like hand animation.** Big outlines slowly, details quickly. Draw in the order a person would: outline,
then features, then labels. Hold a finished picture for a beat before the next idea. Not everything moves at once,
and not everything moves at the same speed.

**Restraint with colour.** Mostly ink. One accent, used on the one thing that matters in this part.

## Things HTML parts do especially well
- Big kinetic type: words that slide, scale and stack as they are spoken.
- Animated charts and numbers: bars that grow, lines that draw, counters (`tl.to(obj, { v: 1200, onUpdate })` writing
  `textContent`), percentages filling a ring.
- Clean diagrams: boxes, arrows and labels that build up, with highlight sweeps on key words.
- Lower thirds, callout cards, checklists ticking off, side-by-side comparisons.

## Example (inside `#root` and the timeline script of the starter)
```html
<svg class="clip" data-start="0" data-duration="8" style="left:0;top:0;width:1920px;height:1080px" viewBox="0 0 1920 1080">
  <path id="box" pathLength="1" d="M760 300 H1160 V620 H760 Z" fill="none" stroke="currentColor" stroke-width="6" />
</svg>
<div id="label" class="clip" data-start="0" data-duration="8" style="left:0;width:1920px;top:680px;text-align:center;font-size:72px;opacity:0">one GPU</div>
```
```js
tl.to('#box', { strokeDashoffset: 0, duration: 0.9, ease: 'power1.inOut' }, 1.2)   // on "GPU"
tl.to('#label', { opacity: 1, y: -16, duration: 0.5 }, 1.6)
```
