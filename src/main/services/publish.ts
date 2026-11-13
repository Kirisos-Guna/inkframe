// Writing (script, titles + description, captions) and thumbnails.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { MediaItem, Project, Provider, PublishKit, Thumbnail } from '../../shared/types'
import { getProject, getSettings, getStyle, libDir, styleGuide } from './store'
import { extractJson, runAgent } from './agent'
import { codexPath } from './tools'
import { bundleProject, checkScene, fixSceneImports, methodFile, stillScene, thumbMethodFile } from './render'
import { drawingSystem, isTamil, styleDoc, TAMIL_STYLE } from './prompts'
import { mediaCredits } from './job/mediaPlan'
import { HOUSE_VOICE, lintScript, retentionPrompt, SCRIPT_CRAFT, SCRIPT_JSON, SCRIPT_PROCESS, WPM } from './scriptCraft'
import { linesFromWords, type Line } from './captions'
import { emit } from './pipeline'
import { cutLooksRight } from './cutout'

/** Writing goes to Codex by default (when it is installed), otherwise to Claude Code. */
export async function writer() {
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
      ? '\nAfter the line to remember, one short sentence that points to a related next video (no "subscribe").\n'
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
  const script = await polishScript(w, out.script, words)
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
export async function polishScript(w: { provider: Provider; model: string }, script: string, targetWords: number) {
  const issues = lintScript(script, targetWords)
  try {
    // Every script gets the editor's pass for the thread and the jumps between beats (what makes people leave), plus
    // whatever the local check found. A rewrite that the local check likes less is not used.
    const reply = await runAgent({ ...w, effort: 'High', cwd: libDir('writing'), prompt: retentionPrompt(script, issues, targetWords) })
    const revised = extractJson<{ script: string }>(reply).script?.trim()
    return revised && lintScript(revised, targetWords).length <= issues.length ? revised : script
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

${isTamil(p) ? `Write everything below in Tamil. ${TAMIL_STYLE} The transcript comes from speech recognition: go by the meaning, and fix misheard words. Hashtags and tags: a mix of Tamil and the English words people search for.\n\n` : ''}Write:
- 5 title options, each under 60 characters. Curiosity first: promise something the viewer does not know yet. No clickbait lies, no ALL CAPS words except acronyms.
- A description: 2 short paragraphs that hook and summarise, then "Chapters" with the timestamps, then 3–5 hashtags on the last line.
- 15 tags (short phrases people search for).

Reply with JSON only: {"titles": [...], "description": "...", "tags": [...], "hashtags": ["#...", ...]}`
  })
  const k = extractJson<Omit<PublishKit, 'at'>>(reply)
  // The licences of the photos and clips used ask for credit: it goes at the end of the description.
  const credits = mediaCredits(p)
  const description = (k.description ?? '') + (credits.length ? `\n\nMedia credits:\n${credits.map((c) => `- ${c}`).join('\n')}` : '')
  p.publish = { titles: k.titles ?? [], description, tags: k.tags ?? [], hashtags: k.hashtags ?? [], at: Date.now() }
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

/**
 * Thumbnails for the real-media style follow the developer-news formula: one cut-out face or logo, big and outlined,
 * 2-3 huge words, a bold background. The video's own cut-outs are offered.
 */
function remixThumb(p: Project) {
  if (!getStyle(p.settings.styleId).realMedia) return ''
  const all = Object.values(p.media ?? {}).flat()
  // Only cut-outs that really hold a subject: a person segmenter keeps a speck, or nothing, of a chip or a server.
  const good = (m: MediaItem) => !!m.cut && cutLooksRight(join(p.dir, 'public', m.cut))
  const cuts = all.filter(good).map((m) => `${m.cut} (cut-out: ${m.note ?? ''})`)
  const photos = all.filter((m) => m.kind === 'photo' && !/-logo\.\w+$/.test(m.name) && !good(m)).map((m) => `${m.name} (photo: ${m.note ?? ''})`)
  return `This video's thumbnail is in the FetchDecode look, made with ONE block, <Poster> from '@kit/thumb':
  <Poster lines={[{ text: 'GPU' }, { text: 'Expired', color: 'red' }]} subject="m/…-cut.png" tag?="Reverse engineering"
    term?="still false" logos?={['m/…-logo.png', …]} side?="right" />
Pure black, 2 or 3 HUGE words stacked on the left (each line is sized to its length: short lines come out giant),
cream white with exactly ONE line in 'red', 'yellow' or 'orange'; one big real picture on the right (a person who is
in the story, or the object the video is about), fading into the black. The words are a verdict or a twist, not the
title: "GPU EXPIRED", "APP AUTOPSY", "YOUR APP. MY RULES.", "17 YEARS", "32,767 KEYS", "CODE TO ACTION". A number goes
on its own line in yellow. tag: 2-3 small words for the topic (optional); term: a 2-4 word line typed in a green
terminal, for a code or hacking video (optional); logos: up to 5 company logos from the video, small, at the top
(optional). Use at most two of tag, term and logos. Nothing else on the picture: no arrows, circles, stickers or
backgrounds of your own.
${cuts.length ? `Cut-outs of people from the video (best as the subject): ${cuts.slice(0, 8).join(', ')}\n` : ''}${photos.length ? `Photos from the video (for an object, a chip or a product, use its photo as the subject): ${photos.slice(0, 8).join(', ')}\n` : ''}${!cuts.length && !photos.length ? 'The video has no photos: use a logo file from the video as the subject.\n' : ''}Always give a subject: the picture side is never empty.
`
}

/**
 * A thumbnail whose subject is a cut-out that came out empty or a speck (a chip, a server) gets the photo it was cut
 * from instead, so the picture side is never black.
 */
function fixThumbSubject(p: Project, file: string) {
  const code = readFileSync(file, 'utf8')
  const m = code.match(/subject=["'{`]+(m\/[^"'`}]+-cut\.png)/)
  if (!m || cutLooksRight(join(p.dir, 'public', m[1]))) return
  const photo = Object.values(p.media ?? {})
    .flat()
    .find((x) => x.cut === m[1])?.name
  if (photo) writeFileSync(file, code.replace(m[1], photo))
}

// ---------- thumbnails ----------
// Different concepts for the variants, so "Make 3" gives three real choices (see remotion/THUMBNAILS.md).
const CONCEPTS = ['The glowing object', 'Big number', 'Before → after / versus', 'Mystery']
/** FetchDecode-style ideas for the real-media thumbnails: each variant a different kind of line. */
const POSTER_CONCEPTS = ['A two-word verdict (GPU EXPIRED, APP AUTOPSY)', 'The big number (17 YEARS, 32,767 KEYS)', 'A statement and its twist (YOUR APP. MY RULES.)', 'What it does, in 3 words (CODE TO ACTION, INSIDE YOUR SCREEN)']

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
  const concepts = style.realMedia ? POSTER_CONCEPTS : CONCEPTS
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
${isTamil(p) ? `The words on the thumbnail are in Tamil, 2-4 words. ${TAMIL_STYLE}\n` : ''}${remixThumb(p)}
${style.realMedia ? 'Make it clear at stamp size: the Poster does the layout, you choose the words, the colour line and the picture.' : "Make it clear at stamp size, in the video's own look: one big subject, 2–4 huge words in the video's lettering, the style's accent on the key thing, one pointer at most, bottom-right corner empty. No look the video does not have (no stock glows, sun rays or red arrows unless the style uses them)."}
It is one still: everything is fully drawn from frame 0 (no animation, every start at 0).

Write the scene to ${file}. Do not create or change any other file. Reply with one sentence about the idea.`
    await runAgent({ ...draw, prompt })
    const abs = join(p.dir, file)
    if (!existsSync(abs)) throw new Error('The thumbnail scene was not written')
    fixSceneImports(abs)
    fixThumbSubject(p, abs)
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
