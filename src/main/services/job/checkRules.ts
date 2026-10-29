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
