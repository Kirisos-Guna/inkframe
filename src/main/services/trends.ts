// Viral idea finder: what tech people are talking about right now, gathered from the public sources that can be read
// without an account (Hacker News, Reddit, GitHub trending, YouTube's most viewed this week, Lobsters, dev.to,
// Techmeme, Google News), with their numbers. Gathering uses no AI. Then the writer, with web search, checks the
// leads (including what X, Instagram and TikTok say about them) and ranks the three best video ideas.
import type { TrendIdea, TrendRequest, TrendSignal } from '../../shared/types'
import { extractJson, runAgent } from './agent'
import { libDir } from './store'
import { run } from './media'
import { ensureYtDlp } from './recreate'
import { channelVoice, writer } from './publish'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

async function get(url: string) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) })
  if (!r.ok) throw new Error(`${r.status} from ${new URL(url).host}`)
  return r.text()
}

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/<[^>]+>/g, '')
    .trim()

/** The items of an RSS or Atom feed: title and link. */
export function readFeed(xml: string) {
  const out: { title: string; url: string }[] = []
  for (const m of xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/g)) {
    const title = decode(m[0].match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? '')
    const url = decode(m[0].match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? m[0].match(/<link[^>]*href="([^"]+)"/)?.[1] ?? '')
    if (title) out.push({ title, url })
  }
  return out
}

/** GitHub's trending page: repo, description and the stars it got this week. */
export function readGitHubTrending(html: string) {
  const out: TrendSignal[] = []
  for (const m of html.matchAll(/<article class="Box-row">([\s\S]*?)<\/article>/g)) {
    const repo = m[1].match(/<h2[^>]*>\s*<a[^>]*href="\/([^"]+)"/)?.[1]
    if (!repo) continue
    const about = decode(m[1].match(/<p class="col-9[^"]*">([\s\S]*?)<\/p>/)?.[1] ?? '')
    const stars = m[1].match(/([\d,]+) stars this week/)?.[1]
    out.push({ source: 'GitHub trending', title: `${repo}${about ? `: ${about}` : ''}`, url: `https://github.com/${repo}`, metric: stars ? `${stars} stars this week` : undefined })
  }
  return out
}

const SUBREDDITS = ['technology', 'programming', 'webdev', 'MachineLearning', 'LocalLLaMA', 'artificial', 'OpenAI', 'ClaudeAI', 'singularity', 'linux', 'cybersecurity', 'gadgets', 'Futurology', 'ExperiencedDevs', 'learnprogramming']
const YT_QUERIES = ['tech news', 'AI news', 'programming', 'software engineer', 'new AI model']

type Source = { name: string; fetch: () => Promise<TrendSignal[]> }

function sources(days: number, onStatus: (s: string) => void): Source[] {
  const since = Math.floor(Date.now() / 1000) - days * 86400
  const t = days <= 1 ? 'day' : 'week'
  return [
    {
      name: 'Hacker News',
      fetch: async () => {
        const j = JSON.parse(await get(`https://hn.algolia.com/api/v1/search?tags=story&numericFilters=created_at_i>${since},points>80&hitsPerPage=40`)) as {
          hits: { title: string; url?: string; points: number; num_comments: number; objectID: string }[]
        }
        return j.hits
          .sort((a, b) => b.points - a.points)
          .map((h) => ({ source: 'Hacker News', title: h.title, url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, metric: `${h.points} points, ${h.num_comments} comments` }))
      }
    },
    {
      name: 'Reddit',
      // Reddit's JSON needs an account now; its feeds still list the top posts in order.
      fetch: async () =>
        readFeed(await get(`https://www.reddit.com/r/${SUBREDDITS.join('+')}/top/.rss?t=${t}&limit=40`)).map((x, i) => ({
          source: `Reddit (${x.url.match(/\/r\/([^/]+)/)?.[1] ? `r/${x.url.match(/\/r\/([^/]+)/)![1]}` : 'tech'})`,
          title: x.title,
          url: x.url,
          metric: `#${i + 1} of the ${t} across tech subreddits`
        }))
    },
    { name: 'GitHub', fetch: async () => readGitHubTrending(await get(`https://github.com/trending?since=${days <= 1 ? 'daily' : 'weekly'}`)) },
    {
      name: 'YouTube',
      fetch: async () => {
        const yt = await ensureYtDlp(onStatus)
        // Search results for the week (or today), most viewed first.
        const sp = days <= 1 ? 'CAMSAggC' : 'CAMSAggD'
        const lists = await Promise.all(
          YT_QUERIES.map((q) =>
            run(yt, ['--flat-playlist', '--no-warnings', '--playlist-end', '10', '--print', '%(view_count)s|%(channel)s|%(id)s|%(title)s', `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=${sp}`])
              .then((r) => r.stdout.toString().split(/\r?\n/).filter(Boolean))
              .catch(() => [] as string[])
          )
        )
        const seen = new Set<string>()
        return lists
          .flat()
          .map((l) => l.split('|'))
          .filter(([, , id]) => id && !seen.has(id) && seen.add(id))
          .map(([views, channel, id, ...title]) => ({ source: 'YouTube', title: `${title.join('|')} (${channel})`, url: `https://www.youtube.com/watch?v=${id}`, metric: `${Number(views).toLocaleString('en')} views`, n: Number(views) || 0 }))
          .sort((a, b) => b.n - a.n)
          .slice(0, 25)
          .map(({ n: _n, ...s }) => s)
      }
    },
    {
      name: 'Lobsters',
      fetch: async () =>
        (JSON.parse(await get('https://lobste.rs/hottest.json')) as { title: string; url: string; short_id_url: string; score: number; comment_count: number }[]).slice(0, 20).map((x) => ({
          source: 'Lobsters',
          title: x.title,
          url: x.url || x.short_id_url,
          metric: `${x.score} points, ${x.comment_count} comments`
        }))
    },
    {
      name: 'dev.to',
      fetch: async () =>
        (JSON.parse(await get(`https://dev.to/api/articles?top=${Math.max(1, days)}&per_page=20`)) as { title: string; url: string; public_reactions_count: number; comments_count: number }[]).map((x) => ({
          source: 'dev.to',
          title: x.title,
          url: x.url,
          metric: `${x.public_reactions_count} reactions, ${x.comments_count} comments`
        }))
    },
    { name: 'Techmeme', fetch: async () => readFeed(await get('https://www.techmeme.com/feed.xml')).slice(0, 25).map((x) => ({ source: 'Techmeme', title: x.title, url: x.url, metric: 'Techmeme front page' })) },
    {
      name: 'Google News',
      fetch: async () =>
        readFeed(await get('https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-US&gl=US&ceid=US:en'))
          .slice(0, 30)
          .map((x) => ({ source: 'Google News', title: x.title, url: x.url, metric: 'top technology story' }))
    }
  ]
}

/** Everything trending, from every source that answers (one that fails is skipped and named). */
export async function gatherSignals(days: number, onStatus: (s: string) => void) {
  const list = sources(days, onStatus)
  const failed: string[] = []
  let done = 0
  onStatus(`Reading ${list.map((s) => s.name).join(', ')}`)
  const got = await Promise.all(
    list.map((s) =>
      s
        .fetch()
        .catch((e) => {
          failed.push(s.name)
          console.warn(`Trends: ${s.name} skipped:`, (e as Error).message)
          return [] as TrendSignal[]
        })
        .finally(() => onStatus(`Reading the sources · ${++done} of ${list.length}`))
    )
  )
  return { signals: got.flat(), failed, read: list.map((s) => s.name).filter((n) => !failed.includes(n)) }
}

export function trendPrompt(r: TrendRequest, signals: TrendSignal[], search: boolean) {
  return `You find the next viral video for a tech YouTube channel (faceless explainers, about ${r.minutes ?? 10} minutes, for a broad
audience of developers and tech-curious people).

What is trending ${r.days <= 1 ? 'today' : 'this week'}, read just now from the sources (source · numbers · title · link):
${signals.map((s) => `- ${s.source}${s.metric ? ` · ${s.metric}` : ''} · ${s.title} · ${s.url}`).join('\n')}
${r.focus ? `\nThe creator wants ideas about: ${r.focus}\n` : ''}${channelVoice()}
1. Group the items that are the same story or the same underlying idea across sources. A story that trends on several
   sources at once, with big numbers, is the strongest signal.
2. ${
    search
      ? 'Search the web to check the strongest 6 to 8 candidates: what actually happened, the key facts and numbers, and how big\n   the conversation is on X, Instagram, TikTok, YouTube and in the news. Drop anything you cannot confirm.'
      : 'Judge the strongest 6 to 8 candidates from the items alone; use only what the items say.'
  }
3. Rank the 3 best VIDEO IDEAS (not just headlines). A great idea: many people care right now; it has a surprising
   question or twist that makes a strong title and thumbnail; it can be explained with a real concept underneath
   (so the video teaches something and stays useful after the news fades); and the creator can make it well as an
   explainer. Avoid pure product deals, rumours you could not confirm, tragedies and politics.

Reply with JSON only:
{"ideas": [{
  "title": "a curiosity-driven video title, at most 60 characters",
  "hook": "the opening line of the video, one or two sentences",
  "why": "why this will spread now: the numbers and where it is trending, 1-2 sentences",
  "concept": "the real idea the video teaches underneath the news",
  "angle": "how to tell it: the question, the beats, who it is for (2-4 sentences)",
  "facts": ["key facts and numbers to use, each one checked", ...],
  "score": 0-100,
  "evidence": [{"source": "Hacker News", "metric": "812 points", "url": "https://…"}, ...]
}, … 3 ideas, best first]}`
}

/** Finds and ranks the 3 best viral video ideas right now. */
export async function findTrendingIdeas(r: TrendRequest, onStatus: (s: string) => void): Promise<{ ideas: TrendIdea[]; read: string[]; failed: string[]; by: string }> {
  const { signals, failed, read } = await gatherSignals(r.days, onStatus)
  if (signals.length < 5) throw new Error('Could not read enough trending sources right now. Check the internet connection and try again.')
  const w = await writer()
  onStatus(`${w.provider} is checking ${signals.length} trending items on the web and ranking the best 3`)
  const reply = await runAgent({ ...w, effort: 'High', cwd: libDir('writing'), search: true, prompt: trendPrompt(r, signals, true) })
  const got = extractJson<{ ideas?: TrendIdea[] }>(reply)
  const ideas = (got.ideas ?? [])
    .filter((i) => i?.title)
    .slice(0, 3)
    .map((i) => ({ ...i, facts: Array.isArray(i.facts) ? i.facts.map(String) : [], evidence: Array.isArray(i.evidence) ? i.evidence.filter((e) => e?.url) : [] }))
  if (!ideas.length) throw new Error('The writer did not return any ideas. Try again.')
  return { ideas, read, failed, by: `${w.provider} · ${w.model}` }
}
