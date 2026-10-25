// Captions files (WebVTT), as YouTube serves them.

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .trim()

/**
 * The lines of a .vtt with the second each one starts. Read line by line (a cue may contain blank lines). Auto captions
 * repeat each line as they roll: a line that was just shown is not taken again.
 */
export function readVtt(vtt: string) {
  const out: { t: number; text: string }[] = []
  let t: number | null = null
  let last = ''
  for (const raw of vtt.split(/\r?\n/)) {
    const m = raw.match(/^\s*(?:(\d+):)?(\d+):(\d+)[.,]\d+\s+-->/)
    if (m) {
      t = (m[1] ? +m[1] * 3600 : 0) + +m[2] * 60 + +m[3]
      continue
    }
    // Before the first cue: the header (WEBVTT, Kind, Language). A cue number on its own line is not text either.
    if (t === null || /^\d+$/.test(raw.trim())) continue
    const line = decode(raw)
    if (!line || line === last) continue
    out.push({ t, text: line })
    last = line
  }
  return out
}
