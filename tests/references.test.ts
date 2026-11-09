import { describe, expect, it, vi } from 'vitest'
import { clipToBoxes } from '../remotion/kit/geometry'

vi.mock('electron', () => ({ BrowserWindow: class {} }))
vi.mock('../src/main/services/store', () => ({ libDir: () => '', getSettings: () => ({}) }))
vi.mock('../src/main/services/publish', () => ({ writer: async () => ({ provider: 'Claude Code', model: 'x' }) }))
vi.mock('../src/main/services/recreate', () => ({ ensureYtDlp: async () => '' }))

const { commonsFits, extraWords } = await import('../src/main/services/realMedia')
const { capSources } = await import('../src/main/services/job/mediaPlan')

describe('pictures are what was searched for', () => {
  // Real results Wikimedia Commons gave in a video that showed the wrong pictures.
  it('drops a picture whose name does not carry the searched name', () => {
    expect(commonsFits('Qwen logo', 'ベスト電器・先代ロゴ.svg')).toBe(false)
    expect(commonsFits('Qwen logo', 'Qwen Logo.svg')).toBe(true)
    expect(commonsFits('Breakout Atari 2600', 'Screenshot-LBreakout2.jpg')).toBe(false)
  })
  it('a logo search brings a logo', () => {
    expect(commonsFits('spaCy logo', 'U.N. Spacy Roundel.svg')).toBe(false)
    expect(commonsFits('spaCy logo', 'SpaCy logo.svg')).toBe(true)
    expect(commonsFits('OpenAI logo', 'OpenAI wordmark 2017.svg')).toBe(true)
  })
  it('a name in the description counts (a photo of a person at an event)', () => {
    expect(commonsFits('Simon Willison', 'Django and Rails London meetup 1.jpg', 'Simon Willison speaking at the meetup')).toBe(true)
    expect(commonsFits('Simon Willison', 'Django and Rails London meetup 1.jpg', 'People at a meetup')).toBe(false)
  })
  it('prefers the file named closest to the search', () => {
    expect(extraWords('Nvidia logo', 'File:Nvidia logo.svg')).toBeLessThan(extraWords('Nvidia logo', 'File:NVIDIA PhysX Logo.png'))
  })
})

describe('no reference over and over', () => {
  const page = (url: string) => ({ kind: 'page', url })
  it('one page at most twice in the video and once per part; a photo once', () => {
    const blog = 'https://rikiyat.github.io/post'
    const out = capSources([
      [page(blog), page(blog + '#results'), { kind: 'photo', query: 'Qwen logo' }],
      [page(blog), page('https://honnibal.dev/x')],
      [page(blog + '/'), { kind: 'photo', query: 'qwen logo ' }, { kind: 'code' }]
    ])
    expect(out.map((p) => p.length)).toEqual([2, 2, 1])
    expect(out[2]).toEqual([{ kind: 'code' }])
  })
})

describe('arrows between boxes', () => {
  const box = (x: number, y: number, w = 340, h = 136) => ({ x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 })
  it('run from edge to edge when aimed at the centres', () => {
    // The diagram from a real video: "AN AI" -> "KNOB ???", centre to centre, through both labels.
    const r = clipToBoxes([560, 620], [1360, 620], [box(560, 620), box(1360, 620)])
    expect(r.from[0]).toBeGreaterThan(560 + 170)
    expect(r.to[0]).toBeLessThan(1360 - 170)
    expect(r.from[1]).toBe(620)
  })
  it('leave an arrow that already starts outside the boxes alone', () => {
    expect(clipToBoxes([100, 100], [900, 100], [box(500, 500)])).toEqual({ from: [100, 100], to: [900, 100] })
  })
})

describe('pages are cropped to the highlight', () => {
  it('a close crop around the highlighted lines, not the paragraph box across the page', async () => {
    const { padBox } = await import('../remotion/kit/remix')
    // Hacker News: the "paragraph" box is the whole page, 2199 x 181694 pixels.
    const [x, , w] = padBox([[249, 91, 675, 34]], 2534, 1598, [141, 24, 2199, 181694])
    expect(x).toBeLessThan(249)
    expect(w).toBeLessThan(1200)
    // Wikipedia: the box takes in the infobox on the right.
    const [, y, w2, h2] = padBox([[518, 426, 752, 38], [520, 478, 644, 36], [520, 530, 438, 36]], 2534, 1598, [468, 120, 1568, 982])
    expect(w2).toBeLessThan(1000)
    expect(y).toBeGreaterThan(200)
    expect(h2).toBeLessThan(450)
  })
})

describe('mistakes counted in the scenes', () => {
  it('flags a picture used twice, too many word cards, and box diagrams back to back', async () => {
    const { lintScenes } = await import('../src/main/services/job/checkRules')
    const tc = (n: number) => Array.from({ length: n }, () => '<TitleCard text="x" />').join('\n')
    const r = lintScenes([
      { id: 'a', index: 0, code: `${tc(1)}<Meme name="m/p1.jpg" />` },
      { id: 'b', index: 1, code: `${tc(1)}<Diagram></Diagram>` },
      { id: 'c', index: 2, code: `<Meme name="m/p1.jpg" /><Diagram></Diagram>` },
      { id: 'd', index: 3, code: `${tc(1)}<Page name="m/p4.png" /><Page name="m/p4.png" />` }
    ])
    expect(r.get('a')).toBeUndefined()
    expect(r.get('b')?.join()).toContain('right after another')
    expect(r.get('c')?.join()).toContain('already used in part 1')
    expect(r.get('c')?.join()).toContain('Diagram right after')
    expect(r.get('d')?.join()).toContain('Too many word cards')
    expect(r.get('d')?.join()).toContain('twice in this part')
  })
  it('a box is always wide enough for its label', async () => {
    const { boxSize } = await import('../remotion/kit/remix')
    const s = boxSize('SETTINGS.LOCAL.JSON')
    expect(s.w).toBeGreaterThanOrEqual('SETTINGS.LOCAL.JSON'.length * s.font * 0.6 + 40)
    expect(boxSize('a very long label that would never fit in any box at all, really').w).toBeLessThanOrEqual(760)
  })
})

describe('pointing hands', () => {
  it('flags a hand left outside the shots, or guessed over a page', async () => {
    const { lintScenes } = await import('../src/main/services/job/checkRules')
    const r = lintScenes([
      { id: 'a', index: 0, code: '<Cuts at={[0]}><Page name="m/a.png" point /></Cuts><Hand x={1500} y={300} />' },
      { id: 'b', index: 1, code: '<Cuts at={[0]}><AbsoluteFill><Page name="m/b.png" /><Hand x={900} y={400} /></AbsoluteFill></Cuts>' },
      { id: 'c', index: 2, code: '<Cuts at={[0]}><Page name="m/c.png" point /></Cuts>' }
    ])
    expect(r.get('a')?.join()).toContain('outside the shots')
    expect(r.get('b')?.join()).toContain('give the Page point')
    expect(r.get('c')).toBeUndefined()
  })
})

describe('no chart or diagram over and over', () => {
  it('flags Bars too often, a repeated diagram and a one-box diagram', async () => {
    const { lintScenes } = await import('../src/main/services/job/checkRules')
    const diag = (a: string, b: string) => `<Diagram><Box x={1} y={1} label="${a}" /><Box x={2} y={2} label="${b}" /></Diagram>`
    const r = lintScenes([
      { id: 'a', index: 0, code: `<Bars items={[]} />${diag('GPU', 'memory')}` },
      { id: 'b', index: 1, code: '<Bars items={[]} />' },
      { id: 'c', index: 2, code: '<Diagram><Box x={1} y={1} label="NEW GPU" /></Diagram>' },
      { id: 'd', index: 3, code: diag('memory', 'GPU') },
      { id: 'e', index: 4, code: '<Bars items={[]} /><Bars items={[]} />' },
      { id: 'f', index: 5, code: '<Code code="x" />' },
      { id: 'g', index: 6, code: '<Code code="y" />' },
      { id: 'h', index: 7, code: '<Code code="z" />' },
      { id: 'i', index: 8, code: '<Bars items={[]} />' }
    ])
    expect(r.get('a')).toBeUndefined()
    expect(r.get('b')?.join()).toContain('Another Bars chart')
    expect(r.get('c')?.join()).toContain('single box')
    expect(r.get('d')?.join()).toContain('repeats the diagram from part 1')
    expect(r.get('e')?.join()).toContain('more than one Bars')
    // Far from the last one, but the video already has more Bars than one per 4 parts.
    expect(r.get('i')?.join()).toContain('Another Bars chart')
  })
})
