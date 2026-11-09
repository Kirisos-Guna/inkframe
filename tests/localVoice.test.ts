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

describe('silent pieces never reach the voiceover', () => {
  it('flags NaN output and near-total silence, not normal speech', async () => {
    const { badAudio } = await import('../src/main/services/localVoice')
    const speech = Float32Array.from({ length: 24000 }, (_, i) => (i % 5 === 0 ? 0 : Math.sin(i / 7) * 0.5))
    const nan = Float32Array.from({ length: 24000 }, () => NaN)
    const silent = new Float32Array(24000)
    expect(badAudio(speech)).toBe(false)
    expect(badAudio(nan)).toBe(true)
    expect(badAudio(silent)).toBe(true)
    expect(badAudio(new Float32Array(0))).toBe(true)
  })
})

describe('no dead air between pieces', () => {
  it("trims the model's own silence before and after the words, keeping a soft edge", async () => {
    const { trimSilence } = await import('../src/main/services/localVoice')
    const rate = 24000
    // Half a second of silence, one second of sound, 0.6 s of silence: what the model gives back.
    const x = new Float32Array(Math.round(rate * 2.1))
    for (let i = rate * 0.5; i < rate * 1.5; i++) x[i] = Math.sin(i / 5) * 0.4
    const t = trimSilence(x, rate)
    expect(t.length / rate).toBeGreaterThan(1)
    expect(t.length / rate).toBeLessThan(1.12)
    expect(trimSilence(new Float32Array(100), rate).length).toBe(100)
  })
})
