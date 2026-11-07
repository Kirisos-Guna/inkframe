// The research step of the remix styles: the writer (Codex by default, with web search) plans the real media for
// every part in one session, then each piece is fetched on this computer (realMedia.ts, no tokens).
import type { MediaItem, Part, Project, Shot } from '../../../shared/types'
import { extractJson, runAgent } from '../agent'
import { getSettings, libDir } from '../store'
import { writer } from '../publish'
import { fetchShot, linksIn, memeTemplates } from '../realMedia'
import { emit, step } from './events'
import { limiter } from './util'

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function mediaPlanPrompt(p: Project, parts: Part[], memes: string[], links: { link: string; from: string; to: string }[], stock: boolean, quotes = false) {
  return `You are the researcher for a fast, Fireship-style tech video made of REAL media: screenshots of real pages,
real posts, real photos, memes, charts, code and clips, a new picture every 1.5 to 2.5 seconds. Plan the shots for every part.

${p.direction ? `The creator's direction: ${p.direction}\n` : ''}The parts (number, time, what is said):
${parts.map((x) => `${x.index + 1}. [${fmt(x.start)}-${fmt(x.end)}, ${(x.end - x.start).toFixed(0)} s] ${x.text.slice(0, 300)}`).join('\n')}

Search the web for what each part talks about and pick its shots, in the order they are seen. About one shot per 2
seconds of the part (a punchline may get two quick ones). Kinds:
- {"kind":"page","url":"https://…","mark":"a sentence copied EXACTLY from that page, to highlight","why":"…"}
  Real primary sources: official docs, the company's own blog or press release, a reputable news article, the GitHub
  repo or README, a filing, a changelog, a pricing page, a Hacker News thread, an old.reddit.com thread. Only URLs you
  opened in your search and that load without a login. The mark is the one sentence that proves what the voice says.
  Optional: "mark2" a second sentence (highlighted yellow); "scroll": true for a long document (a filing, a spec) the
  shot scrolls down to reach the sentence.
- {"kind":"doccode","url":"https://docs…","contains":"a few words of the example","file":"app.ts"}: the real code
  example from an official docs page, shown in an editor (better than writing code when the docs have it).
- {"kind":"tweet","url":"https://x.com/<user>/status/<id>","why":"…"}: a real post you found, from the person or company.
- {"kind":"photo","query":"Jensen Huang","cutout":true}: a real photo of a person, product, building or logo (searched on
  Wikimedia Commons, free licences). Use a name, not a description. "cutout": true lifts the person or logo out of
  its background, for a sticker with a label (do this for the people the story is about, and for logos).
- {"kind":"meme","template":"<one name from the list below>","top":"…","bottom":"…"}: a reaction at the funny or
  ironic beat. Captions short, dry and sharp, in capitals, like Fireship.
- {"kind":"chart","source":"price","symbol":"NVDA","range":"1y","label":"Nvidia stock"}: a real chart of a stock price
  (range 1mo, 6mo, 1y, 2y or 5y), {"kind":"chart","source":"npm","package":"react"} for weekly downloads, or
  {"kind":"chart","source":"github","repo":"owner/name"} for its stars, forks and issues. Use them when the voice
  says a number that a chart proves.
- {"kind":"code","lang":"ts","file":"index.ts","code":"…","why":"…"}: when the part explains code, a command or a
  config: real, correct, minimal code (at most 14 lines) that does what is said.${stock ? '\n- {"kind":"stock","query":"gpu fans close up"}: a short real stock clip for B-roll (2-4 words).' : ''}${
    quotes
      ? '\n- {"kind":"quote","who":"Linus Torvalds","says":"the exact words, 5 to 15 of them","query":"Linus Torvalds talk nvidia"}: a\n  3 to 6 second clip of a real person saying a line they are famous for, or that the part is about (a keynote, an\n  interview, a talk). Only words you know they said on video. Put the event or the official channel in the query\n  ("Steve Jobs Stanford commencement"). At most 2 in the whole video.'
      : ''
  }${
    links.length
      ? `\n- {"kind":"clip","link":"…","from":"m:ss","to":"m:ss"}: the creator gave these clips; put each in the part it fits:\n${links.map((l) => `  ${l.link} ${l.from}-${l.to}`).join('\n')}`
      : ''
  }

Mix kinds through the video; never three of the same kind in a row. Diagrams and titles are drawn later by the
animator; do not plan them.
Meme templates you can use: ${memes.slice(0, 100).join(' | ')}

Reply with JSON only: {"parts": [{"part": 1, "shots": [ … ]}, …]}`
}

/**
 * Plans and fetches real media for the parts that have none yet. Parts keep what they got: a part whose shots could
 * not be fetched is drawn without them.
 */
const plans = new Map<string, { key: string; plan: { parts: { part: number; shots: Shot[] }[] } }>()

export async function gatherMedia(p: Project, signal: AbortSignal) {
  const parts = p.parts.filter((x) => !p.media?.[x.id])
  if (!parts.length) return
  const s = getSettings()
  const key = parts.map((x) => `${x.id}:${x.start.toFixed(2)}`).join(',')
  const cached = plans.get(p.id)
  const plan = cached?.key === key ? cached.plan : await research(p, parts, signal)
  plans.set(p.id, { key, plan })
  await fetchAll(p, parts, plan, s, signal)
  plans.delete(p.id)
}

async function research(p: Project, parts: Part[], signal: AbortSignal) {
  const s = getSettings()
  const { provider, model } = await writer()
  const memes = await memeTemplates()
    .then((m) => m.map((x) => x.name))
    .catch(() => [] as string[])
  const links = linksIn(p.direction ?? '')
  step(p, 'Researching real media', { title: 'Researching real media', detail: `${provider} searches the web for the pages, posts, photos and code each part shows.` })
  const reply = await runAgent({
    provider,
    model,
    effort: 'Medium',
    cwd: libDir('writing'),
    search: true,
    signal,
    prompt: mediaPlanPrompt(p, parts, memes, links, !!(s.pexelsKey || s.pixabayKey), !!s.quoteClips)
  })
  return extractJson<{ parts: { part: number; shots: Shot[] }[] }>(reply)
}

async function fetchAll(p: Project, parts: Part[], plan: { parts: { part: number; shots: Shot[] }[] }, s: ReturnType<typeof getSettings>, signal: AbortSignal) {
  const jobs: { x: Part; shot: Shot; i: number }[] = []
  for (const x of parts) {
    const shots = (plan.parts?.find((y) => Number(y.part) === x.index + 1)?.shots ?? []).slice(0, 8)
    shots.forEach((shot, i) => jobs.push({ x, shot, i }))
  }
  step(p, `Getting ${jobs.length} pieces of real media`, { detail: 'Screenshots in a real browser, posts, photos, memes and clips. No AI in this step.' })
  const got = new Map<string, (MediaItem | null)[]>()
  let done = 0
  const slot = limiter(3)
  await Promise.all(
    jobs.map(({ x, shot, i }) =>
      slot(async () => {
        if (signal.aborted) return
        const m = await fetchShot(shot, p.dir, `p${x.index + 1}-${i + 1}-${x.id.slice(0, 6)}`, { pexels: s.pexelsKey, pixabay: s.pixabayKey, quotes: !!s.quoteClips })
        const list = got.get(x.id) ?? []
        list[i] = m
        got.set(x.id, list)
        step(p, `Getting real media · ${Math.round((++done / jobs.length) * 100)}%`)
      })
    )
  )
  if (signal.aborted) throw new Error('Stopped')
  p.media = { ...(p.media ?? {}) }
  for (const x of parts) p.media[x.id] = (got.get(x.id) ?? []).filter((m): m is MediaItem => !!m)
  emit(p, true)
}

/** Every licence credit in the video, once each, for the description. */
export function mediaCredits(p: Project) {
  const all = p.parts.flatMap((x) => p.media?.[x.id] ?? [])
  return [...new Set(all.map((m) => m.credit).filter((c): c is string => !!c && !c.startsWith('Screenshot of') && !c.startsWith('Post by')))]
}
