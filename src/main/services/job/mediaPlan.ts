// The research step of the remix styles: the writer (Codex by default, with web search) plans the real media for
// every part in one session, then each piece is fetched on this computer (realMedia.ts, no tokens).
import type { MediaItem, Part, Project, Shot } from '../../../shared/types'
import { extractJson, runAgent } from '../agent'
import { getSettings, libDir } from '../store'
import { codexPath } from '../tools'
import { fetchShot, linksIn, memeTemplates } from '../realMedia'
import { emit, step } from './events'
import { limiter } from './util'

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function mediaPlanPrompt(p: Project, parts: Part[], memes: string[], links: { link: string; from: string; to: string }[], stock: boolean) {
  return `You are the researcher for a fast, Fireship-style tech video made of REAL media: screenshots of real pages,
real posts, real photos, memes, code and clips, a new picture every 2 to 4 seconds. Plan the shots for every part.

${p.direction ? `The creator's direction: ${p.direction}\n` : ''}The parts (number, time, what is said):
${parts.map((x) => `${x.index + 1}. [${fmt(x.start)}-${fmt(x.end)}, ${(x.end - x.start).toFixed(0)} s] ${x.text.slice(0, 300)}`).join('\n')}

Search the web for what each part talks about and pick its shots, in the order they are seen. About one shot per 3
seconds of the part. Kinds:
- {"kind":"page","url":"https://…","mark":"a sentence copied EXACTLY from that page, to highlight","why":"…"}
  Real primary sources: official docs, the company's own blog or press release, a reputable news article, the GitHub
  repo or README, a filing, a changelog, a pricing page. Only URLs you opened in your search and that load without a
  login. The mark is the one sentence that proves what the voice says.
- {"kind":"tweet","url":"https://x.com/<user>/status/<id>","why":"…"}: a real post you found, from the person or company.
- {"kind":"photo","query":"Jensen Huang"}: a real photo of a person, product, building or logo (searched on Wikimedia
  Commons, free licences). Use a name, not a description.
- {"kind":"meme","template":"<one name from the list below>","top":"…","bottom":"…"}: a reaction at the funny or
  ironic beat. Captions short, dry and sharp, in capitals, like Fireship.
- {"kind":"code","lang":"ts","file":"index.ts","code":"…","why":"…"}: when the part explains code, a command or a
  config: real, correct, minimal code (at most 14 lines) that does what is said.${stock ? '\n- {"kind":"stock","query":"gpu fans close up"}: a short real stock clip for B-roll (2-4 words).' : ''}${
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
export async function gatherMedia(p: Project, signal: AbortSignal) {
  const parts = p.parts.filter((x) => !p.media?.[x.id])
  if (!parts.length) return
  const s = getSettings()
  const codex = !!(await codexPath())
  const provider = (s.writerProvider ?? 'Codex') === 'Codex' && codex ? ('Codex' as const) : ('Claude Code' as const)
  const model = provider === 'Codex' ? (s.writerModel ?? 'Codex default') : 'Sonnet 5.5'
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
    prompt: mediaPlanPrompt(p, parts, memes, links, !!(s.pexelsKey || s.pixabayKey))
  })
  const plan = extractJson<{ parts: { part: number; shots: Shot[] }[] }>(reply)
  const jobs: { x: Part; shot: Shot; i: number }[] = []
  for (const x of parts) {
    const shots = (plan.parts?.find((y) => Number(y.part) === x.index + 1)?.shots ?? []).slice(0, 6)
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
        const m = await fetchShot(shot, p.dir, `p${x.index + 1}-${i + 1}-${x.id.slice(0, 6)}`, { pexels: s.pexelsKey, pixabay: s.pixabayKey })
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
  const all = Object.values(p.media ?? {}).flat()
  return [...new Set(all.map((m) => m.credit).filter((c): c is string => !!c && !c.startsWith('Screenshot of') && !c.startsWith('Post by')))]
}
