// Checking parts: three moments of each part in one picture, several parts per call, on a quick model.
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { getStyle } from '../store'
import { checkPartVideo, type PartFault } from './finalCheck'
import type { Comment, Part, Project } from '../../../shared/types'
import { extractJson, LimitError, runAgent } from '../agent'
import { stripImage } from '../media'
import { stillAny } from '../engines'
import { checkBatchPrompt } from '../prompts'
import { setPart, step } from './events'
import { part } from './parts'
import { chunk } from './util'
import { checkValid, lintScenes } from './checkRules'
import { sceneFile } from '../render'
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
  // What FFmpeg finds in each rendered part (black stretches, shots held too long in the fast styles): no AI.
  const measured = new Map<string, string[]>()
  const realMedia = !!getStyle(p.settings.styleId).realMedia
  const longest = realMedia ? 7 : undefined
  // Counted in the scenes' code (no AI): a picture shown twice, too many word cards. Remix styles only.
  const linted = realMedia
    ? lintScenes(p.parts.map((x) => ({ id: x.id, index: x.index, code: existsSync(sceneFile(p, x)) ? readFileSync(sceneFile(p, x), 'utf8') : '' })))
    : new Map<string, string[]>()
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
      if (x.video && existsSync(x.video)) {
        const faults = await checkPartVideo(x.video, x.end - x.start, longest, signal).catch(() => [])
        if (faults.length) measured.set(x.id, faults.map((q) => faultNote(p, x, q)))
      }
      if (linted.has(x.id)) measured.set(x.id, [...(measured.get(x.id) ?? []), ...linted.get(x.id)!])
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
      const reply = await runAgent({ ...agentOpts(p, signal), model: checkModel(p), effort: 'Low', prompt: checkBatchPrompt(group, p.settings.checks, realMedia) })
      const r = extractJson<{ parts: { part: number; ok?: boolean; notes?: string[]; fix?: string[]; minor?: string[] }[] }>(reply)
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
        const seen = measured.get(x.id) ?? []
        const list = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean) : [])
        // What is broken blocks the tick and is what the automatic fix works on; what could be better is shown only.
        // (An older-style answer, "notes" without "fix", counts as broken, as before.)
        const notes = [...seen, ...list(got.fix ?? got.notes)].slice(0, 6)
        const minor = list(got.minor).slice(0, 4)
        const checks = { ok: !notes.length, notes, ...(minor.length ? { minor } : {}), at: Date.now(), ...(afterFix ? { afterFix } : {}) }
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


/** A fault FFmpeg found in a part, as a note the fixing session can act on (where it is, and what is said there). */
export function faultNote(p: Project, x: Part, q: PartFault) {
  const from = q.at.toFixed(1)
  const said = saidAround(p, x.start + q.at + Math.min(q.dur, 3))
  const words = said ? ` (while "${said.slice(-60)}" is said)` : ''
  if (q.kind === 'black')
    return `The picture is black for ${q.dur.toFixed(1)} s from ${from} s into the part${words}: every shot must show something big from its first frame (no shot that waits for its start, no empty frame)`
  if (q.kind === 'fast')
    return `${q.dur} shots last under a second, from ${from} s into the part: too fast to read. Use fewer shots and hold each one long enough to read (a meme 3 s, code 3.5 s or more, a page 2.5 s, a photo 1.5 s)`
  return `One shot holds for ${q.dur.toFixed(1)} s from ${from} s into the part${words} with nothing changing: keep it alive (a Punch on the key word, a second highlight, the next diagram box) or cut to the next picture on its word`
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
