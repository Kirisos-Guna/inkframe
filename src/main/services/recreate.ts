// Recreate a YouTube video: read what it says and how it is built, then write a new script with the same concept and
// structure in new words, for the user to record and make in their own style.
import { existsSync, readdirSync, readFileSync, rmSync } from 'fs'
import { dirname, join } from 'path'
import { randomUUID } from 'crypto'
import { libDir, getSettings } from './store'
import { extractJson, runAgent } from './agent'
import { codexPath, ffmpegPath, resetToolCache, ytDlpPath } from './tools'
import { run } from './media'
import { download, transcribe } from './transcribe'
import { readVtt } from './vtt'
import { channelVoice, polishScript } from './publish'
import { SCRIPT_CRAFT, SCRIPT_JSON, SCRIPT_PROCESS } from './scriptCraft'

export interface RecreateRequest {
  url: string
  /** Length of the new script in minutes; 0 keeps the original's length. */
  minutes: number
  tone: string
  notes?: string
  /** Codex only: check facts and numbers on the web while writing. */
  research: boolean
}

export interface RecreateResult {
  title: string
  script: string
  /** Other strong openings the creator can swap in. */
  hooks: string[]
  direction: string
  analysis: { concept: string; audience: string; hook: string; structure: { at: string; beat: string; purpose: string }[]; devices: string[] }
  source: { title: string; channel: string; duration: number; url: string }
  by: string
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** yt-dlp from the user's PC, or the official build fetched once into the app's library. */
export async function ensureYtDlp(onStatus: (s: string) => void) {
  const have = await ytDlpPath()
  if (have) return have
  onStatus('Getting the video downloader (once)')
  const to = join(libDir('yt-dlp'), 'yt-dlp.exe')
  await download('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe', to, (p) => onStatus(`Getting the video downloader (once) · ${p}%`))
  resetToolCache()
  return to
}

/** A transcript with a time mark about every 30 seconds, so the structure can be seen. */
function withMarks(lines: { t: number; text: string }[]) {
  let mark = -Infinity
  return lines
    .map((l) => {
      const head = l.t - mark >= 30 ? `\n[${fmt(l.t)}] ` : ' '
      if (head !== ' ') mark = l.t
      return head + l.text
    })
    .join('')
    .trim()
}

export async function recreateVideo(r: RecreateRequest, onStatus: (s: string) => void): Promise<RecreateResult> {
  if (!/^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(r.url.trim())) throw new Error('Paste a YouTube link (youtube.com or youtu.be).')
  const url = r.url.trim()
  const yt = await ensureYtDlp(onStatus)
  const dir = libDir('recreate', randomUUID().slice(0, 8))
  try {
    // 1 · What the video is: title, channel, length, description, chapters.
    onStatus('Reading the video page')
    const info = await run(yt, ['-J', '--no-playlist', '--no-warnings', url])
    if (info.code !== 0) throw new Error('Could not open that video: ' + info.stderr.split('\n').filter(Boolean).slice(-1)[0])
    const meta = JSON.parse(info.stdout.toString()) as {
      title: string
      channel?: string
      uploader?: string
      duration?: number
      description?: string
      chapters?: { start_time: number; title: string }[] | null
      language?: string | null
    }

    // 2 · What it says: its captions when it has them, otherwise its sound, heard here.
    onStatus('Getting what the video says')
    const lang = meta.language && meta.language !== 'en' ? `${meta.language}.*,${meta.language},en.*,en` : 'en.*,en'
    await run(yt, ['--skip-download', '--write-subs', '--write-auto-subs', '--sub-langs', lang, '--sub-format', 'vtt', '--no-playlist', '--no-warnings', '-o', join(dir, 'subs'), url])
    const vtt = readdirSync(dir).filter((f) => f.endsWith('.vtt')).sort((a, b) => Number(/\.en/.test(b)) - Number(/\.en/.test(a)))[0]
    let transcript = ''
    if (vtt) transcript = withMarks(readVtt(readFileSync(join(dir, vtt), 'utf8')))
    if (transcript.split(/\s+/).length < 30) {
      onStatus('No captions: listening to the video')
      const audio = await run(yt, ['-f', 'bestaudio/best', '--no-playlist', '--no-warnings', '--ffmpeg-location', dirname(ffmpegPath()), '-o', join(dir, 'audio.%(ext)s'), url])
      const file = readdirSync(dir).find((f) => f.startsWith('audio.'))
      if (!file) throw new Error('Could not get the video\'s sound: ' + audio.stderr.split('\n').filter(Boolean).slice(-1)[0])
      const { words } = await transcribe(join(dir, file), dir, (s) => onStatus(s), meta.title)
      transcript = withMarks(words.map((w) => ({ t: w.start, text: w.w })))
    }
    if (!transcript.trim()) throw new Error('This video has no words to work from.')

    // 3 · The analysis and the new script.
    const spoken = transcript.replace(/\[\d+:\d+\]/g, '').split(/\s+/).filter(Boolean).length
    const duration = meta.duration ?? 0
    const targetWords = r.minutes > 0 ? Math.round(r.minutes * 150) : spoken
    const s = getSettings()
    const want = s.writerProvider ?? 'Codex'
    const provider = want === 'Codex' && !(await codexPath()) ? 'Claude Code' : want
    const model = provider === 'Codex' ? (s.writerModel ?? 'Codex default') : s.defaultProvider === 'Claude Code' ? s.defaultModel : 'Sonnet 5.5'
    onStatus(`Analysing it and writing your script (${provider})`)
    const reply = await runAgent({
      provider,
      model,
      effort: 'High',
      cwd: libDir('writing'),
      search: r.research && provider === 'Codex',
      prompt: `You help a creator make their own version of a YouTube video they admire: the same concept, told their way.

The original video
Title: ${meta.title}
Channel: ${meta.channel ?? meta.uploader ?? 'unknown'}
Length: ${fmt(duration)} (${spoken} words spoken)
${meta.chapters?.length ? `Chapters: ${meta.chapters.map((c) => `${fmt(c.start_time)} ${c.title}`).join(' · ')}\n` : ''}Description: ${(meta.description ?? '').slice(0, 1500)}

Transcript (time marks every ~30 s):
"""
${transcript.slice(0, 60000)}
"""

1. Take it apart like an editor: the core concept, who it is for, exactly how the hook works in the first 15 seconds,
   the structure beat by beat (with times), and every device that keeps people watching (each reveal, open question,
   analogy, callback, cliffhanger), with where it happens. Note what is weak too: slow stretches, vague claims, filler.
2. Write a NEW script of the same concept that is BETTER than the original, not a paraphrase of it:
   - The same concept, the same core beats and facts, the same payoff, so a viewer learns the same things.
   - Keep every device that works, and fix what is weak: a sharper first sentence, at least as many reveals, a
     specific example where the original is vague, no slow stretches.
   - Every sentence is yours. Do not copy or closely paraphrase its sentences, jokes or catchphrases, and do not
     mention the original video, its channel or its host.
   - Keep facts and numbers correct${r.research && provider === 'Codex' ? '; check them on the web and update anything out of date' : '; if one looks wrong or dated, say it more carefully rather than repeating it'}.
   - About ${targetWords} words (${Math.max(1, Math.round(targetWords / 150))} min spoken), within 10%. Tone: ${r.tone}.${r.notes ? `\n   - The creator adds (follow it): ${r.notes}` : ''}
3. Write a short direction (under 120 words) for the animator: the visual idea for each beat, as one paragraph, in no
   particular art style (the creator picks the style).
${channelVoice()}
${SCRIPT_CRAFT}

${SCRIPT_PROCESS}

Reply with JSON only:
{"analysis": {"concept": "...", "audience": "...", "hook": "...", "structure": [{"at": "0:00", "beat": "...", "purpose": "..."}], "devices": ["..."]},
 ${SCRIPT_JSON.replace('a curiosity-driven title', "a new curiosity-driven title (not the original's)")},
 "direction": "..."}`
    })
    const out = extractJson<Omit<RecreateResult, 'source' | 'by'>>(reply)
    if (!out.script?.trim()) throw new Error('The writer did not return a script. Try again.')
    onStatus('Checking the script')
    const script = await polishScript({ provider, model }, out.script, targetWords)
    return {
      title: out.title ?? '',
      script,
      hooks: Array.isArray(out.hooks) ? out.hooks.map(String).filter(Boolean).slice(0, 3) : [],
      direction: out.direction ?? '',
      analysis: {
        concept: out.analysis?.concept ?? '',
        audience: out.analysis?.audience ?? '',
        hook: out.analysis?.hook ?? '',
        structure: Array.isArray(out.analysis?.structure) ? out.analysis.structure : [],
        devices: Array.isArray(out.analysis?.devices) ? out.analysis.devices : []
      },
      source: { title: meta.title, channel: meta.channel ?? meta.uploader ?? '', duration, url },
      by: `${provider} · ${model}`
    }
  } finally {
    // The downloaded captions and sound are only needed while writing.
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
  }
}
