// Voiceovers made with ElevenLabs: the writer picks the voice that fits the script, then the script is spoken in a few
// pieces (each knows the text around it, so the delivery flows) and joined into one file. The key stays on this PC.
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { ElevenVoice, VoicePick } from '../../shared/types'
import { getSettings, libDir } from './store'
import { extractJson, runAgent } from './agent'
import { writer } from './publish'
import { ffmpeg } from './media'
import { fakeEnabled } from './fakeAgent'

const API = 'https://api.elevenlabs.io'

function key() {
  const k = getSettings().elevenLabsKey?.trim()
  if (!k) throw new Error('Add your ElevenLabs API key in Settings first.')
  return k
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(API + path, { ...init, headers: { 'xi-api-key': key(), 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  if (!r.ok) {
    const body = await r.text().catch(() => '')
    const detail = body.match(/"message"\s*:\s*"([^"]+)"/)?.[1] ?? body.slice(0, 200)
    if (r.status === 401) throw new Error(`ElevenLabs did not accept the API key (${detail || 'unauthorised'}). Check it in Settings.`)
    throw new Error(`ElevenLabs: ${detail || r.statusText} (${r.status})`)
  }
  return (r.headers.get('content-type')?.includes('json') ? r.json() : r.arrayBuffer()) as Promise<T>
}

const LANG: Record<string, string> = { Tamil: 'ta', Hindi: 'hi', English: 'en' }

/** The voices in the account, and (for a language) the most used narration voices in the ElevenLabs library. */
export async function listVoices(language = 'English'): Promise<{ voices: ElevenVoice[]; left?: number }> {
  if (fakeEnabled() && !getSettings().elevenLabsKey) return { voices: [{ id: 'fake-narrator', name: 'Stand-in Narrator', about: 'male, middle aged, calm explainer', mine: true }, { id: 'fake-hype', name: 'Stand-in Hype', about: 'young, energetic', mine: false }], left: 10000 }
  type V = { voice_id: string; name: string; category?: string; description?: string; preview_url?: string; labels?: Record<string, string> }
  const own = await call<{ voices: V[] }>('/v1/voices')
  const voices: ElevenVoice[] = own.voices.map((v) => ({
    id: v.voice_id,
    name: v.name,
    mine: v.category !== 'premade',
    about: [v.labels?.gender, v.labels?.age, v.labels?.accent, v.labels?.description, v.labels?.use_case ?? v.labels?.['use case'], v.description].filter(Boolean).join(', '),
    preview: v.preview_url
  }))
  // The library has voices made for a language and for narration; they need adding to the account to be used.
  const lang = LANG[language] ?? 'en'
  type S = { voice_id: string; public_owner_id: string; name: string; gender?: string; age?: string; accent?: string; description?: string; use_case?: string; preview_url?: string; cloned_by_count?: number }
  const shared = await call<{ voices: S[] }>(`/v1/shared-voices?page_size=30&sort=trending&language=${lang}&category=professional`).catch(() => ({ voices: [] as S[] }))
  for (const v of shared.voices) {
    if (voices.some((x) => x.id === v.voice_id)) continue
    voices.push({ id: v.voice_id, owner: v.public_owner_id, name: v.name, mine: false, library: true, about: [v.gender, v.age, v.accent, v.use_case, v.description?.slice(0, 160)].filter(Boolean).join(', '), preview: v.preview_url })
  }
  const sub = await call<{ character_count: number; character_limit: number }>('/v1/user/subscription').catch(() => null)
  return { voices, left: sub ? sub.character_limit - sub.character_count : undefined }
}

/** The writer reads the script and picks the voice, its pace and how much feeling to put in. */
export async function pickVoice(script: string, voices: ElevenVoice[], o: { language?: string; style?: string; fast?: boolean }): Promise<VoicePick> {
  const w = await writer()
  const reply = await runAgent({
    provider: w.provider,
    model: w.model,
    effort: 'Low',
    cwd: libDir('writing'),
    prompt: `You cast the narrator for a video. Pick the ONE voice below that fits this script best: its subject, audience,
mood and pace${o.language && o.language !== 'English' ? `, and it must speak ${o.language} natively` : ''}. Prefer voices made for narration
or explainers; a voice from the account ("mine") wins a tie.${o.style ? `\nThe video's look: ${o.style}.` : ''}${o.fast ? '\nThe script is fast and funny: a quick, dry, confident delivery.' : ''}

Voices (id | name | about):
${voices.map((v) => `${v.id} | ${v.name}${v.mine ? ' (mine)' : ''} | ${v.about || '-'}`).join('\n')}

The script (start):
${script.slice(0, 2500)}

Reply with JSON only: {"id": "<voice id>", "why": "<one short sentence>", "speed": <0.8-1.2, 1 is normal>, "stability": <0.3-0.8, lower is more expressive>, "style": <0-0.6, how much emotion>}`
  })
  const r = extractJson<Partial<VoicePick>>(reply)
  const voice = voices.find((v) => v.id === r.id) ?? voices[0]
  const clamp = (x: unknown, lo: number, hi: number, d: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d)
  return {
    id: voice.id,
    why: r.why ?? '',
    speed: clamp(r.speed, 0.8, 1.2, o.fast ? 1.08 : 1),
    stability: clamp(r.stability, 0.3, 0.8, 0.5),
    style: clamp(r.style, 0, 0.6, 0.2)
  }
}

/** Pieces of the script on paragraph (or sentence) breaks, each under `max` characters. */
export function splitScript(script: string, max = 2400) {
  const out: string[] = []
  let cur = ''
  const push = (piece: string) => {
    if (cur && cur.length + piece.length + 2 > max) {
      out.push(cur.trim())
      cur = ''
    }
    cur += (cur ? '\n\n' : '') + piece
  }
  for (const para of script.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean)) {
    if (para.length <= max) push(para)
    else for (const s of para.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [para]) push(s.trim())
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/** Speaks the script with the picked voice into one MP3 in the save folder and returns its path. */
export async function speak(script: string, pick: VoicePick, voice: ElevenVoice, language: string | undefined, onStatus: (s: string) => void) {
  const s = getSettings()
  const stamp = new Date().toISOString().replace(/:/g, '_').slice(0, 19)
  const out = join(s.saveDir, `ElevenLabs_${stamp}_${voice.name.replace(/[^\w -]+/g, '').slice(0, 24).trim()}.mp3`)
  mkdirSync(dirname(out), { recursive: true })
  if (fakeEnabled()) {
    // The stand-in: a quiet tone as long as the words would take, so the rest of the app can be tested for free.
    const secs = Math.max(3, script.split(/\s+/).length / 2.6)
    await ffmpeg(['-y', '-f', 'lavfi', '-i', `sine=frequency=180:duration=${secs.toFixed(1)}`, '-af', 'volume=0.2', out])
    return out
  }
  // A library voice is added to the account once, then used like the others.
  let id = pick.id
  if (voice.library && voice.owner) {
    onStatus(`Adding ${voice.name} to your voices`)
    // Already added before (the request then fails): the voice is in the account under the same id.
    const added = await call<{ voice_id?: string }>(`/v1/voices/add/${voice.owner}/${voice.id}`, { method: 'POST', body: JSON.stringify({ new_name: voice.name }) }).catch((e: Error) => {
      if (/already|exists/i.test(e.message)) return {} as { voice_id?: string }
      throw e
    })
    id = added.voice_id ?? voice.id
  }
  const pieces = splitScript(script)
  const model = language && language !== 'English' ? 'eleven_multilingual_v2' : s.elevenLabsModel ?? 'eleven_multilingual_v2'
  const parts: string[] = []
  const work = join(libDir('elevenlabs'), stamp)
  mkdirSync(work, { recursive: true })
  for (const [i, text] of pieces.entries()) {
    onStatus(`Speaking ${i + 1} of ${pieces.length}`)
    const audio = await call<ArrayBuffer>(`/v1/text-to-speech/${id}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: model,
        previous_text: pieces[i - 1]?.slice(-600),
        next_text: pieces[i + 1]?.slice(0, 600),
        voice_settings: { stability: pick.stability, similarity_boost: 0.75, style: pick.style, use_speaker_boost: true, speed: pick.speed }
      })
    })
    const f = join(work, `${i}.mp3`)
    writeFileSync(f, Buffer.from(audio))
    parts.push(f)
  }
  // One file, with a short breath between pieces.
  onStatus('Joining the voiceover')
  const inputs = parts.flatMap((f) => ['-i', f])
  const chain = parts.map((_, i) => `[${i}:a]aresample=44100,apad=pad_dur=${i < parts.length - 1 ? 0.25 : 0}[a${i}]`).join(';')
  await ffmpeg(['-y', ...inputs, '-filter_complex', `${chain};${parts.map((_, i) => `[a${i}]`).join('')}concat=n=${parts.length}:v=0:a=1[out]`, '-map', '[out]', '-b:a', '192k', out])
  rmSync(work, { recursive: true, force: true })
  return out
}
