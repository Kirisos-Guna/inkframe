// "Find the best style": searches YouTube for videos like this voiceover (same topic, same language), keeps the ones
// that really perform, and learns their look as a new style. The look only: learn.ts never copies characters, logos,
// footage or text.
import type { LearnSession } from '../../shared/types'
import { extractJson, runAgent } from './agent'
import { getProject, getSettings, libDir } from './store'
import { run } from './media'
import { ensureYtDlp } from './recreate'
import { startLearn } from './learn'
import { LANGUAGE_NAMES } from './transcribe'

export interface Candidate {
  id: string
  title: string
  channel: string
  views: number
  duration: number
}

/** Explainer-sized videos only, one per id, best known first. Pure, so it can be tested. */
export function rankCandidates(all: Candidate[]) {
  const seen = new Set<string>()
  return all
    .filter((c) => c.id && c.duration >= 120 && c.duration <= 40 * 60 && !seen.has(c.id) && seen.add(c.id))
    .sort((a, b) => b.views - a.views)
}

/** The videos to learn from: the writer's picks, at most one per channel, or the most watched if it picked none. */
export function choosePicks(ranked: Candidate[], picks: string[], n = 4) {
  const chosen = [...picks.map((id) => ranked.find((c) => c.id === id)).filter(Boolean), ...(picks.length ? [] : ranked)] as Candidate[]
  const channels = new Set<string>()
  return chosen.filter((c) => !channels.has(c.channel) && channels.add(c.channel)).slice(0, n)
}

/** Searches, picks the videos, and starts learning; the result follows as a learning session. */
export async function scoutStyle(id: string, onStatus: (s: string) => void): Promise<LearnSession> {
  const p = getProject(id)
  if (!p) throw new Error('No such video')
  const said = p.words.map((w) => w.w).join(' ').slice(0, 1800)
  if (!said && !p.direction) throw new Error('Wait until the voiceover has been heard.')
  const language = LANGUAGE_NAMES[p.language ?? ''] ?? (p.language && p.language !== 'en' ? p.language : 'English')
  const s = getSettings()
  // Small jobs: a quick model is plenty.
  const quick = p.settings.provider === 'Codex' ? { provider: 'Codex' as const, model: p.settings.model } : { provider: 'Claude Code' as const, model: 'Haiku 5.5' }
  const cwd = libDir('writing')

  onStatus('Working out what to search for')
  const plan = extractJson<{ topic: string; queries: string[] }>(
    await runAgent({
      ...quick,
      effort: 'Low',
      cwd,
      prompt: `This is the start of a voiceover in ${language} (from speech recognition, so it can have mistakes). The file is called "${p.voiceover?.name ?? ''}".
"""
${said}
"""
${p.direction ? `The creator's direction: ${p.direction}\n` : ''}
Write 3 YouTube searches to find the most popular animated explainer videos on this subject in ${language}, the way
people there really search (for Tamil: mix Tamil words and English tech terms, and include "tamil").

Reply with JSON only: {"topic": "the subject in 2-5 English words", "queries": ["...", "...", "..."]}`
    })
  )

  onStatus('Searching YouTube')
  const yt = await ensureYtDlp(onStatus)
  const found: Candidate[] = []
  for (const q of (plan.queries ?? []).slice(0, 3)) {
    const r = await run(yt, ['--no-warnings', '--flat-playlist', '-J', `ytsearch15:${q}`])
    try {
      const j = JSON.parse(r.stdout.toString()) as { entries?: { id: string; title?: string; channel?: string; uploader?: string; view_count?: number; duration?: number }[] }
      for (const e of j.entries ?? []) found.push({ id: e.id, title: e.title ?? '', channel: e.channel ?? e.uploader ?? '', views: e.view_count ?? 0, duration: e.duration ?? 0 })
    } catch {
      /* one search failing is fine: the others still count */
    }
  }
  const ranked = rankCandidates(found).slice(0, 30)
  if (!ranked.length) throw new Error('YouTube gave no results for this topic. Try again, or pick a style yourself.')

  onStatus(`Choosing from ${ranked.length} videos`)
  let picks: string[] = []
  try {
    picks = extractJson<{ picks: string[] }>(
      await runAgent({
        ...quick,
        effort: 'Low',
        cwd,
        prompt: `A creator is making an animated explainer about "${plan.topic}" in ${language}. These are YouTube results (views · length · channel · title):
${ranked.map((c) => `${c.id} · ${c.views.toLocaleString('en')} views · ${Math.round(c.duration / 60)} min · ${c.channel} · ${c.title}`).join('\n')}

Pick the 4 best to learn a visual style from: really about this subject or close to it, popular, and likely animated or
illustrated explainers (not news clips, talking heads, screen recordings or lectures). Different channels.

Reply with JSON only: {"picks": ["id", "id", "id", "id"]}`
      })
    ).picks ?? []
  } catch {
    /* the most watched will do */
  }
  const chosen = choosePicks(ranked, picks)

  onStatus(`Learning the look of ${chosen.length} popular videos`)
  return startLearn({
    name: `${plan.topic || 'Popular'} look`.slice(0, 40),
    source: `Best of YouTube: ${chosen.map((c) => c.channel).join(', ')}`,
    urls: chosen.map((c) => `https://www.youtube.com/watch?v=${c.id}`),
    skipTest: true,
    mode: 'Look + pacing',
    provider: p.settings.provider === 'Codex' ? 'Codex' : s.defaultProvider,
    model: p.settings.provider === 'Codex' ? p.settings.model : 'Sonnet 5.5',
    effort: 'Medium'
  })
}
