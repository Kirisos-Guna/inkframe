// The parts of a video: finding one, numbering, their words, and turning a plan into parts.
import { randomUUID } from 'crypto'
import type { Comment, Part, Project } from '../../../shared/types'

export const part = (p: Project, id: string) => p.parts.find((x) => x.id === id)

export const reindex = (p: Project) => p.parts.forEach((x, i) => (x.index = i))
export const textOf = (p: Project, from: number, to: number) =>
  p.words
    .filter((w) => w.start >= from - 0.05 && w.start < to)
    .map((w) => w.w)
    .join(' ')

/** Makes the parts contiguous from 0 to the end and fills in their words. */
export function normaliseParts(p: Project, raw: { start: number; end: number; title: string; text?: string; idea?: string }[]): Part[] {
  const dur = p.voiceover?.duration ?? raw[raw.length - 1]?.end ?? 60
  const sorted = raw.filter((r) => r.end > r.start).sort((a, b) => a.start - b.start)
  if (!sorted.length) throw new Error('Claude did not return any parts')
  return sorted.map((r, i) => {
    const start = i === 0 ? 0 : sorted[i].start
    const end = i === sorted.length - 1 ? dur : sorted[i + 1].start
    return {
      id: randomUUID(),
      index: i,
      title: r.title?.slice(0, 40) || `Part ${i + 1}`,
      start,
      end,
      text: textOf(p, start, end) || r.text || '',
      idea: r.idea,
      status: 'Not designed yet',
      locked: false,
      material: [],
      history: []
    }
  })
}
