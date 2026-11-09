// When a part's check is still valid, and when it still gets its one automatic fix. No app state: easy to test.
import type { Comment, Part, Project } from '../../../shared/types'
import { isLimitText } from '../limits'

/** A check that never ran (older versions saved these as passed). */
export const unchecked = (x: Part) => !x.checks || x.checks.notes[0] === 'The check could not run'
export const FIX_FAILED = 'The automatic fix did not work'
/** The reviewer's notes, without the app's own "fix did not work" lines. */
export const reviewNotes = (x: Part) => (x.checks?.notes ?? []).filter((n) => !n.startsWith(FIX_FAILED))
/**
 * The part still gets its one automatic fix: it was never fixed for these notes, or the only attempt was stopped by a
 * usage limit (1.7.2 and older took that for a failed fix).
 */
export const fixPending = (x: Part) =>
  x.history[x.history.length - 1]?.note !== AUTO_FIX && (!x.checks?.afterFix || x.checks.notes.some((n) => n.startsWith(FIX_FAILED) && isLimitText(n)))
/** The history note of a drawing made by the automatic fix: such a drawing is never fixed automatically again. */
export const AUTO_FIX = 'Fixed after the check'
/** The part's check still describes its drawing: it ran, and after the part was last rendered. */
export const checkValid = (x: Part) => !unchecked(x) && x.checks!.at >= (x.renderedAt ?? 0)

/** How many automatic fix rounds a part gets on High: a fix, then one bolder fix for what is still wrong. */
export const FIX_ROUNDS = 2

/**
 * What the automatic fix is asked to do: every note at once, looking at the checker's own picture of the part (early,
 * middle and end side by side), so nothing is fixed blind. The second round says the first fix was not enough.
 */
export function autoFixNote(p: Project, x: Part, again: boolean) {
  const notes = reviewNotes(x)
  return `${again ? 'A first fix did not solve these, so this time rework the layout of the shots that fail (sizes, positions, what is in each shot), do not nudge: ' : 'A reviewer found: '}${notes.map((n, i) => `(${i + 1}) ${n}`).join(' ')}
The reviewer's picture of this part, at its early, middle and end moments side by side: work/check-${x.index + 1}.jpg (Read it to see exactly what is wrong). Fix every note in this one go: everything inside the 1920 x 1080 frame and big enough to read, nothing cut off or overlapping, each moment showing what is said then. Check your new layout against every note before you finish.`
}

/**
 * Mistakes that can be counted in the scenes' code, no AI needed (Fast Tech Remix): the same picture shown twice in
 * the video, and word cards (TitleCard) used where a visual should be: more than 2 in the video, or two in a row.
 * Returns notes per part, in the words the fixer needs.
 */
export function lintScenes(scenes: { id: string; index: number; code: string }[]) {
  const notes = new Map<string, string[]>()
  const add = (id: string, n: string) => notes.set(id, [...(notes.get(id) ?? []), n])
  const seen = new Map<string, number>()
  let cards = 0
  let lastCardPart = -2
  let lastDiagramPart = -2
  for (const s of [...scenes].sort((a, b) => a.index - b.index)) {
    // Pictures by file name (m/…), once each in the whole video. A Sticker or Label of the same file is a layer, not a
    // second shot, so only full-frame shots count.
    const shots = [...s.code.matchAll(/<(Shot|Page|Post|Meme|Gif|Clip)\b[^>]*?\bname=["'{`]+(m\/[^"'`}]+)/g)].map((m) => m[2])
    const here = new Set<string>()
    for (const name of shots) {
      if (here.has(name)) add(s.id, `It shows ${name} twice in this part: show it once and give the time to the next picture or a diagram`)
      else if (seen.has(name)) add(s.id, `It shows ${name} again, already used in part ${(seen.get(name) ?? 0) + 1}: use a different picture, a diagram or Bars instead`)
      here.add(name)
      if (!seen.has(name)) seen.set(name, s.index)
    }
    // A pointing hand that points at nothing: one left outside the shots (it stays over every picture), or one placed
    // by guessed coordinates in a part with a page (the page is cropped and zoomed, so it misses the words).
    const tail = s.code.slice(s.code.lastIndexOf('</Cuts>') + 1)
    if (s.code.includes('</Cuts>') && /<Hand\b/.test(tail)) add(s.id, 'A pointing Hand sits outside the shots, so it stays over every picture pointing at nothing: remove it, or put it inside the one shot it points at')
    else if (/<Hand\b/.test(s.code) && /<Page\b/.test(s.code)) add(s.id, 'A Hand placed over a page misses the words (the page is cropped and zoomed): remove the Hand and give the Page point instead')
    // Box-and-arrow diagrams: one look over and over is a slideshow. Never two in a part, nor in two parts in a row.
    const d = (s.code.match(/<Diagram\b/g) ?? []).length
    if (d > 1) add(s.id, 'It has more than one box-and-arrow Diagram: keep the one that teaches the idea and show the rest with a different visual (Bars, a Timeline, code, the page, a picture)')
    else if (d && lastDiagramPart === s.index - 1) add(s.id, 'Another box-and-arrow Diagram right after the one in the previous part: show this with a different visual (Bars to compare, a Timeline, code, the highlighted page, a picture)')
    if (d) lastDiagramPart = s.index
    const n = (s.code.match(/<TitleCard\b/g) ?? []).length
    if (n) {
      if (cards + n > 2) add(s.id, `Too many word cards: the video already has ${cards}. Show this line on a visual instead of a TitleCard: a Punch on the number in its highlighted page, Bars, Stats, or a Caption over a picture`)
      else if (lastCardPart === s.index - 1) add(s.id, 'A word card right after another one: show this line on a visual instead of a TitleCard (Bars, a Punch on the page, a Caption over a picture)')
      cards += n
      lastCardPart = s.index
    }
  }
  return notes
}
