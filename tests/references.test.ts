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
