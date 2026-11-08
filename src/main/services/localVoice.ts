// Voiceovers made on this PC with Kokoro, a small open voice model (Apache 2.0): no account, no key, no cost. The model
// (about 330 MB) is fetched once into the library. The script is spoken sentence by sentence, joined with short
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

const REPO = 'onnx-community/Kokoro-82M-v1.0-ONNX'

/**
 * The voice model, loaded once (and fetched once, about 330 MB, with its progress). The full-precision model: on a
 * laptop CPU it speaks about 3.5x faster than the small 8-bit one (8.7 s of speech in 2.5 s instead of 9.2 s). The
 * half-precision one (1.15) was as fast but returned NaN, heard as silence, for about one sentence group in three.
 * DirectML (the GPU) cannot run this model, so it stays on the CPU.
 */
function model(onStatus: (s: string) => void): Promise<Tts> {
  loading ??= (async () => {
    const dir = libDir('voice', 'models')
    const onnx = join(dir, ...REPO.split('/'), 'onnx')
    const first = !existsSync(join(onnx, 'model.onnx'))
    onStatus(first ? 'Getting the voice model (once, about 330 MB)' : 'Loading the voice')
    const { env } = await import('@huggingface/transformers')
    env.cacheDir = dir
    const { KokoroTTS } = await import('kokoro-js')
    let last = -1
    const tts = (await KokoroTTS.from_pretrained(REPO, {
      dtype: 'fp32',
      device: 'cpu',
      progress_callback: (p: { status: string; progress?: number; file?: string }) => {
        if (p.status !== 'progress' || !p.file?.endsWith('.onnx') || p.progress === undefined) return
        const pct = Math.floor(p.progress)
        if (pct > last) onStatus(`Getting the voice model (once, about 330 MB) · ${(last = pct)}%`)
      }
    })) as unknown as Tts
    // The models older versions fetched are no longer used.
    for (const f of ['model_quantized.onnx', 'model_fp16.onnx']) rmSync(join(onnx, f), { force: true })
    return tts
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

/**
 * Speech that is not really there: NaN samples (the model failed) or a piece that is almost all silence. Real speech
 * is about 15-30% quiet samples between words.
 */
export function badAudio(samples: Float32Array) {
  if (!samples.length) return true
  let quiet = 0
  for (const v of samples) {
    if (Number.isNaN(v)) return true
    if (Math.abs(v) < 0.003) quiet++
  }
  return quiet / samples.length > 0.85
}

/**
 * One piece spoken, checked: a piece that comes back silent is spoken again, then sentence by sentence. It never
 * goes into the voiceover as a gap; if it still fails, the voiceover stops with an error that names it.
 */
async function speakPiece(tts: Tts, text: string, choice: VoiceChoice) {
  const say = (t: string) => tts.generate(t, { voice: choice.id, speed: choice.speed })
  for (let attempt = 0; attempt < 2; attempt++) {
    const a = await say(text)
    if (!badAudio(a.audio)) return a
  }
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g)?.map((x) => x.trim()).filter(Boolean) ?? [text]
  const got: Float32Array[] = []
  let rate = 24000
  for (const s of sentences) {
    const a = await say(s)
    if (badAudio(a.audio)) throw new Error(`The voice could not say: "${s.slice(0, 80)}". Rephrase that sentence and try again.`)
    rate = a.sampling_rate
    got.push(a.audio, new Float32Array(Math.round(0.12 * rate)))
  }
  const audio = new Float32Array(got.reduce((n, x) => n + x.length, 0))
  let at = 0
  for (const x of got) audio.set(x, (at += x.length) - x.length)
  return { audio, sampling_rate: rate }
}

async function render(text: string, choice: VoiceChoice, out: string, onStatus: (s: string) => void, work: string) {
  const tts = await model(onStatus)
  const pieces = chunkScript(text)
  const parts: Float32Array[] = []
  let rate = 24000
  for (const [i, p] of pieces.entries()) {
    if (pieces.length > 1) onStatus(`Speaking ${i + 1} of ${pieces.length}`)
    const a = await speakPiece(tts, p.text, choice)
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
  // Named for the model too: samples made with an older model are never played again.
  const out = join(dir, `${choice.id}-${choice.speed.toFixed(2)}-${choice.pitch.toFixed(1)}-fp32.mp3`)
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
