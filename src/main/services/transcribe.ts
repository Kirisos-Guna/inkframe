import { createWriteStream, existsSync, readFileSync, renameSync, rmSync, statSync } from 'fs'
import { join } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import type { Word } from '../../shared/types'
import { run, toWav16k } from './media'
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

const STALL_MS = 30_000
const ATTEMPTS = 5

/**
 * Downloads to `to`, resuming a half-finished `.part` file. If no data arrives for 30 seconds the
 * connection is dropped and picked up again where it stopped, up to 5 times.
 */
async function download(url: string, to: string, onProgress?: (pct: number) => void) {
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
export async function transcribe(audio: string, workDir: string, onStatus?: (s: string) => void): Promise<Word[]> {
  await ensureWhisper(onStatus)
  const { exe, model } = whisperPaths()
  if (!exe || !model) throw new Error('whisper.cpp is not set up')
  const wav = join(workDir, 'voice-16k.wav')
  await toWav16k(audio, wav)
  const outBase = join(workDir, 'words')
  onStatus?.('Listening to the voiceover')
  const r = await run(exe, ['-m', model, '-f', wav, '-l', 'auto', '-oj', '-of', outBase, '-ml', '1', '-sow', '-np', '-t', '4'])
  if (r.code !== 0 || !existsSync(outBase + '.json')) throw new Error('whisper.cpp failed: ' + r.stderr.split('\n').slice(-3).join(' '))
  const json = JSON.parse(readFileSync(outBase + '.json', 'utf8')) as {
    transcription: { offsets: { from: number; to: number }; text: string }[]
  }
  return json.transcription
    .map((s) => ({ w: s.text.trim(), start: s.offsets.from / 1000, end: s.offsets.to / 1000 }))
    .filter((w) => w.w && !/^\[.*\]$/.test(w.w))
}
