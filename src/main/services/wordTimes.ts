// When each word is said, as exactly as possible: the pictures cut on these times, so a word that is 0.4 s off is a
// picture that is 0.4 s off. No Electron here, so it can be tested.
import type { Word } from '../../shared/types'

/**
 * Moves word boundaries onto the pauses heard in the audio. Whisper often puts the boundary between two words a few
 * tenths of a second into the silence (or past it); a pause is always between words, so the word before ends where
 * the pause starts and the word after starts where it ends. `pauses` are [start, end] in seconds.
 */
export function snapToPauses(words: Word[], pauses: [number, number][]): Word[] {
  const out = words.map((w) => ({ ...w }))
  for (const [s0, s1] of pauses) {
    if (s1 - s0 < 0.08) continue
    // The boundary nearest to the pause, within reach of it.
    let best = -1
    let bestD = Infinity
    for (let i = 1; i < out.length; i++) {
      const b = out[i].start
      if (b < s0 - 0.45 || b > s1 + 0.75) continue
      const d = b < s0 ? s0 - b : b > s1 ? b - s1 : 0
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    if (best < 0) continue
    const prev = out[best - 1]
    const next = out[best]
    // Never past the words around it.
    if (s0 <= prev.start + 0.05 || (out[best + 1] && s1 >= out[best + 1].start - 0.05)) continue
    prev.end = Math.min(prev.end, s0)
    next.start = s1
    if (next.end < next.start + 0.05) next.end = next.start + 0.05
  }
  return out
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

/** How alike two words are, 0..1 (by their letters). */
function alike(a: string, b: string) {
  if (a === b) return 1
  if (!a || !b) return 0
  const m = a.length
  const n = b.length
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return 1 - prev[n] / Math.max(m, n)
}

/**
 * Puts the script's own spelling on the heard words ("Chris Wellens" heard, "Chris Wellons" written; "L-feed" and
 * "Elfeed"), keeping when each was said. Words lined up by their letters; a written word that was not heard on its own
 * shares the time of its neighbour. When the script is not what was spoken (under half the words line up), the heard
 * words are kept as they are.
 */
export function fitToScript(heard: Word[], script: string): Word[] {
  const written = script.split(/\s+/).filter((w) => norm(w))
  const a = heard.map((w) => norm(w.w))
  const b = written.map(norm)
  const m = a.length
  const n = b.length
  if (!m || !n || n > 20000 || m > 20000) return heard
  // Lining up (edit distance on words): 0 for the same word, less than 1 for a near spelling, 1 to skip a word.
  const W = n + 1
  const cost = new Float32Array((m + 1) * W)
  const move = new Uint8Array((m + 1) * W) // 1 diagonal, 2 skip a heard word, 3 skip a written word
  for (let i = 1; i <= m; i++) (cost[i * W] = i), (move[i * W] = 2)
  for (let j = 1; j <= n; j++) (cost[j] = j), (move[j] = 3)
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const sim = alike(a[i - 1], b[j - 1])
      const d = cost[(i - 1) * W + j - 1] + (sim === 1 ? 0 : sim > 0.5 ? 1 - sim : 1.2)
      const u = cost[(i - 1) * W + j] + 1
      const l = cost[i * W + j - 1] + 1
      const k = i * W + j
      if (d <= u && d <= l) (cost[k] = d), (move[k] = 1)
      else if (u <= l) (cost[k] = u), (move[k] = 2)
      else (cost[k] = l), (move[k] = 3)
    }
  }
  // Walk back: which heard word each written word belongs to.
  const pairs: { i: number; j: number }[] = []
  let i = m
  let j = n
  let same = 0
  while (i > 0 || j > 0) {
    const mv = move[i * W + j]
    if (i > 0 && j > 0 && mv === 1) {
      if (a[i - 1] === b[j - 1]) same++
      pairs.push({ i: --i, j: --j })
    } else if (i > 0 && (j === 0 || mv === 2)) pairs.push({ i: --i, j: -1 })
    else pairs.push({ i: -1, j: --j })
  }
  if (same < Math.min(m, n) * 0.5) return heard
  pairs.reverse()
  const out: Word[] = []
  // A heard word with no written word ("W64" of "W64 DevKit" for "w64devkit"): its time joins the next written word
  // when together they spell it better, otherwise the word before.
  let skipped: number[] = []
  const settle = (next?: { i: number; j: number }) => {
    if (!skipped.length) return null
    const first = heard[skipped[0]]
    const last = heard[skipped[skipped.length - 1]]
    const joined = skipped.map((k) => a[k]).join('')
    skipped = []
    if (next && (!out.length || alike(joined + a[next.i], b[next.j]) > alike(a[next.i], b[next.j]))) return first.start
    if (out.length) out[out.length - 1].end = last.end
    else return first.start
    return null
  }
  for (const p of pairs) {
    if (p.j >= 0 && p.i >= 0) {
      const h = heard[p.i]
      const start = settle(p)
      out.push({ w: written[p.j], start: start ?? h.start, end: h.end })
    } else if (p.i >= 0) {
      skipped.push(p.i)
    } else {
      settle()
      // A written word not heard on its own ("W64 DevKit" heard as one): it shares its neighbour's time.
      const last = out[out.length - 1]
      const t = last ? last.end : heard[0].start
      out.push({ w: written[p.j], start: t, end: t })
    }
  }
  settle()
  // Words that share a time get a share of it, so each one has its own moment.
  for (let k = 0; k < out.length; ) {
    let e = k + 1
    while (e < out.length && out[e].start === out[e].end && out[e].start === out[k].end) e++
    if (e - k > 1) {
      const from = out[k].start
      const to = out[k].end
      const step = (to - from) / (e - k)
      for (let q = k; q < e; q++) {
        out[q].start = +(from + step * (q - k)).toFixed(3)
        out[q].end = +(from + step * (q - k + 1)).toFixed(3)
      }
    }
    k = e
  }
  return out
}
