import { describe, expect, it } from 'vitest'
import { phrasesLine } from '../src/main/services/prompts'

describe('phrasesLine', () => {
  it('groups words into phrases at punctuation and pauses, each with its start time', () => {
    const words = [
      { w: 'You', start: 0.1, end: 0.3 },
      { w: 'hit', start: 0.35, end: 0.5 },
      { w: 'send,', start: 0.55, end: 0.9 },
      { w: 'and', start: 1.0, end: 1.1 },
      { w: 'it', start: 1.15, end: 1.2 },
      { w: 'leaves', start: 1.25, end: 1.6 },
      // a long breath: a new phrase even without punctuation
      { w: 'Radio', start: 2.4, end: 2.8 },
      { w: 'waves.', start: 2.85, end: 3.3 }
    ]
    expect(phrasesLine(words).split('\n')).toEqual(['[0.10] You hit send,', '[1.00] and it leaves', '[2.40] Radio waves.'])
  })
})
