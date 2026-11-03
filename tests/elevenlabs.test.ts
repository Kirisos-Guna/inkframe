import { describe, expect, it } from 'vitest'
import { splitScript } from '../src/main/services/elevenlabs'

describe('script pieces for the voice', () => {
  it('keeps paragraphs whole and pieces under the limit', () => {
    const para = (n: number) => Array.from({ length: n }, (_, i) => `Sentence ${i} is here.`).join(' ')
    const script = [para(10), para(10), para(10)].join('\n\n')
    const pieces = splitScript(script, 500)
    expect(pieces.every((p) => p.length <= 500)).toBe(true)
    expect(pieces.join('\n\n')).toBe(script)
  })

  it('splits a very long paragraph on sentences, never mid-sentence', () => {
    const long = Array.from({ length: 60 }, (_, i) => `This is sentence number ${i}.`).join(' ')
    const pieces = splitScript(long, 300)
    expect(pieces.length).toBeGreaterThan(3)
    expect(pieces.every((p) => p.length <= 300 && /\.$/.test(p))).toBe(true)
  })

  it('a short script is one piece', () => {
    expect(splitScript('Hello there. This is short.')).toEqual(['Hello there. This is short.'])
  })
})
