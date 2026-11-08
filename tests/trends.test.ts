import { describe, expect, it, vi } from 'vitest'

// trends.ts pulls in the app's store (Electron) through the writer; the parsers need none of it.
vi.mock('../src/main/services/store', () => ({ libDir: () => '', getSettings: () => ({}) }))
vi.mock('../src/main/services/publish', () => ({ channelVoice: () => '\n', writer: async () => ({ provider: 'Claude Code', model: 'x' }) }))
vi.mock('../src/main/services/recreate', () => ({ ensureYtDlp: async () => '' }))

const { readFeed, readGitHubTrending, trendPrompt } = await import('../src/main/services/trends')
const { ideaBrief } = await import('../src/shared/ideas')

describe('reading trending sources', () => {
  it('reads RSS and Atom items, with CDATA and entities', () => {
    const rss = '<rss><channel><title>Feed</title><item><title><![CDATA[Rust &amp; Linux 7.0]]></title><link>https://a.example/1</link></item></channel></rss>'
    const atom = '<feed><entry><title>Show HN: &quot;tiny&quot; DB</title><link href="https://b.example/2"/></entry></feed>'
    expect(readFeed(rss)).toEqual([{ title: 'Rust & Linux 7.0', url: 'https://a.example/1' }])
    expect(readFeed(atom)).toEqual([{ title: 'Show HN: "tiny" DB', url: 'https://b.example/2' }])
  })

  it("reads GitHub's trending page: repo, description and stars this week", () => {
    const html = `<article class="Box-row"><h2 class="h3 lh-condensed"><a href="/acme/rocket" data-x>acme / rocket</a></h2>
      <p class="col-9 color-fg-muted my-1 pr-4">A fast &amp; tiny runtime</p><span>1,234 stars this week</span></article>`
    expect(readGitHubTrending(html)).toEqual([{ source: 'GitHub trending', title: 'acme/rocket: A fast & tiny runtime', url: 'https://github.com/acme/rocket', metric: '1,234 stars this week' }])
  })

  it('gives the ranker every item with its numbers, and the focus', () => {
    const p = trendPrompt({ days: 7, focus: 'AI' }, [{ source: 'Hacker News', title: 'A thing', url: 'https://x.example', metric: '800 points' }], true)
    expect(p).toContain('- Hacker News · 800 points · A thing · https://x.example')
    expect(p).toContain('The creator wants ideas about: AI')
    expect(p).toContain('this week')
  })
})

describe('a picked idea becomes the topic', () => {
  it('carries the angle, concept, facts and sources into the script brief', () => {
    const b = ideaBrief({
      title: 'Why your RAM is suddenly expensive',
      hook: 'Your next laptop costs more, and AI is why.',
      why: 'Trending everywhere',
      concept: 'How memory supply works',
      angle: 'Follow one chip from the fab to your laptop.',
      facts: ['DRAM prices up 40%'],
      score: 90,
      evidence: [{ source: 'Hacker News', metric: '900 points', url: 'https://x.example' }]
    })
    expect(b.topic).toBe('Why your RAM is suddenly expensive')
    expect(b.angle).toContain('Follow one chip')
    expect(b.angle).toContain('How memory supply works')
    expect(b.angle).toContain('DRAM prices up 40%')
    expect(b.angle).toContain('Hacker News (900 points) https://x.example')
  })
})
