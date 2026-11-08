// The research step of the remix styles: the writer (Codex by default, with web search) plans the real media for
// every part in one session, then each piece is fetched on this computer (realMedia.ts, no tokens).
import type { MediaItem, Part, Project, Shot } from '../../../shared/types'
import { extractJson, runAgent } from '../agent'
import { getSettings, libDir } from '../store'
import { writer } from '../publish'
import { fetchShot, linksIn } from '../realMedia'
import { memeMenu } from '../../../shared/memes'
import { emit, step } from './events'
import { limiter } from './util'

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function mediaPlanPrompt(p: Project, parts: Part[], links: { link: string; from: string; to: string }[], stock: boolean, quotes = false, gifs = false) {
  return `You are the researcher for a fast, Fireship-style tech video made of REAL media: screenshots of real pages,
real posts, real photos, charts, code, clips, and now and then a reaction (a meme or GIF). Plan the shots for every part.

The video teaches a real concept, so almost every shot is a REFERENCE that shows or proves what is said: the
official docs or spec (MDN, RFCs, the language reference, the vendor's docs), the real source code or README on
GitHub, the engineering blog post or postmortem where it happened, the real post, a real chart, a real photo of the
thing. Prefer the most authoritative source you can open, and highlight the exact sentence that backs the line.
Every shot must show exactly what is said at that moment of its part: the thing named, the claim with the sentence
that proves it, the person who is speaking about. Nothing merely nearby (a building for a team, a logo for a topic,
a stock photo for an idea): if no real source shows the line, plan no shot there and the animator draws it.
Use MANY different sources: one page or post at most twice in the whole video (with a different sentence each time),
never twice in one part; the same photo once. When the story rests on one source, show the others that report or
answer it (the paper, the code, the replies, the news, the docs of what it uses).
Reactions are seasoning, not the meal: at most ${reactionCap(parts)} memes and GIFs in the whole video together, only on
the 2 or 3 beats that are really funny or ironic, never two in the same part.

${p.direction ? `The creator's direction: ${p.direction}\n` : ''}The parts (number, time, what is said):
${parts.map((x) => `${x.index + 1}. [${fmt(x.start)}-${fmt(x.end)}, ${(x.end - x.start).toFixed(0)} s] ${x.text.slice(0, 300)}`).join('\n')}

Search the web for what each part talks about and pick its shots, in the order they are seen. The viewer must be able
to READ every shot, so plan how long each one needs on screen and fit the part: a photo 1.5-2 s, a meme 3 s, a page
with its highlighted sentence 3 s, code 4-6 s. That is about one shot per 3 seconds of the part; a 9 second part has
3 shots, not 6. Fewer, better shots beat many flashes. Kinds:
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
  Wikimedia Commons, free licences). Use the exact name ("Qwen logo", "Simon Willison"), not a description: a
  picture whose file name does not carry that name is not used. "cutout": true lifts the person or logo out of
  its background, for a sticker with a label (do this for the people the story is about, and for logos).
- {"kind":"meme","template":"<one name from the list below>","texts":["…","…"]}: a reaction at the funny or ironic
  beat. One caption per box of the template, in the order listed (what each box means is given): Drake's two texts
  go in his two white panels, Gru's four on his four boards. Each caption 2 to 6 words, dry and sharp, readable in a
  second. Only where the joke lands. The (anime) templates suit an anime reaction.${gifs ? `
- {"kind":"gif","query":"2-4 words of the reaction","text":"…"?}: a real reaction GIF (looping) for a beat a still
  meme cannot carry: surprise, panic, celebration. "text" is an optional short caption under it. About half of the
  reactions in the video are ANIME reactions: start their query with "anime" ("anime shocked", "anime facepalm",
  "anime crying", "anime thumbs up", "anime nervous sweat"); the others plain ("mind blown", "slow clap").` : ''}
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
Meme templates you can use (name (when it fits): what each box is):
${memeMenu()}

Reply with JSON only: {"parts": [{"part": 1, "shots": [ … ]}, …]}`
}

/**
 * Plans and fetches real media for the parts that have none yet. Parts keep what they got: a part whose shots could
 * not be fetched is drawn without them.
 */
const plans = new Map<string, { key: string; plan: { parts: { part: number; shots: Shot[] }[] } }>()

/** How many reactions (memes and GIFs together) the video gets: one per 45 seconds, at least one. */
export function reactionCap(parts: Part[]) {
  const secs = parts.reduce((n, x) => n + (x.end - x.start), 0)
  return Math.max(1, Math.floor(secs / 45))
}

/** The plan's shots with reactions over the cap (and a second one in the same part) left out, in order. */
export function capReactions<T extends { kind: string }>(byPart: T[][], cap: number) {
  let used = 0
  return byPart.map((shots) => {
    let here = 0
    return shots.filter((s) => {
      if (s.kind !== 'meme' && s.kind !== 'gif') return true
      if (used >= cap || here >= 1) return false
      used++
      here++
      return true
    })
  })
}

/** What makes two shots "the same reference": the page or post, without its anchor; the photo searched for. */
function sourceKey(s: { kind: string; url?: string; query?: string; template?: string }) {
  if (s.url) return s.url.replace(/#.*$/, '').replace(/\/$/, '').toLowerCase()
  if (s.kind === 'photo' && s.query) return `photo:${s.query.toLowerCase().trim()}`
  return null
}

/**
 * No reference over and over: one page or post at most `perVideo` times in the whole video and once per part, and
 * the same photo once. Shots past that are left out, in order (the designer fills the part with diagrams).
 */
export function capSources<T extends { kind: string; url?: string; query?: string }>(byPart: T[][], perVideo = 2) {
  const used = new Map<string, number>()
  return byPart.map((shots) => {
    const here = new Set<string>()
    return shots.filter((s) => {
      const k = sourceKey(s)
      if (!k) return true
      const n = used.get(k) ?? 0
      if (here.has(k) || n >= (k.startsWith('photo:') ? 1 : perVideo)) return false
      here.add(k)
      used.set(k, n + 1)
      return true
    })
  })
}

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
  const links = linksIn(p.direction ?? '')
  step(p, 'Researching real media', { title: 'Researching real media', detail: `${provider} searches the web for the pages, posts, photos and code each part shows.` })
  const reply = await runAgent({
    provider,
    model,
    effort: 'Medium',
    cwd: libDir('writing'),
    search: true,
    signal,
    prompt: mediaPlanPrompt(p, parts, links, !!(s.pexelsKey || s.pixabayKey), !!s.quoteClips, !!s.giphyKey)
  })
  return extractJson<{ parts: { part: number; shots: Shot[] }[] }>(reply)
}

async function fetchAll(p: Project, parts: Part[], plan: { parts: { part: number; shots: Shot[] }[] }, s: ReturnType<typeof getSettings>, signal: AbortSignal) {
  const jobs: { x: Part; shot: Shot; i: number }[] = []
  // Reactions stay rare: the cap holds even if the plan asked for more.
  const planned = capSources(
    capReactions(
      parts.map((x) => plan.parts?.find((y) => Number(y.part) === x.index + 1)?.shots ?? []),
      reactionCap(p.parts.length ? p.parts : parts)
    )
  )
  parts.forEach((x, k) => {
    // Never more shots than the part has time to show readably (the designer adds diagrams and titles too).
    const room = Math.max(2, Math.ceil((x.end - x.start) / 2.4))
    planned[k].slice(0, room).forEach((shot, i) => jobs.push({ x, shot, i }))
  })
  step(p, `Getting ${jobs.length} pieces of real media`, { detail: 'Screenshots in a real browser, posts, photos, memes and clips. No AI in this step.' })
  const got = new Map<string, (MediaItem | null)[]>()
  let done = 0
  const slot = limiter(3)
  await Promise.all(
    jobs.map(({ x, shot, i }) =>
      slot(async () => {
        if (signal.aborted) return
        const m = await fetchShot(shot, p.dir, `p${x.index + 1}-${i + 1}-${x.id.slice(0, 6)}`, { pexels: s.pexelsKey, pixabay: s.pixabayKey, giphy: s.giphyKey, quotes: !!s.quoteClips })
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
