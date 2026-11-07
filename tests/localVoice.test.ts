import { describe, expect, it } from 'vitest'
import { chunkScript, voiceFilter } from '../src/main/services/localVoice'

describe('script pieces for the local voice', () => {
  it('keeps whole sentences, under the limit, with a longer breath at the end of a paragraph', () => {
    const para = (n: number) => Array.from({ length: n }, (_, i) => `Sentence ${i} is here.`).join(' ')
    const pieces = chunkScript([para(30), para(30)].join('\n\n'), 200)
    expect(pieces.every((p) => p.text.length <= 200 && /\.$/.test(p.text))).toBe(true)
    expect(pieces.map((p) => p.text).join(' ')).toBe(`${para(30)} ${para(30)}`)
    const ends = pieces.filter((p) => p.pause > 0.3).length
    expect(ends).toBe(1)
    expect(pieces[pieces.length - 1].pause).toBe(0.25)
  })

  it('splits a sentence too long for the model on its commas', () => {
    const long = Array.from({ length: 40 }, (_, i) => `item ${i}`).join(', ') + '.'
    const pieces = chunkScript(long, 120)
    expect(pieces.length).toBeGreaterThan(2)
    expect(pieces.every((p) => p.text.length <= 120)).toBe(true)
  })

  it('a short script is one piece', () => {
    expect(chunkScript('Hello there. This is short.')).toEqual([{ text: 'Hello there. This is short.', pause: 0.25 }])
  })
})

describe('pitch', () => {
  it('keeps the speed when the pitch moves, and does nothing at 0', () => {
    expect(voiceFilter(24000, 0)).toBe('aresample=44100,loudnorm=I=-16:TP=-1.5:LRA=11')
    const up = voiceFilter(24000, 12)
    // Clamped to 4 semitones: 2^(4/12) = 1.2599
    expect(up).toContain('asetrate=30238')
    expect(up).toContain('atempo=0.79370')
  })
})
