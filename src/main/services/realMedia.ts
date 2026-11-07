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
import { cutOut } from './cutout'
import { readVtt } from './vtt'

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
const PAGE_SCRIPT = (mark: string, mark2 = '', tall = false) => `(() => {
  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el)
    if ((s.position === 'fixed' || s.position === 'sticky') && el.getBoundingClientRect().height < innerHeight * 0.9) el.style.setProperty('display', 'none', 'important')
    if (/cookie|consent|gdpr|newsletter|subscribe-wall|paywall/i.test((el.id || '') + ' ' + (typeof el.className === 'string' ? el.className : ''))) el.style.setProperty('display', 'none', 'important')
  }
  document.documentElement.style.overflow = 'auto'
  document.body.style.overflow = 'auto'
  const norm = (t) => t.toLowerCase().replace(/\\s+/g, ' ')
  // Finds a sentence inside one block of text (a paragraph, a list item, a heading, a cell), so a match never runs
  // across columns or into the sidebar. Not word for word is fine: most of its words in order, each close to the last.
  const locate = (raw) => {
    const want = norm(raw).trim()
    if (!want) return null
    const ws = want.split(' ').filter((w) => w.length > 2)
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
      if (score >= 0.6 && (!best || score > best.score)) best = { score, nodes, from, to, block }
    }
    if (!best) return null
    const find = (pos) => { for (let i = best.nodes.length - 1; i >= 0; i--) if (best.nodes[i][1] <= pos) return [best.nodes[i][0], Math.min(pos - best.nodes[i][1], best.nodes[i][0].nodeValue.length)] }
    const range = document.createRange()
    range.setStart(...find(best.from))
    range.setEnd(...find(best.to))
    return { range, block: best.block }
  }
  // One bar per line of text, as a highlighter would draw it.
  const bars = (range) => {
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
    return lines.map((l) => [Math.round(l.left), Math.round(l.top), Math.round(l.right - l.left), Math.round(l.bottom - l.top)])
  }
  const a = locate(${JSON.stringify(mark)})
  const b = locate(${JSON.stringify(mark2)})
  // The sentence goes to the upper third (or, in a tall capture of a long document, three quarters down, so the shot
  // can scroll to it).
  if (a) window.scrollBy(0, a.range.getBoundingClientRect().top - innerHeight * (${tall} ? 0.75 : 0.3))
  // A tight crop: the page's headline (when it is just above) and the paragraph with the sentence.
  let focus = null
  if (a) {
    const r = a.block.getBoundingClientRect()
    const h1 = document.querySelector('h1')
    const hr = h1 && h1.getBoundingClientRect()
    const top = hr && hr.bottom <= r.top && r.top - hr.top < 700 ? hr.top : r.top
    const left = Math.min(r.left, hr && top === hr.top ? hr.left : r.left)
    focus = [Math.max(0, Math.round(left - 30)), Math.max(0, Math.round(top - 30)), Math.round(Math.max(r.right, hr && top === hr.top ? hr.right : 0) - left + 60), Math.round(r.bottom - top + 60)]
  }
  return { marks: a ? bars(a.range) : [], marks2: b ? bars(b.range) : [], focus }
})()`

/** The code of an example on a docs page: the <pre> block that contains `contains` (or the first one). */
const CODE_SCRIPT = (contains: string) => `(() => {
  const want = ${JSON.stringify(contains)}.toLowerCase()
  const blocks = [...document.querySelectorAll('pre')].map((p) => p.innerText.replace(/\\u00a0/g, ' ').trimEnd()).filter((t) => t.length > 10)
  const hit = blocks.find((t) => want && t.toLowerCase().includes(want)) ?? blocks[0]
  const el = [...document.querySelectorAll('pre')].find((p) => p.innerText.trimEnd() === hit)
  const cls = (el && (el.className + ' ' + (el.querySelector('code')?.className ?? ''))) || ''
  return { code: hit ?? '', lang: (cls.match(/language-(\\w+)/) || [])[1] ?? '' }
})()`

type Rect = [number, number, number, number]

/**
 * A screenshot of a page (or of HTML), with where `mark` (and `mark2`) are on it and a tight crop around the headline
 * and that paragraph. `tall` captures a long stretch of the page, for a shot that scrolls down to the sentence.
 */
async function capture(
  target: { url?: string; html?: string },
  to: string,
  mark = '',
  wait = 2500,
  opt: { crop?: string; uiFont?: boolean; mark2?: string; tall?: boolean; code?: string } = {}
) {
  const height = opt.tall ? H * 3 : H
  const win = new BrowserWindow({ show: false, width: W, height, webPreferences: { offscreen: false, javascript: true, sandbox: true, images: true } })
  try {
    win.webContents.setUserAgent(UA)
    win.webContents.setAudioMuted(true)
    if (opt.tall) win.setContentSize(W, height)
    const load = target.url ? win.loadURL(target.url) : win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(target.html!))
    // A redirect or a slow resource can fail the first load while the page itself shows fine: what it draws decides.
    await Promise.race([load.catch(() => {}), sleep(25000)])
    await sleep(wait)
    // Some PCs replace the system fonts by name: embeds (which use the system font) get Inter instead, in every frame.
    if (opt.uiFont) {
      const css = `@font-face{font-family:InkUI;src:url(data:font/woff2;base64,${readFileSync(interFont()).toString('base64')}) format('woff2');font-weight:100 900}*{font-family:InkUI,sans-serif!important}`
      for (const fr of win.webContents.mainFrame.framesInSubtree)
        await fr.executeJavaScript(`(()=>{const s=document.createElement('style');s.textContent=${JSON.stringify(css)};document.documentElement.appendChild(s)})()`).catch(() => {})
      await sleep(600)
    }
    // A docs page's code example, read as text (no picture needed).
    if (opt.code !== undefined) {
      const code = (await win.webContents.executeJavaScript(CODE_SCRIPT(opt.code), true).catch(() => ({ code: '', lang: '' }))) as { code: string; lang: string }
      return { w: 0, h: 0, marks: [] as Rect[], marks2: [] as Rect[], focus: undefined, code }
    }
    const found = (await win.webContents.executeJavaScript(PAGE_SCRIPT(mark, opt.mark2, opt.tall), true).catch(() => ({ marks: [], marks2: [], focus: null }))) as { marks: Rect[]; marks2: Rect[]; focus: Rect | null }
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
    const px = (r: Rect) => r.map((v) => Math.round(v * k)) as Rect
    return { w: size.width, h: size.height, marks: found.marks.map(px), marks2: found.marks2.map(px), focus: found.focus ? px(found.focus) : undefined, code: undefined }
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
async function stock(query: string, to: string, keys: { pexels?: string; pixabay?: string; quotes?: boolean }) {
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

// ---------- real numbers: stock prices, package downloads, repository stats ----------
/** What a chart file holds (public/m/*.json), read by the Chart and Stats blocks. */
export interface ChartData {
  title: string
  unit?: string
  points?: [number, number][]
  last?: number
  change?: number
  stats?: { label: string; value: number }[]
  source: string
}

async function chartData(s: Shot): Promise<ChartData> {
  if (s.source === 'price') {
    const range = s.range ?? '1y'
    const interval = { '1mo': '1d', '6mo': '1d', '1y': '1wk', '2y': '1wk', '5y': '1mo' }[range] ?? '1wk'
    const j = await getJson<{ chart: { result: { meta: { symbol: string; currency: string; regularMarketPrice: number }; timestamp: number[]; indicators: { quote: { close: (number | null)[] }[] } }[] } }>(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s.symbol!)}?range=${range}&interval=${interval}`,
      { 'User-Agent': UA }
    )
    const r = j.chart.result[0]
    const points = r.timestamp.map((t, i) => [t * 1000, r.indicators.quote[0].close[i]] as [number, number | null]).filter((p): p is [number, number] => p[1] !== null)
    const first = points[0]?.[1] ?? 0
    const last = r.meta.regularMarketPrice ?? points[points.length - 1]?.[1]
    return { title: s.label ?? `${r.meta.symbol} stock`, unit: r.meta.currency === 'USD' ? '$' : r.meta.currency, points, last, change: first ? (last - first) / first : 0, source: 'Yahoo Finance' }
  }
  if (s.source === 'npm') {
    const j = await getJson<{ downloads: { day: string; downloads: number }[] }>(`https://api.npmjs.org/downloads/range/last-year/${encodeURIComponent(s.package!)}`)
    // Weekly sums: daily numbers jump around too much to read.
    const weeks: [number, number][] = []
    j.downloads.forEach((d, i) => {
      if (i % 7 === 0) weeks.push([Date.parse(d.day), 0])
      weeks[weeks.length - 1][1] += d.downloads
    })
    const first = weeks[0]?.[1] ?? 0
    const last = weeks[weeks.length - 2]?.[1] ?? 0
    return { title: s.label ?? `${s.package} weekly downloads`, points: weeks.slice(0, -1), last, change: first ? (last - first) / first : 0, source: 'npm' }
  }
  if (s.source === 'github') {
    const j = await getJson<{ full_name: string; stargazers_count: number; forks_count: number; open_issues_count: number; subscribers_count?: number }>(`https://api.github.com/repos/${s.repo}`, { Accept: 'application/vnd.github+json' })
    return { title: s.label ?? j.full_name, stats: [{ label: 'stars', value: j.stargazers_count }, { label: 'forks', value: j.forks_count }, { label: 'open issues', value: j.open_issues_count }], source: 'GitHub' }
  }
  throw new Error(`Unknown chart source "${s.source}"`)
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

// ---------- a real person saying the line (opt-in: clips of other channels can be claimed) ----------
const words = (t: string) => t.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean)

/**
 * Where in the captions (readVtt lines) the words are said: the run of lines that holds most of them in order (at
 * least 60%), from the second its first line starts to the second the line after its last starts.
 */
export function locateQuote(cues: { t: number; text: string }[], says: string) {
  const want = words(says)
  if (!want.length) return null
  let best: { from: number; to: number; score: number } | null = null
  for (let i = 0; i < cues.length; i++) {
    const got: string[] = []
    for (let j = i; j < cues.length && cues[j].t - cues[i].t < 20; j++) {
      got.push(...words(cues[j].text))
      if (got.length < want.length * 0.8) continue
      let k = 0
      for (const w of got) if (k < want.length && w === want[k]) k++
      // Words in order, over how many were needed and how many extra were heard.
      const score = k / want.length - Math.max(0, got.length - want.length * 1.5) * 0.01
      if (!best || score > best.score) best = { from: cues[i].t, to: cues[j + 1]?.t ?? cues[j].t + 3, score }
      if (got.length > want.length * 2) break
    }
  }
  return best && best.score >= 0.6 ? best : null
}

/** Finds a video of the person saying it (a YouTube search), reads its captions and cuts out just those seconds. */
async function quoteClip(s: Shot, out: string) {
  const yt = await ensureYtDlp(() => {})
  const found = await run(yt, ['--no-warnings', '--flat-playlist', '--print', '%(id)s\t%(channel)s', `ytsearch4:${s.query ?? `${s.who} ${s.says}`}`])
  const ids = String(found.stdout).split('\n').map((l) => l.split('\t')).filter((x) => x[0]?.length === 11)
  // The official channel first (one the search names: Stanford, Nvidia, Lex Fridman), not a re-upload.
  const asked = words(s.query ?? s.who ?? '')
  const official = (c = '') => (words(c).some((w) => w.length > 2 && asked.includes(w)) ? 0 : 1)
  ids.sort((a, b) => official(a[1]) - official(b[1]))
  for (const [id, channel] of ids.slice(0, 3)) {
    // Each candidate's captions in their own file, so a later one never reads an earlier one's.
    const subs = `${out.replace(/\.\w+$/, '')}-${id}`
    await run(yt, ['--no-warnings', '--skip-download', '--write-subs', '--write-auto-subs', '--sub-langs', 'en.*,en', '--sub-format', 'vtt', '-o', subs, `https://www.youtube.com/watch?v=${id}`])
    const vtt = [`${subs}.en.vtt`, `${subs}.en-US.vtt`, `${subs}.en-orig.vtt`].find(existsSync)
    if (!vtt) continue
    const at = locateQuote(readVtt(readFileSync(vtt, 'utf8')), s.says ?? '')
    if (!at) continue
    const from = Math.max(0, at.from - 0.3)
    const to = Math.min(at.to + 0.4, from + 9)
    const got = await userClip(`https://www.youtube.com/watch?v=${id}`, from.toFixed(1), to.toFixed(1), out)
    return { ...got, credit: `${s.who ?? 'Quote'}, from "${channel}" on YouTube (https://youtu.be/${id})` }
  }
  throw new Error(`No video found where ${s.who ?? 'they'} says it`)
}

/** Clips the user asked for in their direction: "https://… 1:20-1:28". */
export function linksIn(text: string) {
  return [...text.matchAll(/(https?:\/\/\S+?)[\s,]+(?:from\s+)?(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:-|–|to)\s*(\d{1,2}:\d{2}(?::\d{2})?)/g)].map((m) => ({ link: m[1], from: m[2], to: m[3] }))
}

/**
 * Fetches one planned shot into the project's public/m folder. Code needs nothing fetched. A shot that cannot be
 * fetched returns null (the part is drawn without it), never stops the video.
 */
export async function fetchShot(s: Shot, dir: string, name: string, keys: { pexels?: string; pixabay?: string; quotes?: boolean }): Promise<MediaItem | null> {
  // One stubborn page or download never holds up the video.
  let timer: NodeJS.Timeout | undefined
  const limit = new Promise<null>((resolve) => (timer = setTimeout(() => resolve(null), s.kind === 'clip' || s.kind === 'stock' || s.kind === 'quote' ? 180_000 : 60_000)))
  return Promise.race([fetchShotNow(s, dir, name, keys), limit]).finally(() => clearTimeout(timer))
}

async function fetchShotNow(s: Shot, dir: string, name: string, keys: { pexels?: string; pixabay?: string; quotes?: boolean }): Promise<MediaItem | null> {
  const base = join(dir, 'public', 'm', name)
  const rel = (file: string) => `m/${file.split(/[\\/]/).pop()}`
  try {
    switch (s.kind) {
      case 'page': {
        const shot = await capture({ url: s.url! }, `${base}.png`, s.mark ?? '', 2500, { mark2: s.mark2, tall: s.scroll })
        return { kind: 'page', name: rel(`${base}.png`), w: shot.w, h: shot.h, marks: shot.marks, marks2: shot.marks2, focus: shot.focus, credit: `Screenshot of ${new URL(s.url!).host}`, note: s.why }
      }
      case 'doccode': {
        // The real example from the official docs, shown in the editor.
        const got = await capture({ url: s.url! }, `${base}.png`, '', 2000, { code: s.contains ?? '' })
        if (!got.code?.code) throw new Error('No code example on that page')
        return { kind: 'code', name: '', lang: got.code.lang || s.lang || 'ts', code: got.code.code.split('\n').slice(0, 16).join('\n'), file: s.file, credit: `Code from ${new URL(s.url!).host}`, note: s.why }
      }
      case 'tweet': {
        const shot = await captureTweet(s.url!, `${base}.png`)
        return { kind: 'tweet', name: rel(`${base}.png`), w: shot.w, h: shot.h, credit: shot.credit, note: s.why }
      }
      case 'photo': {
        const got = await commons(s.query!, `${base}.jpg`)
        // A sticker: the person (or the logo on white) lifted out, on this PC.
        let cut: string | undefined
        if (s.cutout) cut = await cutOut(got.file, `${base}-cut.png`, /logo|icon|wordmark/i.test(s.query!) ? 'white' : 'person').then(rel, () => undefined)
        return { kind: 'photo', name: rel(got.file), w: got.w, h: got.h, cut, credit: got.credit, note: s.query }
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
      case 'quote': {
        if (!keys.quotes) return null
        const got = await quoteClip(s, `${base}.mp4`)
        return { kind: 'clip', name: rel(got.file), credit: got.credit, note: `${s.who}: "${s.says}"` }
      }
      case 'chart': {
        const data = await chartData(s)
        mkdirSync(dirname(base), { recursive: true })
        writeFileSync(`${base}.json`, JSON.stringify(data))
        return { kind: 'chart', name: rel(`${base}.json`), credit: `Data: ${data.source}`, note: data.title }
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
