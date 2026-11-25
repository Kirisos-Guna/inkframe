// Writing (script, titles + description, captions) and thumbnails.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { Project, Provider, PublishKit, Thumbnail } from '../../shared/types'
import { getProject, getSettings, getStyle, libDir, styleGuide } from './store'
import { extractJson, runAgent } from './agent'
import { codexPath } from './tools'
import { bundleProject, checkScene, fixSceneImports, methodFile, stillScene, thumbMethodFile } from './render'
import { drawingSystem, isTamil, styleDoc, TAMIL_STYLE } from './prompts'
import { HOUSE_VOICE, lintScript, retentionPrompt, SCRIPT_CRAFT, SCRIPT_JSON, SCRIPT_PROCESS, WPM } from './scriptCraft'
import { linesFromWords, type Line } from './captions'
import { emit } from './pipeline'

/** Who writes: Codex by default (when it is installed), otherwise Claude Code, or OpenCode's free model when chosen. */
export async function writer(): Promise<{ provider: Provider; model: string }> {
  const s = getSettings()
  const want = s.writerProvider ?? 'Codex'
  const provider = want === 'Codex' && !(await codexPath()) ? 'Claude Code' : want
  const model =
    provider === 'Codex' ? s.writerModel ?? 'Codex default' : provider === 'OpenCode' ? s.opencodeModel ?? '' : s.defaultProvider === 'Claude Code' ? s.defaultModel : 'Sonnet 5.5'
  return { provider, model }
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
  const short = r.platform !== 'YouTube'
  const wpm = WPM
  const words = short ? Math.round(Math.min(r.minutes, 1.5) * wpm) : Math.round(r.minutes * wpm)
  const reply = await runAgent({
    ...w,
    effort: 'High',
    cwd: libDir('writing'),
    search: r.research,
    prompt: `You write voiceover scripts for faceless explainer videos that are drawn as the voiceover plays. Your scripts are
the reason people stay to the end: specific, surprising, and built so every sentence pulls into the next.

Topic: ${r.topic}
${r.angle ? `The creator's angle and notes (follow them): ${r.angle}\n` : ''}Platform: ${r.platform}
Length: about ${words} words spoken (${short ? 'under 90 seconds' : `about ${r.minutes} minute${r.minutes === 1 ? '' : 's'}`}). Stay within 10%.
Tone: ${r.tone}
${channelVoice()}${
      r.research
        ? 'Research first: find the facts, numbers, named examples and recent developments that make this topic surprising, and list your sources.'
        : 'Use only what you know to be true. Never invent numbers, names, quotes or studies; when unsure, say it more carefully.'
    }
${
  short
    ? `\nThis is a short (${r.platform}): the first sentence IS the hook, no build-up; one idea, one reveal, one punchline; the last line loops back to the first so it rewatches well. No call to action.\n`
    : r.platform === 'YouTube'
      ? '\nAfter the line to remember, end with a short sign-off as the last line ("Thanks for watching, see you in the next one."). Never tease or name another video.\n'
      : ''
}
${SCRIPT_CRAFT}

${HOUSE_VOICE}


${SCRIPT_PROCESS}

Reply with JSON only:
{${SCRIPT_JSON},
 "sources": ["url or source name", ...]}`
  })
  const out = extractJson<{ title: string; script: string; hooks?: string[]; sources?: string[] }>(reply)
  if (!out.script?.trim()) throw new Error('The writer did not return a script. Try again.')
  const script = await polishScript(w, out.script, words, !short && r.platform === 'YouTube')
  return { title: out.title ?? '', script, hooks: cleanHooks(out.hooks), sources: out.sources ?? [], by: `${w.provider} · ${w.model}` }
}

/** The creator's channel voice from Settings, so every script sounds like the same channel. */
export function channelVoice() {
  const v = getSettings().scriptVoice?.trim()
  return v ? `\nTHE CHANNEL'S VOICE (every script of this channel sounds like this; it wins over the general rules on tone):\n${v}\n\n` : '\n'
}

const cleanHooks = (h: unknown) => (Array.isArray(h) ? h.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 3) : [])

/**
 * Checks a script for free (tired phrases, length, long sentences, a weak first line, formatting) and, if anything
 * is off, asks the writer for one revision that names exactly what to change. A revision that comes back worse is
 * not used.
 */
export async function polishScript(w: { provider: Provider; model: string }, script: string, targetWords: number, signOff = false) {
  const issues = lintScript(script, targetWords, signOff)
  try {
    // Every script gets the editor's pass for the thread and the jumps between beats (what makes people leave), plus
    // whatever the local check found. A rewrite that the local check likes less is not used.
    const reply = await runAgent({ ...w, effort: 'High', cwd: libDir('writing'), prompt: retentionPrompt(script, issues, targetWords) })
    const revised = extractJson<{ script: string }>(reply).script?.trim()
    return revised && lintScript(revised, targetWords, signOff).length <= issues.length ? revised : script
  } catch {
    // The first version is still a whole script: better than nothing.
    return script
  }
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

${isTamil(p) ? `Write everything below in Tamil. ${TAMIL_STYLE} The transcript comes from speech recognition: go by the meaning, and fix misheard words. Tags: a mix of Tamil and the English words people search for.\n\n` : ''}Write:
- 5 title options, each under 60 characters, each built a different way (a number that sounds wrong; a named thing
  plus what went wrong; a question the viewer cannot leave unanswered; "how" or "why" plus the surprising part; a
  contrast, X vs Y). Put the words people would SEARCH for (the product, company, bug or concept by name) in the first
  half of the title, then the curiosity: promise something the viewer does not know yet, never the answer. Simple
  everyday words. No clickbait lies, no ALL CAPS words except acronyms, no emojis. Best first.
- A description. Its first two lines are what search results and the "more" fold show: the hook and the main search
  words, in under 150 characters. Then 2 short paragraphs that say what the viewer will learn, naming the real things
  (products, companies, people, numbers) people search for, in plain sentences (no keyword lists). Then "Chapters"
  with the timestamps. No hashtags, no links you were not given, no "subscribe".
- 25 to 30 tags people would type into YouTube search, all together under 450 characters: the exact topic first;
  the named things (product, company, person, bug, protocol); the "how does X work", "why did X fail", "X explained"
  questions people ask; the broader field (e.g. networking, software engineering); and 2 or 3 close topics viewers of
  this also watch. Lowercase plain phrases, no # signs, no repeats.

Reply with JSON only: {"titles": [...], "description": "...", "tags": [...]}`
  })
  const k = extractJson<Omit<PublishKit, 'at'>>(reply)
  // No hashtags anywhere: a line of them at the end of the description, or tags written with #, are dropped.
  const description = stripHashtags(k.description ?? '')
  p.publish = { titles: k.titles ?? [], description, tags: fitTags(k.tags ?? []), at: Date.now() }
  emit(p, true)
  return p
}

/** A description without the hashtags a writer may still put at its end (on their own lines or after the last words). */
export function stripHashtags(d: string) {
  return d.replace(/(\s*#\p{L}[\p{L}\p{N}_]*)+\s*$/u, '').trim()
}

/**
 * Tags as YouTube takes them: no # signs, no repeats, and within its 500-character limit as YouTube counts it (the
 * commas, and the quotes it puts around a tag of several words). A tag that does not fit is skipped, not the rest.
 */
export function fitTags(tags: string[]) {
  const out: string[] = []
  let len = 0
  const cost = (t: string) => t.length + (/\s/.test(t) ? 2 : 0)
  for (const t of tags.map((x) => x.replace(/^#+/, '').trim()).filter(Boolean)) {
    if (out.some((o) => o.toLowerCase() === t.toLowerCase())) continue
    const add = cost(t) + (out.length ? 1 : 0)
    if (len + add > 490) continue
    out.push(t)
    len += add
  }
  return out
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
      }. Stay in the language the lines are in. Keep the meaning and keep every line: the reply must have exactly ${lines.length} lines, in the same order, each one the corrected text of the same line. Do not merge or split lines.
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
const CONCEPTS = ['The glowing object', 'Big number', 'Before → after / versus', 'Mystery']

export async function makeThumbnails(id: string, count: number, note?: string, onStatus?: (s: string) => void): Promise<Project> {
  const p = getProject(id)!
  const style = getStyle(p.settings.styleId)
  mkdirSync(join(p.dir, 'scenes'), { recursive: true })
  copyFileSync(thumbMethodFile(), join(p.dir, 'THUMBNAILS.md'))
  // A few of the video's own frames, so the thumbnail matches what the viewer will see.
  const frames = p.parts
    .filter((x) => x.thumb && existsSync(x.thumb))
    .filter((_, i, a) => a.length <= 4 || i % Math.ceil(a.length / 4) === 0)
    .slice(0, 4)
    .map((x) => `thumbs/${x.id}.png`)
  const concepts = CONCEPTS
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
Concept for this one: ${concept}${note ? `\nThe creator asked for: ${note}` : ''}
${isTamil(p) ? `The words on the thumbnail are in Tamil, 2-4 words. ${TAMIL_STYLE}\n` : ''}
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
