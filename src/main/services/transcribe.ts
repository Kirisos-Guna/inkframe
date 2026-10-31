import { createWriteStream, existsSync, readFileSync, renameSync, rmSync, statSync } from 'fs'
import { join } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import type { Word } from '../../shared/types'
import { cpus } from 'os'
import { duration, run, toWav16k } from './media'
import { resetToolCache, whisperPaths } from './tools'

const FALLBACK_BIN = 'https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-x64.zip'

/** Download links for the Windows build of whisper.cpp, newest first. */
async function binUrls() {
  const urls: string[] = []
  try {
    const r = await fetch('https://api.github.com/repos/ggml-org/whisper.cpp/releases?per_page=5', { headers: { Accept: 'application/vnd.github+json' } })
    const releases = (await r.json()) as { assets?: { name: string; browser_download_url: string }[] }[]
    for (const rel of releases) for (const a of rel.assets ?? []) if (a.name === 'whisper-bin-x64.zip') urls.push(a.browser_download_url)
  } catch {
    /* offline or rate-limited: use the fallback */
  }
  return [...urls, FALLBACK_BIN]
}
const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin'
const STRONG_MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium-q5_0.bin'

const STALL_MS = 30_000
const ATTEMPTS = 5

/**
 * Downloads to `to`, resuming a half-finished `.part` file. If no data arrives for 30 seconds the
 * connection is dropped and picked up again where it stopped, up to 5 times.
 */
export async function download(url: string, to: string, onProgress?: (pct: number) => void) {
  const tmp = to + '.part'
  for (let attempt = 1; ; attempt++) {
    const have = existsSync(tmp) ? statSync(tmp).size : 0
    const ac = new AbortController()
    let timer = setTimeout(() => ac.abort(), STALL_MS)
    const alive = () => {
      clearTimeout(timer)
      timer = setTimeout(() => ac.abort(), STALL_MS)
    }
    try {
      const r = await fetch(url, { redirect: 'follow', signal: ac.signal, headers: have ? { Range: `bytes=${have}-` } : {} })
      if (r.status === 416) break // already complete
      if (!r.ok || !r.body) throw new Error(`Download failed (${r.status}) ${url}`)
      const resumed = r.status === 206
      const total = Number(r.headers.get('content-length') ?? 0) + (resumed ? have : 0)
      let got = resumed ? have : 0
      let last = -1
      const body = Readable.fromWeb(r.body as never)
      body.on('data', (c: Buffer) => {
        alive()
        got += c.length
        const pct = total ? Math.floor((got / total) * 100) : -1
        if (pct !== last) onProgress?.((last = pct))
      })
      await pipeline(body, createWriteStream(tmp, { flags: resumed ? 'a' : 'w' }))
      clearTimeout(timer)
      break
    } catch (e) {
      clearTimeout(timer)
      if (attempt >= ATTEMPTS) throw new Error(`Download kept stopping (${(e as Error).message}). Check your internet and press Try again.`)
      await new Promise((r) => setTimeout(r, 2000 * attempt))
    }
  }
  renameSync(tmp, to)
}

let installing: Promise<void> | null = null
/** Gets whisper.cpp and its model the first time they are needed. */
export function ensureWhisper(onStatus?: (s: string) => void) {
  const w = whisperPaths()
  if (w.exe && w.model) return Promise.resolve()
  installing ??= (async () => {
    if (!w.exe) {
      onStatus?.('Getting the listening tool (once)')
      const zip = join(w.dir, 'whisper.zip')
      let ok = false
      for (const u of await binUrls()) {
        try {
          await download(u, zip)
          ok = true
          break
        } catch {
          /* try the next release */
        }
      }
      if (!ok) throw new Error('Could not download whisper.cpp. Set it in Settings.')
      // Windows' own bsdtar unpacks zips; a GNU tar on PATH (e.g. from Git) would read 'C:' as a remote host.
      const tar = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
      const r = await run(tar, ['-xf', zip, '-C', w.dir])
      if (r.code !== 0) throw new Error('Could not unpack whisper.cpp: ' + r.stderr)
      rmSync(zip, { force: true })
    }
    if (!w.model) {
      await download(MODEL_URL, w.modelTarget, (p) => onStatus?.(`Getting the listening model (once) · ${p}%`))
    }
    resetToolCache()
  })().finally(() => (installing = null))
  return installing
}

/** Words with start/end times in seconds. */
export async function transcribe(audio: string, workDir: string, onStatus?: (s: string) => void, hint = ''): Promise<{ words: Word[]; language: string }> {
  await ensureWhisper(onStatus)
  const { exe, model } = whisperPaths()
  if (!exe || !model) throw new Error('whisper.cpp is not set up')
  const wav = join(workDir, 'voice-16k.wav')
  await toWav16k(audio, wav)
  // Which language it is, from the first 30 seconds (quick, with the small model).
  onStatus?.('Finding the language of the voiceover')
  const found = await run(exe, ['-m', model, '-f', wav, '-l', 'auto', '-dl', '-t', '4'])
  const language = `${found.stdout}${found.stderr}`.match(/auto-detected language: (\w+)/)?.[1] ?? 'en'

  // English is heard well by the small model. Other languages need a stronger one, fetched once: tested on Tamil, the
  // small model gives garble, and "medium" real sentences. Greedy search with no carried-over context is what stops it
  // repeating itself on long audio, and keeps it to about 3× the audio's length.
  const other = language !== 'en'
  if (other) await ensureStrongModel(onStatus)
  const strong = other ? whisperPaths().strongModel : model
  const seconds = await duration(wav)
  const outBase = join(workDir, 'words')
  const name = other ? `${LANGUAGE_NAMES[language] ?? language} voiceover` : 'voiceover'
  onStatus?.(`Listening to the ${name}`)
  let last = -1
  const args = ['-m', strong, '-f', wav, '-l', language, '-oj', '-of', outBase, '-ml', '1', '-sow', '-t', String(Math.max(4, cpus().length))]
  if (other) args.push('-bs', '1', '-bo', '1', '-mc', '0', ...(hint ? ['--prompt', hint.slice(0, 200)] : []))
  else args.push('-np')
  const r = await run(exe, args, {
    onLine: (l) => {
      // Each heard word is printed with its time: that is the progress.
      const m = l.match(/^\[(\d+):(\d+):(\d+)/)
      const pct = m && seconds ? Math.min(99, Math.floor(((+m[1] * 3600 + +m[2] * 60 + +m[3]) / seconds) * 100)) : -1
      if (pct > last) onStatus?.(`Listening to the ${name} · ${(last = pct)}%`)
    }
  })
  if (r.code !== 0 || !existsSync(outBase + '.json')) throw new Error('whisper.cpp failed: ' + r.stderr.split('\n').slice(-3).join(' '))
  const json = JSON.parse(readFileSync(outBase + '.json', 'utf8')) as {
    transcription: { offsets: { from: number; to: number }; text: string }[]
  }
  const words = json.transcription
    .map((s) => ({ w: s.text.trim(), start: s.offsets.from / 1000, end: s.offsets.to / 1000 }))
    .filter((w) => w.w && !/^\[.*\]$/.test(w.w))
  return { words, language }
}

/** Names of the languages the app mentions by name. */
export const LANGUAGE_NAMES: Record<string, string> = { ta: 'Tamil', hi: 'Hindi', te: 'Telugu', ml: 'Malayalam', kn: 'Kannada', es: 'Spanish', fr: 'French', de: 'German' }

/** The stronger speech model for languages other than English (540 MB, fetched once). */
let gettingStrong: Promise<void> | null = null
function ensureStrongModel(onStatus?: (s: string) => void) {
  const w = whisperPaths()
  if (existsSync(w.strongModel)) return Promise.resolve()
  gettingStrong ??= download(STRONG_MODEL_URL, w.strongModel, (p) => onStatus?.(`Getting the stronger listening model (once, 540 MB) · ${p}%`)).finally(() => (gettingStrong = null))
  return gettingStrong
}
