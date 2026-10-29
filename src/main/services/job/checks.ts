// Checking parts: three moments of each part in one picture, several parts per call, on a quick model.
import { join } from 'path'
import type { Comment, Part, Project } from '../../../shared/types'
import { extractJson, LimitError, runAgent } from '../agent'
import { stripImage } from '../media'
import { stillAny } from '../engines'
import { checkBatchPrompt } from '../prompts'
import { setPart, step } from './events'
import { part } from './parts'
import { chunk } from './util'
import { checkValid } from './checkRules'
import { agentOpts } from './scenes'
import { CHECK_BATCH } from './control'

/** The model that looks at check pictures: quick and cheap, a bit stronger on High. */
export const checkModel = (p: Project) =>
  p.settings.provider === 'Codex' ? p.settings.model : p.settings.checks === 'High' ? 'Sonnet 5.5' : 'Haiku 5.5'

/**
 * Checks several parts with one picture each (three moments side by side), a few parts per call. Parts already checked
 * since `since` keep that result: after waiting for a usage limit, only the rest are checked.
 */
export async function checkParts(p: Project, parts: Part[], serveUrl: string | undefined, signal: AbortSignal, since = 0) {
  const results = new Map<string, { ok: boolean; notes: string[]; at: number }>()
  const items: { part: Part; sheet: string; said: string[] }[] = []
  for (const x of parts) {
    const done = part(p, x.id)?.checks
    if (since && done && done.at >= since) {
      results.set(x.id, done)
      continue
    }
    step(p, `Checking part ${x.index + 1}`)
    try {
      const frames: string[] = []
      for (const [i, at] of MOMENTS.entries()) {
        const f = join(p.dir, 'work', `check-${x.index + 1}-${i + 1}.png`)
        await stillAny(p, x, at, f, serveUrl, signal)
        frames.push(f)
      }
      const sheet = join(p.dir, 'work', `check-${x.index + 1}.jpg`)
      await stripImage(frames, sheet)
      items.push({ part: x, sheet: `work/check-${x.index + 1}.jpg`, said: MOMENTS.map((at) => saidAround(p, x.start + at * (x.end - x.start))) })
    } catch (e) {
      // This part's pictures could not be made: it stays not checked, and the other parts are still checked.
      if (signal.aborted) throw e
      setPart(p, x.id, { checks: undefined })
      step(p, `Could not check part ${x.index + 1}: ${(e as Error).message.split('\n')[0].slice(0, 120)}`)
    }
  }
  for (const group of chunk(items, CHECK_BATCH)) {
    try {
      const reply = await runAgent({ ...agentOpts(p, signal), model: checkModel(p), effort: 'Low', prompt: checkBatchPrompt(group, p.settings.checks) })
      const r = extractJson<{ parts: { part: number; ok: boolean; notes?: string[] }[] }>(reply)
      for (const { part: x } of group) {
        const got = r.parts?.find((y) => Number(y.part) === x.index + 1)
        if (!got) {
          setPart(p, x.id, { checks: undefined })
          step(p, `The check said nothing about part ${x.index + 1}: it stays not checked`)
          continue
        }
        // Checking the same drawing again keeps "already fixed once": it is not fixed a second time for nothing.
        const prev = part(p, x.id)
        const afterFix = !!prev && checkValid(prev) && !!prev.checks!.afterFix
        const notes = (Array.isArray(got.notes) ? got.notes : []).map(String).filter(Boolean).slice(0, 5)
        // "ok: false" with no notes says nothing to fix: take it as fine rather than fixing blind.
        const checks = { ok: got.ok !== false || !notes.length, notes, at: Date.now(), ...(afterFix ? { afterFix } : {}) }
        results.set(x.id, checks)
        setPart(p, x.id, { checks })
      }
    } catch (e) {
      // A usage limit waits and carries on (see guarded); this group is checked then.
      if (signal.aborted || e instanceof LimitError) throw e
      // Any other failure leaves these parts not checked (not "fine"), so Check again picks them up.
      for (const { part: x } of group) setPart(p, x.id, { checks: undefined })
      step(p, `Could not check part${group.length > 1 ? 's' : ''} ${group.map((g) => g.part.index + 1).join(', ')}: ${(e as Error).message.slice(0, 120)}`)
    }
  }
  return results
}


/** The three moments of a part the check looks at (fractions of the part). */
const MOMENTS = [0.2, 0.55, 0.97]

/** The words spoken in the 3 seconds up to a moment: what the picture should be showing then. */
export function saidAround(p: Project, t: number) {
  return p.words
    .filter((w) => w.start <= t && w.end >= t - 3)
    .map((w) => w.w)
    .join(' ')
    .slice(-90)
}
