// Real media for the remix styles: live screenshots of web pages (with the sentence to highlight found on the page),
// real tweets from their official embed, photos and logos from Wikimedia Commons (free licences, credited), meme
// templates from Imgflip, stock clips from Pexels or Pixabay (with the user's free key), and clips the user links to.
// Everything is fetched on this computer; no AI and no tokens are used here.
import { BrowserWindow } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { interFont } from './hyperframes'
import { dirname, join } from 'path'
import type { MediaItem, Shot } from '../../shared/types'
import { run } from './media'
import { ffmpegPath } from './tools'
import { ensureYtDlp } from './recreate'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const r = await fetch(url, { headers: { 'User-Agent': 'Inkframe/1 (video maker; contact via GitHub)', ...headers }, signal: AbortSignal.timeout(20000) })
  if (!r.ok) throw new Error(`${r.status} from ${new URL(url).host}`)
  return (await r.json()) as T
}

async function save(url: string, to: string) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) })
  if (!r.ok) throw new Error(`${r.status} for ${url}`)
  mkdirSync(dirname(to), { recursive: true })
  writeFileSync(to, Buffer.from(await r.arrayBuffer()))
  return to
}

// ---------- web pages and tweets, in a real browser ----------
const W = 1280
const H = 860

/**
 * Hides what covers a page in a screenshot: cookie and consent banners, sign-up walls, fixed bars. Then finds the
 * sentence to highlight, scrolls it to the upper third, and returns where its lines are, in screenshot pixels.
 */
const PAGE_SCRIPT = (mark: string) => `(() => {
  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el)
    if ((s.position === 'fixed' || s.position === 'sticky') && el.getBoundingClientRect().height < innerHeight * 0.9) el.style.setProperty('display', 'none', 'important')
    if (/cookie|consent|gdpr|newsletter|subscribe-wall|paywall/i.test((el.id || '') + ' ' + (typeof el.className === 'string' ? el.className : ''))) el.style.setProperty('display', 'none', 'important')
  }
  document.documentElement.style.overflow = 'auto'
  document.body.style.overflow = 'auto'
  const norm = (t) => t.toLowerCase().replace(/\\s+/g, ' ')
  const want = norm(${JSON.stringify(mark)}).trim()
  if (!want) return { marks: [] }
  const ws = want.split(' ').filter((w) => w.length > 2)
  // Look inside one block of text at a time (a paragraph, a list item, a heading, a cell), so a match never runs
  // across columns or into the sidebar.
  let best = null
  for (const block of document.querySelectorAll('p,li,h1,h2,h3,h4,blockquote,td,dd,figcaption,pre')) {
    if (!block.offsetParent) continue
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
    const nodes = []
    let text = ''
    for (let n; (n = walker.nextNode()); ) {
      if (n.parentElement.closest('script,style,noscript,sup')) continue
      nodes.push([n, text.length])
      text += norm(n.nodeValue)
    }
    let from = text.indexOf(want)
    let to = from + want.length
    let score = from >= 0 ? 1 : 0
    if (from < 0 && ws.length) {
      // Not word for word: where most of its words come in order, each close to the last.
      for (let f = text.indexOf(ws[0]); f >= 0; f = text.indexOf(ws[0], f + 1)) {
        let last = f + ws[0].length
        let hit = 1
        for (const w of ws.slice(1)) {
          const next = text.indexOf(w, last)
          if (next >= 0 && next - last < 120) {
            hit++
            last = next + w.length
          }
        }
        if (hit / ws.length > score) [score, from, to] = [hit / ws.length, f, last]
      }
    }
    if (score >= 0.6 && (!best || score > best.score)) best = { score, nodes, from, to }
  }
  if (!best) return { marks: [] }
  const find = (pos) => { for (let i = best.nodes.length - 1; i >= 0; i--) if (best.nodes[i][1] <= pos) return [best.nodes[i][0], Math.min(pos - best.nodes[i][1], best.nodes[i][0].nodeValue.length)] }
  const range = document.createRange()
  range.setStart(...find(best.from))
  range.setEnd(...find(best.to))
  window.scrollBy(0, range.getBoundingClientRect().top - innerHeight * 0.3)
  // One bar per line of text, as a highlighter would draw it.
  const lines = []
  for (const r of range.getClientRects()) {
    if (r.width < 3 || r.height < 6 || r.bottom < 0 || r.top > innerHeight) continue
    const line = lines.find((l) => Math.abs(l.top - r.top) < r.height * 0.5)
    if (line) {
      line.left = Math.min(line.left, r.left)
      line.right = Math.max(line.right, r.right)
      line.bottom = Math.max(line.bottom, r.bottom)
    } else lines.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom })
  }
  return { marks: lines.map((l) => [Math.round(l.left), Math.round(l.top), Math.round(l.right - l.left), Math.round(l.bottom - l.top)]) }
})()`

/** A screenshot of a page (or of HTML), with the rectangles of `mark` on it. */
async function capture(target: { url?: string; html?: string }, to: string, mark = '', wait = 2500, opt: { crop?: string; uiFont?: boolean } = {}) {
  const win = new BrowserWindow({ show: false, width: W, height: H, webPreferences: { offscreen: false, javascript: true, sandbox: true, images: true } })
  try {
    win.webContents.setUserAgent(UA)
    win.webContents.setAudioMuted(true)
    const load = target.url ? win.loadURL(target.url) : win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(target.html!))
    await Promise.race([load, sleep(25000)])
    await sleep(wait)
    // Some PCs replace the system fonts by name: embeds (which use the system font) get Inter instead, in every frame.
    if (opt.uiFont) {
      const css = `@font-face{font-family:InkUI;src:url(data:font/woff2;base64,${readFileSync(interFont()).toString('base64')}) format('woff2');font-weight:100 900}*{font-family:InkUI,sans-serif!important}`
      for (const fr of win.webContents.mainFrame.framesInSubtree)
        await fr.executeJavaScript(`(()=>{const s=document.createElement('style');s.textContent=${JSON.stringify(css)};document.documentElement.appendChild(s)})()`).catch(() => {})
      await sleep(600)
    }
    const found = (await win.webContents.executeJavaScript(PAGE_SCRIPT(mark), true).catch(() => ({ marks: [] }))) as { marks: number[][] }
    await sleep(400)
    // Crop to one element (a tweet card), not the whole window.
    const box = opt.crop
      ? ((await win.webContents.executeJavaScript(`(()=>{const e=document.querySelector(${JSON.stringify(opt.crop)});if(!e)return null;const r=e.getBoundingClientRect();return {x:Math.floor(r.left),y:Math.floor(r.top),width:Math.ceil(r.width),height:Math.ceil(r.height)}})()`).catch(() => null)) as Electron.Rectangle | null)
      : null
    const img = await win.webContents.capturePage(box && box.width > 50 && box.height > 50 ? box : undefined)
    const size = img.getSize()
    // Very small or blank results are a blocked page, not a screenshot.
    if (size.width < 400 || img.toPNG().length < 15000) throw new Error('The page did not draw (blocked or empty)')
    mkdirSync(dirname(to), { recursive: true })
    writeFileSync(to, img.toPNG())
    const k = size.width / (box?.width ?? W)
    return { w: size.width, h: size.height, marks: found.marks.map((r) => r.map((v) => Math.round(v * k))) as [number, number, number, number][] }
  } finally {
    win.destroy()
  }
}

/** A real tweet, from X's official embed (no login needed). */
async function captureTweet(url: string, to: string) {
  const o = await getJson<{ html: string; author_name: string }>(`https://publish.twitter.com/oembed?omit_script=0&dnt=true&theme=dark&url=${encodeURIComponent(url.replace('x.com', 'twitter.com'))}`)
  const html = `<!doctype html><html><body style="margin:0;background:#000;display:flex;justify-content:center;padding:40px">${o.html}</body></html>`
  const shot = await capture({ html }, to, '', 5000, { crop: 'iframe, .twitter-tweet', uiFont: true })
  return { ...shot, credit: `Post by ${o.author_name} on X` }
}

// ---------- photos and logos: Wikimedia Commons ----------
interface CommonsPage {
  title: string
  imageinfo?: { thumburl?: string; url: string; width: number; height: number; mime: string; extmetadata?: Record<string, { value: string }> }[]
}
const strip = (s = '') => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

async function commons(query: string, to: string, video = false) {
  const q = `${query} ${video ? 'filetype:video' : 'filetype:bitmap|drawing'}`
  const j = await getJson<{ query?: { pages?: Record<string, CommonsPage> } }>(
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=8&gsrsearch=${encodeURIComponent(q)}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1920`
  )
  const pages = Object.values(j.query?.pages ?? {})
  // A clip must have every searched word in its name (a "server rack" is not a rack railway); a picture is matched
  // by the search itself.
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
  const fits = (title: string) => !video || words.every((w) => title.toLowerCase().includes(w))
  const hit = pages.map((p) => ({ p, i: p.imageinfo?.[0] })).find(({ p, i }) => i && fits(p.title) && (video ? /video/.test(i.mime) : i.width >= 500))
  if (!hit?.i) throw new Error(`No free-licence ${video ? 'clip' : 'picture'} found for "${query}"`)
  const meta = hit.i.extmetadata ?? {}
  const licence = strip(meta.LicenseShortName?.value) || 'see Wikimedia Commons'
  const author = strip(meta.Artist?.value) || 'unknown'
  const file = video ? hit.i.url : (hit.i.thumburl ?? hit.i.url)
  const ext = (file.match(/\.(\w+)(?:\?|$)/)?.[1] ?? (video ? 'webm' : 'jpg')).toLowerCase()
  const out = to.replace(/\.\w+$/, `.${ext}`)
  await save(file, out)
  return { file: out, w: hit.i.width, h: hit.i.height, credit: `${hit.p.title.replace(/^File:/, '')} by ${author}, ${licence}, via Wikimedia Commons` }
}

// ---------- meme templates: Imgflip ----------
let memeList: { name: string; url: string; width: number; height: number }[] | null = null
export async function memeTemplates() {
  memeList ??= (await getJson<{ data: { memes: { name: string; url: string; width: number; height: number }[] } }>('https://api.imgflip.com/get_memes')).data.memes
  return memeList
}
async function meme(template: string, to: string) {
  const list = await memeTemplates()
  const want = template.toLowerCase()
  const m = list.find((x) => x.name.toLowerCase() === want) ?? list.find((x) => x.name.toLowerCase().includes(want) || want.includes(x.name.toLowerCase()))
  if (!m) throw new Error(`No meme template called "${template}"`)
  const out = to.replace(/\.\w+$/, m.url.match(/\.(\w+)$/)?.[0] ?? '.jpg')
  await save(m.url, out)
  return { file: out, w: m.width, h: m.height }
}

// ---------- stock clips: Pexels or Pixabay (free keys) ----------
async function stock(query: string, to: string, keys: { pexels?: string; pixabay?: string }) {
  if (keys.pexels) {
    const j = await getJson<{ videos: { user: { name: string }; url: string; video_files: { link: string; width: number; height: number; file_type: string }[] }[] }>(
      `https://api.pexels.com/videos/search?per_page=5&orientation=landscape&query=${encodeURIComponent(query)}`,
      { Authorization: keys.pexels }
    )
    const v = j.videos[0]
    const f = v?.video_files.filter((x) => x.file_type === 'video/mp4' && x.width <= 1920).sort((a, b) => b.width - a.width)[0]
    if (f) return { file: await save(f.link, to.replace(/\.\w+$/, '.mp4')), w: f.width, h: f.height, credit: `Video by ${v.user.name} on Pexels` }
  }
  if (keys.pixabay) {
    const j = await getJson<{ hits: { user: string; videos: Record<string, { url: string; width: number; height: number }> }[] }>(`https://pixabay.com/api/videos/?key=${keys.pixabay}&per_page=5&q=${encodeURIComponent(query)}`)
    const v = j.hits[0]
    const f = v && (v.videos.medium ?? v.videos.large ?? v.videos.small)
    if (f?.url) return { file: await save(f.url, to.replace(/\.\w+$/, '.mp4')), w: f.width, h: f.height, credit: `Video by ${v.user} on Pixabay` }
  }
  // No key, or nothing found: Wikimedia Commons has free clips too.
  return commons(query, to, true)
}

// ---------- the user's own links ----------
const secs = (t: string) => t.split(':').reduce((s, x) => s * 60 + Number(x), 0)
async function userClip(link: string, from: string, to: string, out: string) {
  const yt = await ensureYtDlp(() => {})
  const file = out.replace(/\.\w+$/, '.mp4')
  const r = await run(yt, ['--no-warnings', '--no-playlist', '--ffmpeg-location', dirname(ffmpegPath()), '-f', 'bv*[height<=1080]+ba/b[height<=1080]/b', '--merge-output-format', 'mp4', '--download-sections', `*${secs(from)}-${secs(to)}`, '--force-keyframes-at-cuts', '-o', file, link])
  if (!existsSync(file)) throw new Error('Could not get the clip: ' + r.stderr.split('\n').filter(Boolean).slice(-1)[0])
  return { file, credit: `Clip from ${link}` }
}

/** Clips the user asked for in their direction: "https://… 1:20-1:28". */
export function linksIn(text: string) {
  return [...text.matchAll(/(https?:\/\/\S+?)[\s,]+(?:from\s+)?(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:-|–|to)\s*(\d{1,2}:\d{2}(?::\d{2})?)/g)].map((m) => ({ link: m[1], from: m[2], to: m[3] }))
}

/**
 * Fetches one planned shot into the project's public/m folder. Code needs nothing fetched. A shot that cannot be
 * fetched returns null (the part is drawn without it), never stops the video.
 */
export async function fetchShot(s: Shot, dir: string, name: string, keys: { pexels?: string; pixabay?: string }): Promise<MediaItem | null> {
  // One stubborn page or download never holds up the video.
  let timer: NodeJS.Timeout | undefined
  const limit = new Promise<null>((resolve) => (timer = setTimeout(() => resolve(null), s.kind === 'clip' || s.kind === 'stock' ? 180_000 : 60_000)))
  return Promise.race([fetchShotNow(s, dir, name, keys), limit]).finally(() => clearTimeout(timer))
}

async function fetchShotNow(s: Shot, dir: string, name: string, keys: { pexels?: string; pixabay?: string }): Promise<MediaItem | null> {
  const base = join(dir, 'public', 'm', name)
  const rel = (file: string) => `m/${file.split(/[\\/]/).pop()}`
  try {
    switch (s.kind) {
      case 'page': {
        const shot = await capture({ url: s.url! }, `${base}.png`, s.mark ?? '')
        return { kind: 'page', name: rel(`${base}.png`), w: shot.w, h: shot.h, marks: shot.marks, credit: `Screenshot of ${new URL(s.url!).host}`, note: s.why }
      }
      case 'tweet': {
        const shot = await captureTweet(s.url!, `${base}.png`)
        return { kind: 'tweet', name: rel(`${base}.png`), w: shot.w, h: shot.h, credit: shot.credit, note: s.why }
      }
      case 'photo': {
        const got = await commons(s.query!, `${base}.jpg`)
        return { kind: 'photo', name: rel(got.file), w: got.w, h: got.h, credit: got.credit, note: s.query }
      }
      case 'meme': {
        const got = await meme(s.template!, `${base}.jpg`)
        return { kind: 'meme', name: rel(got.file), w: got.w, h: got.h, top: s.top, bottom: s.bottom, note: s.template }
      }
      case 'stock': {
        const got = await stock(s.query!, `${base}.mp4`, keys)
        return { kind: 'clip', name: rel(got.file), w: got.w, h: got.h, credit: got.credit, note: s.query }
      }
      case 'clip': {
        const got = await userClip(s.link!, s.from ?? '0:00', s.to ?? '0:05', `${base}.mp4`)
        return { kind: 'clip', name: rel(got.file), credit: got.credit, note: s.why }
      }
      case 'code':
        return { kind: 'code', name: '', lang: s.lang, code: s.code, file: s.file, note: s.why }
      default:
        return null
    }
  } catch (e) {
    console.warn(`Media "${s.kind}" for ${name} skipped:`, (e as Error).message)
    return null
  }
}
