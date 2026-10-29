import { describe, expect, it } from 'vitest'
import type { Part, Project } from '../src/shared/types'
import { AUTO_FIX, checkValid, FIX_FAILED, fixPending, reviewNotes, unchecked } from '../src/main/services/job/checkRules'
import { chunk, clip, limiter, pool } from '../src/main/services/job/util'
import { normaliseParts, textOf } from '../src/main/services/job/parts'

const part = (o: Partial<Part> = {}): Part => ({
  id: 'p1',
  index: 0,
  title: 'A part',
  start: 0,
  end: 5,
  text: '',
  status: 'Up to date',
  locked: false,
  material: [],
  history: [],
  ...o
})
const project = (o: Partial<Project> = {}) =>
  ({
    words: [
      { w: 'You', start: 0.1, end: 0.3 },
      { w: 'hit', start: 0.4, end: 0.6 },
      { w: 'send.', start: 0.7, end: 1.0 },
      { w: 'It', start: 5.2, end: 5.4 },
      { w: 'flies.', start: 5.5, end: 6.0 }
    ],
    voiceover: { file: 'v.wav', name: 'v', duration: 10 },
    ...o
  }) as unknown as Project

describe('check rules', () => {
  it('a check is valid only while newer than the last render', () => {
    expect(checkValid(part({ renderedAt: 100, checks: { ok: true, notes: [], at: 200 } }))).toBe(true)
    expect(checkValid(part({ renderedAt: 300, checks: { ok: true, notes: [], at: 200 } }))).toBe(false)
    expect(checkValid(part({ checks: { ok: true, notes: [], at: 200 } }))).toBe(true) // made before renderedAt existed
    expect(checkValid(part())).toBe(false)
  })

  it('old "could not run" results count as not checked', () => {
    expect(unchecked(part({ checks: { ok: true, notes: ['The check could not run'], at: 1 } }))).toBe(true)
    expect(unchecked(part({ checks: { ok: true, notes: [], at: 1 } }))).toBe(false)
  })

  it('a part gets one automatic fix, and a drawing made by it is never fixed automatically again', () => {
    const notes = ['Text is too small']
    expect(fixPending(part({ checks: { ok: false, notes, at: 1 } }))).toBe(true)
    expect(fixPending(part({ checks: { ok: false, notes, at: 1, afterFix: true } }))).toBe(false)
    const autoFixed = part({ checks: { ok: false, notes, at: 1 }, history: [{ at: 1, note: AUTO_FIX, file: 'x' }] })
    expect(fixPending(autoFixed)).toBe(false)
  })

  it('a fix stopped by a usage limit is still pending; a fix that really failed is not', () => {
    const limited = `${FIX_FAILED} (You've hit your session limit · resets 2pm); comment on the part to try again`
    const failed = `${FIX_FAILED} (The model stopped half way); comment on the part to try again`
    expect(fixPending(part({ checks: { ok: false, notes: ['Small text', limited], at: 1, afterFix: true } }))).toBe(true)
    expect(fixPending(part({ checks: { ok: false, notes: ['Small text', failed], at: 1, afterFix: true } }))).toBe(false)
    expect(reviewNotes(part({ checks: { ok: false, notes: ['Small text', failed], at: 1 } }))).toEqual(['Small text'])
  })
})

describe('helpers', () => {
  it('clip shortens at a word boundary', () => {
    expect(clip('short', 20)).toBe('short')
    expect(clip('one two three four', 10)).toBe('one two…')
  })

  it('chunk splits into groups', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 3)).toEqual([])
  })

  it('limiter never runs more than n at once', async () => {
    const slot = limiter(2)
    let now = 0
    let most = 0
    await Promise.all(
      Array.from({ length: 6 }, () =>
        slot(async () => {
          most = Math.max(most, ++now)
          await new Promise((r) => setTimeout(r, 5))
          now--
        })
      )
    )
    expect(most).toBe(2)
  })

  it('pool runs everything and reports a failure', async () => {
    const seen: number[] = []
    await pool([1, 2, 3], 2, async (x) => void seen.push(x))
    expect(seen.sort()).toEqual([1, 2, 3])
    await expect(pool([1, 2], 1, async (x) => { if (x === 2) throw new Error('two') })).rejects.toThrow('two')
  })
})

describe('parts', () => {
  it('textOf takes the words that start inside the range', () => {
    expect(textOf(project(), 0, 5)).toBe('You hit send.')
    expect(textOf(project(), 5, 10)).toBe('It flies.')
  })

  it('normaliseParts makes parts back to back from 0 to the end of the voiceover', () => {
    const parts = normaliseParts(project(), [
      { start: 5.1, end: 9, title: 'Second' },
      { start: 0.3, end: 5.1, title: 'First' },
      { start: 3, end: 3, title: 'Empty' }
    ])
    expect(parts.map((x) => [x.title, x.start, x.end, x.index])).toEqual([
      ['First', 0, 5.1, 0],
      ['Second', 5.1, 10, 1]
    ])
    expect(parts[0].text).toBe('You hit send.')
  })

  it('normaliseParts refuses an empty plan', () => {
    expect(() => normaliseParts(project(), [])).toThrow()
  })
})
