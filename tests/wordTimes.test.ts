import { describe, expect, it } from 'vitest'
import { fitToScript, snapToPauses } from '../src/main/services/wordTimes'

const W = (w: string, start: number, end: number) => ({ w, start, end })

describe('snapping to pauses', () => {
  it('moves a boundary that whisper put late onto the pause', () => {
    const words = [W('hits,', 5.5, 6.73), W('and', 6.73, 6.9), W('you', 6.9, 7.1)]
    const out = snapToPauses(words, [[6.0, 6.28]])
    expect(out[0].end).toBe(6.0)
    expect(out[1].start).toBe(6.28)
    expect(out[2]).toEqual(words[2])
  })
  it('leaves words alone when no boundary is near a pause', () => {
    const words = [W('one', 0, 0.5), W('two', 0.5, 1)]
    expect(snapToPauses(words, [[3, 3.4]])).toEqual(words)
  })
})

describe('fitting heard words to the script', () => {
  it('puts the written spelling on heard words and keeps their times', () => {
    const heard = [W('Now', 0, 0.2), W('meet', 0.2, 0.4), W('Chris', 0.4, 0.7), W('Wellens,', 0.7, 1.1), W('he', 1.2, 1.3), W('wrote', 1.3, 1.5), W('L-feed.', 1.5, 2)]
    const out = fitToScript(heard, 'Now meet Chris Wellons. He wrote Elfeed.')
    expect(out.map((w) => w.w)).toEqual(['Now', 'meet', 'Chris', 'Wellons.', 'He', 'wrote', 'Elfeed.'])
    expect(out[3]).toMatchObject({ start: 0.7, end: 1.1 })
  })
  it('shares the time of a word heard as one but written as two, and the other way round', () => {
    const out = fitToScript([W('maintains', 0, 0.5), W('W64', 0.5, 0.8), W('DevKit,', 0.8, 1.4), W('a', 1.4, 1.5), W('full', 1.5, 1.8), W('tool', 1.8, 2), W('chain', 2, 2.2)], 'maintains w64devkit, a full toolchain')
    expect(out.map((w) => w.w)).toEqual(['maintains', 'w64devkit,', 'a', 'full', 'toolchain'])
    expect(out[1].start).toBe(0.5)
    expect(out[1].end).toBe(1.4)
    expect(out[4].end).toBe(2.2)
  })
  it('keeps what was heard when the script is something else', () => {
    const heard = [W('completely', 0, 1), W('different', 1, 2), W('words', 2, 3)]
    expect(fitToScript(heard, 'Nothing like what was said here at all')).toBe(heard)
  })
})
