// Captions: lines from the heard words, as SRT/VTT files and as drawtext filters that FFmpeg burns into the video.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { inflateSync } from 'zlib'
import type { CaptionStyle, Project, Word } from '../../shared/types'

export type Line = NonNullable<Project['captionLines']>[number]

/** Groups words into short lines: at most ~7 words / 34 characters, breaking at punctuation and pauses. */
export function linesFromWords(words: Word[]): Line[] {
  const out: Line[] = []
  let cur: Word[] = []
  const flush = () => {
    if (!cur.length) return
    out.push({ start: cur[0].start, end: cur[cur.length - 1].end, text: cur.map((w) => w.w).join(' '), words: cur.map((w) => ({ ...w })) })
    cur = []
  }
  for (const [i, w] of words.entries()) {
    const prev = words[i - 1]
    const text = cur.map((x) => x.w).join(' ')
    if (cur.length && (cur.length >= 7 || text.length + w.w.length > 34 || (prev && w.start - prev.end > 0.6))) flush()
    cur.push(w)
    if (/[.!?;:]$/.test(w.w) || (/,$/.test(w.w) && cur.length >= 3)) flush()
  }
  flush()
  return out
}

const ts = (s: number, sep: ',' | '.') => {
  const ms = Math.max(0, Math.round(s * 1000))
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const sec = Math.floor((ms % 60000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}${sep}${String(ms % 1000).padStart(3, '0')}`
}

export const toSrt = (lines: Line[]) => lines.map((l, i) => `${i + 1}\n${ts(l.start, ',')} --> ${ts(l.end, ',')}\n${l.text}\n`).join('\n')
export const toVtt = (lines: Line[]) => 'WEBVTT\n\n' + lines.map((l) => `${ts(l.start, '.')} --> ${ts(l.end, '.')}\n${l.text}\n`).join('\n')

// ---------- burned-in captions ----------
// Drawn with FFmpeg's drawtext from a bundled font *file* (Inter), so they look the same on every PC. System font
// matching (libass) is skipped on purpose: font overrides on some PCs replace every font by name.

/** WOFF 1.0 → TrueType: the same tables, inflated, under an sfnt header (FreeType needs TTF/OTF here). */
export function woffToTtf(w: Buffer) {
  const flavor = w.readUInt32BE(4)
  const n = w.readUInt16BE(12)
  const tables: { tag: number; sum: number; data: Buffer }[] = []
  for (let i = 0; i < n; i++) {
    const o = 44 + i * 20
    const off = w.readUInt32BE(o + 4)
    const comp = w.readUInt32BE(o + 8)
    const orig = w.readUInt32BE(o + 12)
    const raw = w.subarray(off, off + comp)
    tables.push({ tag: w.readUInt32BE(o), sum: w.readUInt32BE(o + 16), data: comp < orig ? inflateSync(raw) : Buffer.from(raw) })
  }
  let es = 0
  while (1 << (es + 1) <= n) es++
  const sr = (1 << es) * 16
  const head = Buffer.alloc(12 + 16 * n)
  head.writeUInt32BE(flavor, 0)
  head.writeUInt16BE(n, 4)
  head.writeUInt16BE(sr, 6)
  head.writeUInt16BE(es, 8)
  head.writeUInt16BE(n * 16 - sr, 10)
  let off = head.length
  const bodies: Buffer[] = []
  tables.forEach((t, i) => {
    const o = 12 + i * 16
    head.writeUInt32BE(t.tag, o)
    head.writeUInt32BE(t.sum, o + 4)
    head.writeUInt32BE(off, o + 8)
    head.writeUInt32BE(t.data.length, o + 12)
    const pad = (4 - (t.data.length % 4)) % 4
    bodies.push(t.data, Buffer.alloc(pad))
    off += t.data.length + pad
  })
  return Buffer.concat([head, ...bodies])
}

/** Advance widths from a TrueType font (cmap format 4 + hmtx), to lay words out exactly as drawtext will. */
export function fontMetrics(ttf: Buffer) {
  const n = ttf.readUInt16BE(4)
  const table = (tag: string) => {
    for (let i = 0; i < n; i++) {
      const o = 12 + i * 16
      if (ttf.toString('latin1', o, o + 4) === tag) return ttf.readUInt32BE(o + 8)
    }
    throw new Error('font table missing: ' + tag)
  }
  const unitsPerEm = ttf.readUInt16BE(table('head') + 18)
  const numH = ttf.readUInt16BE(table('hhea') + 34)
  const hmtx = table('hmtx')
  const cmap = table('cmap')
  let sub = -1
  for (let i = 0; i < ttf.readUInt16BE(cmap + 2); i++) {
    const r = cmap + 4 + i * 8
    const o = cmap + ttf.readUInt32BE(r + 4)
    if (ttf.readUInt16BE(r) === 3 && ttf.readUInt16BE(r + 2) === 1 && ttf.readUInt16BE(o) === 4) sub = o
  }
  if (sub < 0) throw new Error('font has no Unicode BMP cmap')
  const segX2 = ttf.readUInt16BE(sub + 6)
  const ends = sub + 14
  const starts = ends + segX2 + 2
  const deltas = starts + segX2
  const ranges = deltas + segX2
  const glyph = (c: number) => {
    for (let i = 0; i < segX2 / 2; i++) {
      if (c > ttf.readUInt16BE(ends + i * 2)) continue
      const start = ttf.readUInt16BE(starts + i * 2)
      if (c < start) return 0
      const delta = ttf.readInt16BE(deltas + i * 2)
      const ro = ttf.readUInt16BE(ranges + i * 2)
      if (!ro) return (c + delta) & 0xffff
      const g = ttf.readUInt16BE(ranges + i * 2 + ro + (c - start) * 2)
      return g ? (g + delta) & 0xffff : 0
    }
    return 0
  }
  const adv = (g: number) => ttf.readUInt16BE(hmtx + Math.min(g, numH - 1) * 4)
  /** Width of `text` in pixels at `size`. */
  return (text: string, size: number) => {
    let u = 0
    for (const ch of text) u += adv(glyph(ch.codePointAt(0)!))
    return (u / unitsPerEm) * size
  }
}

const hexColour = (h: string) => '0x' + h.replace('#', '').slice(0, 6)

/**
 * drawtext filters for every caption line, to be chained with commas. Text goes in small files (textfile=), so no
 * caption ever needs escaping. Karaoke: spoken words turn the accent colour. Bold pop: the word being said is the
 * accent. Clean: whole lines that fade in and out.
 */
export function captionFilters(lines: Line[], style: Exclude<CaptionStyle, 'Off'>, o: { W: number; H: number; accent: string; workDir: string }) {
  const k = o.H / 1080
  const bold = style !== 'Clean'
  const fontRel = bold ? 'fonts/inter-800.ttf' : 'fonts/inter-600.ttf'
  const measure = fontMetrics(readFileSync(join(o.workDir, fontRel)))
  const base = (bold ? (style === 'Bold pop' ? 76 : 68) : 56) * k
  const marginV = (style === 'Bold pop' ? 120 : style === 'Karaoke' ? 100 : 70) * k
  const border = Math.max(1, Math.round((bold ? 6 : 3) * k))
  const capsDir = join(o.workDir, 'caps')
  rmSync(capsDir, { recursive: true, force: true })
  mkdirSync(capsDir, { recursive: true })
  let n = 0
  const textFile = (text: string) => {
    const f = `caps/${n++}.txt`
    writeFileSync(join(o.workDir, f), text)
    return f
  }
  const t = (x: number) => x.toFixed(3)
  const out: string[] = []
  const draw = (file: string, size: number, x: number, y: number, colour: string, a: number, b: number, fade = false) => {
    const alpha = fade ? `:alpha='if(lt(t,${t(a + 0.12)}),(t-${t(a)})/0.12,if(gt(t,${t(b - 0.12)}),(${t(b)}-t)/0.12,1))'` : ''
    out.push(
      `drawtext=fontfile=${fontRel}:textfile=${file}:fontsize=${size.toFixed(1)}:fontcolor=${colour}:borderw=${border}:bordercolor=0x000000:x=${x.toFixed(1)}:y='${y.toFixed(1)}-ascent':enable='between(t,${t(a)},${t(b)})'${alpha}`
    )
  }
  for (const l of lines) {
    const end = Math.max(l.end, l.start + 0.6)
    const words = l.words.length ? l.words : [{ w: l.text, start: l.start, end }]
    const shown = words.map((w) => (style === 'Bold pop' ? w.w.toUpperCase() : w.w))
    let size = base
    let width = shown.reduce((s, w) => s + measure(w, size), 0) + measure(' ', size) * (shown.length - 1)
    if (width > o.W * 0.86) {
      size = (size * o.W * 0.86) / width
      width = o.W * 0.86
    }
    // y is the shared baseline; each word is placed by its own ascent so short words line up with tall ones.
    const y = o.H - marginV
    if (style === 'Clean') {
      draw(textFile(shown.join(' ')), size, (o.W - width) / 2, y, '0xFFFFFF', l.start, end, true)
      continue
    }
    let x = (o.W - width) / 2
    const sp = measure(' ', size)
    words.forEach((w, i) => {
      const file = textFile(shown[i])
      const ws = Math.max(l.start, Math.min(end, w.start))
      const we = Math.max(ws, Math.min(end, words[i + 1]?.start ?? end))
      if (ws > l.start) draw(file, size, x, y, '0xFFFFFF', l.start, ws)
      if (style === 'Karaoke') {
        draw(file, size, x, y, hexColour(o.accent), ws, end)
      } else {
        draw(file, size, x, y, hexColour(o.accent), ws, we)
        if (we < end) draw(file, size, x, y, '0xFFFFFF', we, end)
      }
      x += measure(shown[i], size) + sp
    })
  }
  return out
}

/** Puts the caption fonts (Inter, as TTF) in workDir/fonts. */
export function prepareCaptionFonts(workDir: string, interWoff: (weight: 600 | 800) => string) {
  mkdirSync(join(workDir, 'fonts'), { recursive: true })
  for (const w of [600, 800] as const) {
    const out = join(workDir, 'fonts', `inter-${w}.ttf`)
    if (!existsSync(out)) writeFileSync(out, woffToTtf(readFileSync(interWoff(w))))
  }
}


// ---------- captions in scripts that need shaping (Tamil and other Indian scripts) ----------
// FFmpeg's drawtext here cannot shape them: vowel signs land on the wrong side of their letter. libass can, so these
// captions are an .ass file, drawn with Windows' Nirmala UI, which has these scripts and Latin in one font.

/** Letters that need shaping: Devanagari to Malayalam (includes Tamil). */
export const needsShaping = (lines: Line[]) => lines.some((l) => /[\u0900-\u0D7F]/.test(l.text))

/** Puts the font next to the captions, so libass finds it by file. */
export function prepareShapingFont(workDir: string) {
  const from = join(process.env.SystemRoot ?? 'C:\\Windows', 'Fonts', 'Nirmala.ttc')
  const to = join(workDir, 'fonts', 'Nirmala.ttc')
  mkdirSync(join(workDir, 'fonts'), { recursive: true })
  if (existsSync(from) && !existsSync(to)) copyFileSync(from, to)
}

const assTime = (s: number) => {
  const cs = Math.max(0, Math.round(s * 100))
  const h = Math.floor(cs / 360000)
  const m = Math.floor((cs % 360000) / 6000)
  const sec = Math.floor((cs % 6000) / 100)
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`
}
/** ASS colours are &HBBGGRR&. */
const assColour = (hex: string) => {
  const h = hex.replace('#', '').slice(0, 6).padEnd(6, '0')
  return `&H${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}&`.toUpperCase()
}
const assText = (s: string) => s.replace(/[{}\\]/g, '').replace(/\s+/g, ' ').trim()

/**
 * The whole caption track as an .ass file. Clean: lines that fade in and out. Bold pop: the word being said is the
 * accent. Karaoke: spoken words fill with the accent. libass lays the line out, so words need no measuring.
 */
export function captionAss(lines: Line[], style: Exclude<CaptionStyle, 'Off'>, o: { W: number; H: number; accent: string }) {
  const k = o.H / 1080
  const size = Math.round((style === 'Clean' ? 56 : style === 'Bold pop' ? 72 : 66) * k)
  const margin = Math.round((style === 'Bold pop' ? 120 : style === 'Karaoke' ? 100 : 70) * k)
  const outline = Math.max(1, Math.round((style === 'Clean' ? 3 : 5) * k))
  const accent = assColour(o.accent)
  const white = '&HFFFFFF&'
  const head = `[Script Info]
ScriptType: v4.00+
PlayResX: ${o.W}
PlayResY: ${o.H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Nirmala UI,${size},${style === 'Karaoke' ? accent : white},${white},&H000000&,&H000000&,-1,0,0,0,100,100,0,0,1,${outline},0,2,${Math.round(o.W * 0.07)},${Math.round(o.W * 0.07)},${margin},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`
  const out: string[] = []
  const event = (a: number, b: number, text: string) => out.push(`Dialogue: 0,${assTime(a)},${assTime(b)},Cap,,0,0,0,,${text}`)
  for (const l of lines) {
    const end = Math.max(l.end, l.start + 0.6)
    const words = l.words.length ? l.words : [{ w: l.text, start: l.start, end }]
    if (style === 'Clean') event(l.start, end, `{\\fad(120,120)}${assText(l.text)}`)
    else if (style === 'Karaoke') {
      // \k counts in hundredths of a second, from the start of the line.
      const tags = words.map((w, i) => {
        const next = words[i + 1]?.start ?? end
        return `{\\k${Math.max(1, Math.round((next - (i ? w.start : l.start)) * 100))}}${assText(w.w)}`
      })
      event(l.start, end, tags.join(' '))
    } else {
      // One event per spoken word, with that word in the accent.
      words.forEach((w, i) => {
        const from = i ? w.start : l.start
        const to = words[i + 1]?.start ?? end
        if (to > from) event(from, to, words.map((x, j) => (j === i ? `{\\c${accent}}${assText(x.w)}{\\c${white}}` : assText(x.w))).join(' '))
      })
    }
  }
  return head + out.join('\n') + '\n'
}
