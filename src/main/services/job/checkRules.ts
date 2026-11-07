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
