// Writing (script, titles + description, captions) and thumbnails.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { Project, PublishKit, Thumbnail } from '../../shared/types'
import { getProject, getSettings, getStyle, libDir, listCharacters, styleGuide } from './store'
import { extractJson, runAgent } from './agent'
import { codexPath } from './tools'
import { bundleProject, checkScene, fixSceneImports, methodFile, stillScene, thumbMethodFile } from './render'
import { drawingSystem, styleDoc } from './prompts'
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
// Different concepts for the variants, so "Make 3" gives three real choices (see remotion/THUMBNAILS.md).
const CONCEPTS = ['The glowing object', 'Reaction', 'Big number', 'Before → after / versus', 'Mystery']

export async function makeThumbnails(id: string, count: number, note?: string, onStatus?: (s: string) => void): Promise<Project> {
  const p = getProject(id)!
  const style = getStyle(p.settings.styleId)
  const chars = listCharacters().filter((c) => p.settings.characterIds.includes(c.id))
  mkdirSync(join(p.dir, 'scenes'), { recursive: true })
  copyFileSync(thumbMethodFile(), join(p.dir, 'THUMBNAILS.md'))
  // A few of the video's own frames, so the thumbnail matches what the viewer will see.
  const frames = p.parts
    .filter((x) => x.thumb && existsSync(x.thumb))
    .filter((_, i, a) => a.length <= 4 || i % Math.ceil(a.length / 4) === 0)
    .slice(0, 4)
    .map((x) => `thumbs/${x.id}.png`)
  // Characters make the Reaction concept; without them, skip it.
  const concepts = CONCEPTS.filter((c) => c !== 'Reaction' || chars.length)
  // The same instructions for every thumbnail session, as the cached system prompt.
  const system = `${drawingSystem(readFileSync(methodFile(), 'utf8'), null, styleDoc(style, styleGuide(style.id)))}\n\n---\n\n# How to make the thumbnail\n\n${readFileSync(thumbMethodFile(), 'utf8')}`
  const draw = { provider: p.settings.provider, model: p.settings.model, effort: p.settings.effort, cwd: p.dir, tools: true, system }
  const made: Thumbnail[] = []
  for (let i = 0; i < count; i++) {
    const tid = 'thumb-' + randomUUID().slice(0, 8)
    const file = `scenes/${tid}.tsx`
    const concept = concepts[(i + (p.thumbnails?.length ?? 0)) % concepts.length]
    onStatus?.(`Designing thumbnail ${i + 1} of ${count}`)
    const prompt = `The thumbnail guide, the scene kit and the style of this video are in your instructions: do not read THUMBNAILS.md, METHOD.md or STYLE.md.
${frames.length ? `First look at these frames from the video (Read each picture): the thumbnail must look like them, and reuse their key visual: ${frames.join(', ')}\n` : ''}
Design the YouTube thumbnail for this video.
Title: ${p.publish?.titles[0] ?? p.title}
What the video is about: ${(p.words.map((w) => w.w).join(' ') || p.direction).slice(0, 1500)}
Parts: ${p.parts.map((x) => x.title).join(' · ')}
Style: ${style.name} (in your instructions: draw it exactly that way, with its background, colours and lettering)${style.render === 'three' ? '. Real 3D: build the subject with @kit/three' : ''}
${chars.length ? `Characters you may use: ${chars.map((c) => c.name).join(', ')}\n` : ''}Concept for this one: ${concept}${note ? `\nThe creator asked for: ${note}` : ''}

Make it clear at stamp size, in the video's own look: one big subject, 2–4 huge words in the video's lettering, the style's accent on the key thing, one pointer at most, bottom-right corner empty. No look the video does not have (no stock glows, sun rays or red arrows unless the style uses them).
It is one still: everything is fully drawn from frame 0 (no animation, every start at 0).

Write the scene to ${file}. Do not create or change any other file. Reply with one sentence about the idea.`
    await runAgent({ ...draw, prompt })
    const abs = join(p.dir, file)
    if (!existsSync(abs)) throw new Error('The thumbnail scene was not written')
    fixSceneImports(abs)
    let err = await checkScene(abs)
    for (let tries = 0; err && tries < 2; tries++) {
      onStatus?.('Repairing the thumbnail')
      // A build error is a small fix: a quick model, as for the parts.
      const quick = p.settings.provider === 'Codex' ? { effort: 'Low' as const } : { model: 'Sonnet 5.5', effort: 'Low' as const }
      await runAgent({ ...draw, ...quick, prompt: `The thumbnail scene ${file} does not build:\n${err}\nRead it and fix it (the kit is in your instructions). Reply with one sentence.` })
      err = await checkScene(abs)
    }
    onStatus?.('Drawing the thumbnail')
    const url = await bundleProject(p, undefined, 'bundle-thumbs')
    const out = join(p.dir, 'thumbs', `${tid}.png`)
    await stillScene(p, url, tid, out, { width: 1280, height: 720, frames: 20 })
    made.push({ id: tid, file: out, scene: abs, note: note ? `${concept} · ${note}` : concept, at: Date.now() })
  }
  p.thumbnails = [...made, ...(p.thumbnails ?? [])]
  emit(p, true)
  return p
}
