import { describe, expect, it } from 'vitest'
import { matchPicture } from '../src/main/services/sfx'

// A second of picture at 60 fps: still, a pen stroke from 0.30 to 0.60 s, a slide from 0.80 s.
const m = Array.from({ length: 60 }, (_, i) => {
  const t = i / 60
  return { t, v: t >= 0.8 ? 0.015 : t >= 0.3 && t < 0.6 ? (i % 2 ? 0.0003 : 0.00004) : 0.00002 }
})

describe('sounds checked against the picture', () => {
  it('moves a sound to the frame the picture changes, and drops one where nothing changes', () => {
    const out = matchPicture(
      [
        { kind: 'pop', t: 0.25, len: 0, strength: 1 },
        { kind: 'pop', t: 0, len: 0, strength: 1 }
      ],
      m
    )
    expect(out.filter((c) => c.kind === 'pop').map((c) => c.t.toFixed(2))).toEqual(['0.32'])
  })

  it('keeps a pen sound only while it draws', () => {
    const out = matchPicture([{ kind: 'pen', t: 0.28, len: 0.35, strength: 1 }], m).filter((c) => c.kind === 'pen')
    expect(out).toHaveLength(1)
    expect(out[0].t).toBeCloseTo(0.3, 1)
    expect(out[0].len).toBeLessThanOrEqual(0.36)
    expect(matchPicture([{ kind: 'pen', t: 0.05, len: 0.2, strength: 1 }], m.slice(0, 18)).length).toBe(0)
  })

  it('gives a move the code did not mention one whoosh', () => {
    const out = matchPicture([], m)
    expect(out.map((c) => [c.kind, c.t.toFixed(2)])).toEqual([['whoosh', '0.80']])
  })
})
