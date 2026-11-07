// Voiceovers made on this PC with Kokoro, a small open voice model (Apache 2.0): no account, no key, no cost. The model
// (about 90 MB) is fetched once into the library. The script is spoken sentence by sentence, joined with short
// breaths, pitched with FFmpeg, and saved as an MP3 in the save folder. English only.
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { LocalVoice, VoiceChoice } from '../../shared/types'
import { getSettings, libDir } from './store'
import { ffmpeg } from './media'
import { fakeEnabled } from './fakeAgent'

/** The voices offered, best first for a quick developer explainer. Kokoro's own voice names. */
export const VOICES: LocalVoice[] = [
  { id: 'am_puck', name: 'Puck', about: 'Young man, American, quick and crisp: the developer-explainer voice (default)' },
  { id: 'am_michael', name: 'Michael', about: 'Man, American, warm and clear' },
  { id: 'am_fenrir', name: 'Fenrir', about: 'Man, American, bright and lively' },
  { id: 'am_liam', name: 'Liam', about: 'Young man, American, light and fast' },
  { id: 'am_eric', name: 'Eric', about: 'Man, American, higher and friendly' },
  { id: 'am_onyx', name: 'Onyx', about: 'Man, American, deep and calm' },
  { id: 'bm_daniel', name: 'Daniel', about: 'Man, British, even and dry' },
  { id: 'bm_george', name: 'George', about: 'Man, British, older narrator' },
  { id: 'af_heart', name: 'Heart', about: 'Woman, American, warm and expressive' },
  { id: 'af_bella', name: 'Bella', about: 'Woman, American, bright and upbeat' },
  { id: 'af_nicole', name: 'Nicole', about: 'Woman, American, soft and close' },
  { id: 'bf_emma', name: 'Emma', about: 'Woman, British, clear and composed' }
]

/** Quick and a touch faster than normal, at the voice's own pitch: about 200 words a minute. */
export const DEFAULT_VOICE: VoiceChoice = { id: 'am_puck', speed: 1.1, pitch: 0 }

const SAMPLE = "You'd sit in a meeting where someone says, just put a cache in front of it. And you nod, like you know exactly what that means."

/**
 * The script in pieces the model speaks well: whole sentences, up to `max` characters each, never across a paragraph.
 * `pause` is the breath after the piece: longer at the end of a paragraph.
 */
export function chunkScript(script: string, max = 320): { text: string; pause: number }[] {
  const out: { text: string; pause: number }[] = []
  const paras = script.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean)
  for (const para of paras) {
    const sentences = para.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [para]
    let cur = ''
    const push = () => {
      if (cur) out.push({ text: cur, pause: 0.12 })
      cur = ''
    }
    for (const s of sentences) {
      // A very long sentence is split on commas so the model never runs out of room.
      const bits = s.length > max ? (s.match(/[^,;:]+[,;:]?/g) ?? [s]).map((b) => b.trim()) : [s]
      for (const b of bits) {
        if (cur && cur.length + b.length + 1 > max) push()
        cur = cur ? `${cur} ${b}` : b
      }
    }
    push()
    if (out.length) out[out.length - 1].pause = 0.38
  }
  if (out.length) out[out.length - 1].pause = 0.25
  return out
}

type Tts = { generate: (text: string, o: { voice: string; speed: number }) => Promise<{ audio: Float32Array; sampling_rate: number }> }
let loading: Promise<Tts> | null = null

/** The voice model, loaded once (and fetched once, about 90 MB, with its progress). */
function model(onStatus: (s: string) => void): Promise<Tts> {
  loading ??= (async () => {
    const dir = libDir('voice', 'models')
    const first = !existsSync(join(dir, 'onnx-community'))
    onStatus(first ? 'Getting the voice model (once, about 90 MB)' : 'Loading the voice')
    const { env } = await import('@huggingface/transformers')
    env.cacheDir = dir
    const { KokoroTTS } = await import('kokoro-js')
    let last = -1
    return (await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: 'q8',
      device: 'cpu',
      progress_callback: (p: { status: string; progress?: number; file?: string }) => {
        if (p.status !== 'progress' || !p.file?.endsWith('.onnx') || p.progress === undefined) return
        const pct = Math.floor(p.progress)
        if (pct > last) onStatus(`Getting the voice model (once, about 90 MB) · ${(last = pct)}%`)
      }
    })) as unknown as Tts
  })().catch((e) => {
    loading = null
    throw new Error(`The voice model could not be loaded: ${(e as Error).message}`)
  })
  return loading
}

/** Mono float samples to a 16-bit WAV file. */
function writeWav(file: string, samples: Float32Array, rate: number) {
  const data = Buffer.alloc(samples.length * 2)
  for (let i = 0; i < samples.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), i * 2)
  const head = Buffer.alloc(44)
  head.write('RIFF', 0)
  head.writeUInt32LE(36 + data.length, 4)
  head.write('WAVEfmt ', 8)
  head.writeUInt32LE(16, 16)
  head.writeUInt16LE(1, 20)
  head.writeUInt16LE(1, 22)
  head.writeUInt32LE(rate, 24)
  head.writeUInt32LE(rate * 2, 28)
  head.writeUInt16LE(2, 32)
  head.writeUInt16LE(16, 34)
  head.write('data', 36)
  head.writeUInt32LE(data.length, 40)
  writeFileSync(file, Buffer.concat([head, data]))
}

/** FFmpeg filters for the pitch (in semitones, the speed kept) and an even loudness, at 44.1 kHz. */
export function voiceFilter(rate: number, pitch: number) {
  const f = Math.pow(2, Math.max(-4, Math.min(4, pitch)) / 12)
  const shift = Math.abs(pitch) > 0.01 ? `asetrate=${Math.round(rate * f)},aresample=44100,atempo=${(1 / f).toFixed(5)},` : 'aresample=44100,'
  return `${shift}loudnorm=I=-16:TP=-1.5:LRA=11`
}

const tooTamil = (s: string) => /[஀-௿]/.test(s)

async function render(text: string, choice: VoiceChoice, out: string, onStatus: (s: string) => void, work: string) {
  const tts = await model(onStatus)
  const pieces = chunkScript(text)
  const parts: Float32Array[] = []
  let rate = 24000
  for (const [i, p] of pieces.entries()) {
    if (pieces.length > 1) onStatus(`Speaking ${i + 1} of ${pieces.length}`)
    const a = await tts.generate(p.text, { voice: choice.id, speed: choice.speed })
    rate = a.sampling_rate
    parts.push(a.audio, new Float32Array(Math.round(p.pause * rate)))
  }
  const all = new Float32Array(parts.reduce((n, a) => n + a.length, 0))
  let at = 0
  for (const a of parts) all.set(a, (at += a.length) - a.length)
  const wav = join(work, 'voice.wav')
  writeWav(wav, all, rate)
  onStatus('Finishing the voiceover')
  await ffmpeg(['-y', '-i', wav, '-af', voiceFilter(rate, choice.pitch), '-ar', '44100', '-ac', '1', '-b:a', '192k', out])
}

/** A short sample of a voice as it would speak (cached). Returns the file. */
export async function previewVoice(choice: VoiceChoice, onStatus: (s: string) => void) {
  const dir = libDir('voice', 'previews')
  const out = join(dir, `${choice.id}-${choice.speed.toFixed(2)}-${choice.pitch.toFixed(1)}.mp3`)
  if (existsSync(out)) return out
  if (fakeEnabled()) {
    await ffmpeg(['-y', '-f', 'lavfi', '-i', 'sine=frequency=180:duration=2', '-af', 'volume=0.2', out])
    return out
  }
  const work = libDir('voice', 'work', String(Date.now()))
  try {
    await render(SAMPLE, choice, out, onStatus, work)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
  return out
}

/** Speaks the script into one MP3 in the save folder and returns its path. */
export async function speak(script: string, choice: VoiceChoice, onStatus: (s: string) => void) {
  if (tooTamil(script)) throw new Error('The local voice speaks English only. Record the Tamil voiceover yourself and drop it here.')
  const s = getSettings()
  const voice = VOICES.find((v) => v.id === choice.id) ?? VOICES[0]
  const stamp = new Date().toISOString().replace(/:/g, '_').slice(0, 19)
  const out = join(s.saveDir, `Voiceover_${stamp}_${voice.name}.mp3`)
  mkdirSync(s.saveDir, { recursive: true })
  if (fakeEnabled()) {
    // The stand-in: a quiet tone as long as the words would take, so the rest of the app can be tested quickly.
    const secs = Math.max(3, script.split(/\s+/).length / 3.2)
    await ffmpeg(['-y', '-f', 'lavfi', '-i', `sine=frequency=180:duration=${secs.toFixed(1)}`, '-af', 'volume=0.2', out])
    return out
  }
  const work = libDir('voice', 'work', stamp)
  try {
    await render(script, { ...choice, id: voice.id }, out, onStatus, work)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
  return out
}
