import { describe, expect, it } from 'vitest'
import { fitText, memeLayout, memeMenu, MEME_LAYOUTS } from '../src/shared/memes'
import { flashFree } from '../remotion/kit/flash'

describe('meme layouts', () => {
  it('finds a template by its Imgflip name, loosely', () => {
    expect(memeLayout('Drake Hotline Bling')?.boxes).toHaveLength(2)
    expect(memeLayout("gru's plan")?.boxes).toHaveLength(4)
    expect(memeLayout('Some Unknown Meme')).toBeUndefined()
  })

  it("puts Drake's words in the white right half, not over the picture", () => {
    for (const b of memeLayout('Drake Hotline Bling')!.boxes) {
      expect(b.at[0]).toBeGreaterThanOrEqual(0.49)
      expect(b.kind).toBe('panel')
    }
  })

  it('every box stays inside its template', () => {
    for (const m of MEME_LAYOUTS)
      for (const b of m.boxes) {
        const [x, y, w, h] = b.at
        expect(x >= 0 && y >= 0 && x + w <= 1.001 && y + h <= 1.001, `${m.name}: ${b.role}`).toBe(true)
      }
  })

  it('tells the planner what each box means, in order', () => {
    expect(memeMenu()).toContain("Drake Hotline Bling (rejecting one thing for a better one): 1=what he turns down, 2=what he prefers")
  })
})

describe('fitting a caption in a box', () => {
  it('uses the biggest size whose lines fit', () => {
    const f = fitText('Same state after 10 retries', 600, 500)
    expect(f.lines.join(' ')).toBe('Same state after 10 retries')
    expect(f.lines.every((l) => l.length * f.size * 0.5 <= 600)).toBe(true)
    expect(f.lines.length * f.size * 1.08).toBeLessThanOrEqual(500)
    expect(f.size).toBeGreaterThan(60)
  })

  it('goes smaller for a long caption in a small box', () => {
    expect(fitText('one charge per request, every single time', 300, 120).size).toBeLessThan(fitText('one charge', 300, 120).size)
  })
})

describe('no flashes', () => {
  it('drops a shot too short to read and lets the next one come in at its place', () => {
    const shots = flashFree(['a', 'b', 'c', 'd'], [0, 60, 70, 150], 200, 24)
    expect(shots).toEqual([
      { c: 'a', from: 0, to: 60 },
      { c: 'c', from: 60, to: 150 },
      { c: 'd', from: 150, to: 200 }
    ])
  })

  it('always keeps the last shot', () => {
    expect(flashFree(['a', 'b'], [0, 190], 200, 24).map((s) => s.c)).toEqual(['a', 'b'])
  })
})

describe('reactions stay rare', () => {
  it('keeps at most the cap in the video, and one per part', async () => {
    const { capReactions } = await import('../src/main/services/job/mediaPlan')
    const m = { kind: 'meme' }
    const g = { kind: 'gif' }
    const pg = { kind: 'page' }
    const out = capReactions([[m, pg, g], [pg, m], [g], [m]], 2)
    expect(out.map((x) => x.map((s) => s.kind))).toEqual([['meme', 'page'], ['page', 'meme'], [], []])
  })
})
