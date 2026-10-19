// Writing (script, titles + description, captions) and thumbnails.
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { Project, PublishKit, Thumbnail } from '../../shared/types'
import { getProject, getSettings, getStyle, libDir, listCharacters } from './store'
import { extractJson, runAgent } from './agent'
import { codexPath } from './tools'
import { bundleProject, checkScene, stillScene } from './render'
import { linesFromWords, type Line } from './captions'
import { emit } from './pipeline'

/** Writing goes to Codex by default (when it is installed), otherwise to Claude Code. */
async function writer() {
  const s = getSettings()
  const want = s.writerProvider ?? 'Codex'
  const provider = want === 'Codex' && !(await codexPath()) ? 'Claude Code' : want
  const model = provider === 'Codex' ? s.writerModel ?? 'Codex default' : s.defaultProvider === 'Claude Code' ? s.defaultModel : 'Sonnet 5.5'
  return { provider, model } as const
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

// ---------- script ----------
export interface ScriptRequest {
  topic: string
  angle?: string
  minutes: number
  platform: 'YouTube' | 'YouTube Shorts' | 'Instagram Reels' | 'TikTok'
  tone: string
  research: boolean
}

export async function writeScript(r: ScriptRequest) {
  const w = await writer()
  const words = Math.round(r.minutes * 150)
  const reply = await runAgent({
    ...w,
    effort: 'High',
    cwd: libDir('writing'),
    search: r.research && w.provider === 'Codex',
    prompt: `You write voiceover scripts for faceless explainer videos that are drawn as the voiceover plays.
${r.research ? 'First research the topic on the web: find the facts, numbers and recent developments a curious beginner would want, and note your sources.' : 'Use what you know; do not invent numbers or quotes.'}

Topic: ${r.topic}
${r.angle ? `Angle / notes: ${r.angle}\n` : ''}Platform: ${r.platform}
Length: about ${r.minutes} minute${r.minutes === 1 ? '' : 's'} (~${words} words spoken)
Tone: ${r.tone}

How a good script for this format works:
- Open on the question the viewer already has, and start answering it in the first sentence. No "in this video".
- Explain the whole thing for someone who knows nothing about it, step by step, so a drawing can build it up on screen as each idea is said.
- Short spoken sentences. Concrete images ("a building full of rows and rows of servers"), not abstractions.
- Every 20–30 seconds, a small turn or reveal that keeps people watching.
- End on the one sentence the viewer should remember${r.platform === 'YouTube' ? ', then point to a related next video in one line' : ''}.
- Plain text only: no headings, no stage directions, no emojis. Write numbers the way they should be read aloud.

Reply with JSON only:
{"title": "a curiosity-driven title, at most 60 characters", "script": "the full voiceover script, with blank lines between paragraphs", "sources": ["url or source name", ...]}`
  })
  const out = extractJson<{ title: string; script: string; sources?: string[] }>(reply)
  return { title: out.title ?? '', script: out.script ?? '', sources: out.sources ?? [], by: `${w.provider} · ${w.model}` }
}

// ---------- title, description, tags ----------
export async function writePublishKit(id: string): Promise<Project> {
  const p = getProject(id)!
  const w = await writer()
  const chapters = p.parts.map((x) => `${fmt(x.start)} ${x.title}`).join('\n')
  const transcript = p.words.map((x) => x.w).join(' ') || p.script || p.parts.map((x) => x.text).join(' ')
  const reply = await runAgent({
    ...w,
    effort: 'Medium',
    cwd: p.dir,
    prompt: `Write the YouTube upload text for this explainer video.

Video title so far: ${p.title}
Kind: ${p.settings.kind}. Style: ${getStyle(p.settings.styleId).name}. Length: ${fmt(p.voiceover?.duration ?? 0)}.
Transcript:
"""
${transcript.slice(0, 12000)}
"""
Parts (use them as chapters, keep the times exactly, first must be 0:00; merge neighbours so there are 4–12 chapters with short clear names):
${chapters}

Write:
- 5 title options, each under 60 characters. Curiosity first: promise something the viewer does not know yet. No clickbait lies, no ALL CAPS words except acronyms.
- A description: 2 short paragraphs that hook and summarise, then "Chapters" with the timestamps, then 3–5 hashtags on the last line.
- 15 tags (short phrases people search for).

Reply with JSON only: {"titles": [...], "description": "...", "tags": [...], "hashtags": ["#...", ...]}`
  })
  const k = extractJson<Omit<PublishKit, 'at'>>(reply)
  p.publish = { titles: k.titles ?? [], description: k.description ?? '', tags: k.tags ?? [], hashtags: k.hashtags ?? [], at: Date.now() }
  emit(p, true)
  return p
}

// ---------- captions ----------
/** Caption lines from the heard words, with spelling and punctuation fixed by the writer (times are kept). */
export async function writeCaptions(id: string, tidy = true): Promise<Project> {
  const p = getProject(id)!
  let lines: Line[] = linesFromWords(p.words)
  if (!lines.length) throw new Error('The voiceover has no heard words yet.')
  if (tidy) {
    const w = await writer()
    const reply = await runAgent({
      ...w,
      effort: 'Low',
      cwd: p.dir,
      prompt: `These are caption lines from a speech-to-text pass of a voiceover. Fix spelling, capitals and punctuation, and correct misheard words${
        p.script ? ' using the script below (it is what was read aloud)' : ''
      }. Keep the meaning and keep every line: the reply must have exactly ${lines.length} lines, in the same order, each one the corrected text of the same line. Do not merge or split lines.
${p.script ? `\nScript:\n"""\n${p.script.slice(0, 10000)}\n"""\n` : ''}
Lines (JSON):
${JSON.stringify(lines.map((l) => l.text))}

Reply with JSON only: {"lines": ["...", ...]}`
    })
    const fixed = extractJson<{ lines: string[] }>(reply).lines ?? []
    if (fixed.length === lines.length) {
      lines = lines.map((l, i) => {
        const text = String(fixed[i]).trim() || l.text
        // Spread the corrected words over the line's own word timing, so karaoke still follows the voice.
        const tokens = text.split(/\s+/)
        const words = tokens.map((t, k) => {
          const a = l.start + ((l.end - l.start) * k) / tokens.length
          const src = l.words[Math.min(l.words.length - 1, Math.floor((k * l.words.length) / tokens.length))]
          return { w: t, start: tokens.length === l.words.length ? src.start : a, end: tokens.length === l.words.length ? src.end : a + (l.end - l.start) / tokens.length }
        })
        return { ...l, text, words }
      })
    }
  }
  p.captionLines = lines
  emit(p, true)
  return p
}

// ---------- thumbnails ----------
export async function makeThumbnails(id: string, count: number, note?: string, onStatus?: (s: string) => void): Promise<Project> {
  const p = getProject(id)!
  const style = getStyle(p.settings.styleId)
  const chars = listCharacters().filter((c) => p.settings.characterIds.includes(c.id))
  mkdirSync(join(p.dir, 'scenes'), { recursive: true })
  const made: Thumbnail[] = []
  for (let i = 0; i < count; i++) {
    const tid = 'thumb-' + randomUUID().slice(0, 8)
    const file = `scenes/${tid}.tsx`
    onStatus?.(`Designing thumbnail ${i + 1} of ${count}`)
    const prompt = `First read METHOD.md (the scene kit) and STYLE.md (the look of this video).

Design a YouTube thumbnail for this video as a single still, using the kit, in the video's style.
Title: ${p.publish?.titles[0] ?? p.title}
What the video is about: ${(p.words.map((w) => w.w).join(' ') || p.direction).slice(0, 1500)}
Parts: ${p.parts.map((x) => x.title).join(' · ')}
${chars.length ? `Characters you may use: ${chars.map((c) => c.name).join(', ')}\n` : ''}${note ? `The creator asked for: ${note}\n` : ''}${i > 0 ? `This is variant ${i + 1}: take a clearly different idea from the earlier variants.\n` : ''}
What makes a thumbnail get clicked:
- ONE subject that glows or pops (use the accent colour and a soft glow), big and slightly off-centre.
- 2 to 4 huge words (150–260 px, heavy weight, high contrast), never the full title. Leave the bottom-right corner empty (the video length badge sits there).
- Understandable in half a second at phone size: no small text, no clutter, strong contrast with the background.
- It must create curiosity: show the surprising part, or a question.
The scene is rendered as one still at its last frame: make everything finish appearing by frame 15 (start everything at frame 0 with short durations).

Write the scene to ${file}. Do not create or change any other file.`
    await runAgent({ provider: p.settings.provider, model: p.settings.model, effort: p.settings.effort, cwd: p.dir, prompt, tools: true })
    const abs = join(p.dir, file)
    if (!existsSync(abs)) throw new Error('The thumbnail scene was not written')
    let err = await checkScene(abs)
    for (let tries = 0; err && tries < 2; tries++) {
      onStatus?.('Repairing the thumbnail')
      await runAgent({ provider: p.settings.provider, model: p.settings.model, effort: p.settings.effort, cwd: p.dir, tools: true, prompt: `The thumbnail scene ${file} does not build:\n${err}\nFix it. Reply with one sentence.` })
      err = await checkScene(abs)
    }
    onStatus?.('Drawing the thumbnail')
    const url = await bundleProject(p)
    const out = join(p.dir, 'thumbs', `${tid}.png`)
    await stillScene(p, url, tid, out, { width: 1280, height: 720, frames: 20 })
    made.push({ id: tid, file: out, scene: abs, note: note ?? '', at: Date.now() })
  }
  p.thumbnails = [...made, ...(p.thumbnails ?? [])]
  emit(p, true)
  return p
}

