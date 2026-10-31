import { describe, expect, it } from 'vitest'
import { captionAss, needsShaping } from '../src/main/services/captions'
import { choosePicks, rankCandidates, type Candidate } from '../src/main/services/styleScout'

const line = (text: string) => {
  const words = text.split(' ').map((w, i) => ({ w, start: i, end: i + 0.9 }))
  return { start: 0, end: words.length, text, words }
}

describe('captions that need shaping', () => {
  it('Tamil needs shaping, English does not', () => {
    expect(needsShaping([line('இது பார்')])).toBe(true)
    expect(needsShaping([line('Radio waves')])).toBe(false)
  })

  const look = { W: 1920, H: 1080, accent: '#4cc4d6' }
  it('Clean writes whole lines that fade', () => {
    expect(captionAss([line('இது பார்')], 'Clean', look)).toContain('{\\fad(120,120)}இது பார்')
  })

  it('Karaoke times each word in hundredths of a second', () => {
    expect(captionAss([line('இது பார்')], 'Karaoke', look)).toContain('{\\k100}இது {\\k100}பார்')
  })

  it('Bold pop has one event per word, in the accent colour (written BGR)', () => {
    const ass = captionAss([line('இது பார்')], 'Bold pop', look)
    expect(ass.match(/^Dialogue/gm)).toHaveLength(2)
    expect(ass).toContain('{\\c&HD6C44C&}இது{\\c&HFFFFFF&} பார்')
  })

  it('text cannot break out of its event', () => {
    expect(captionAss([line('a{\\b1}b')], 'Clean', look)).toContain('ab1b')
  })
})

describe('finding a style', () => {
  const c = (id: string, channel: string, views: number, duration = 400): Candidate => ({ id, title: id, channel, views, duration })

  it('keeps explainer-length videos, once each, most watched first', () => {
    const ranked = rankCandidates([c('a', 'x', 10), c('short', 'x', 999, 50), c('long', 'x', 999, 7200), c('b', 'y', 20), c('a', 'x', 10)])
    expect(ranked.map((r) => r.id)).toEqual(['b', 'a'])
  })

  it("uses the writer's picks, one per channel", () => {
    const ranked = [c('a', 'x', 3), c('b', 'x', 2), c('d', 'y', 1)]
    expect(choosePicks(ranked, ['a', 'b', 'd']).map((r) => r.id)).toEqual(['a', 'd'])
  })

  it('falls back to the most watched when nothing was picked', () => {
    const ranked = [c('a', 'x', 3), c('b', 'y', 2), c('d', 'z', 1)]
    expect(choosePicks(ranked, [], 2).map((r) => r.id)).toEqual(['a', 'b'])
  })
})
