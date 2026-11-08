// Small layout helpers for the kit, with no React, so they can be tested.

export type Rect = { x0: number; y0: number; x1: number; y1: number }
type Pt = [number, number]

const inside = (p: Pt, r: Rect) => p[0] > r.x0 && p[0] < r.x1 && p[1] > r.y0 && p[1] < r.y1

/** Where the line from p towards q leaves the rectangle p is in, plus a small gap. */
function exitPoint(p: Pt, q: Pt, r: Rect, gap: number): Pt {
  const dx = q[0] - p[0]
  const dy = q[1] - p[1]
  const len = Math.hypot(dx, dy) || 1
  const ts = [dx > 0 ? (r.x1 - p[0]) / dx : dx < 0 ? (r.x0 - p[0]) / dx : Infinity, dy > 0 ? (r.y1 - p[1]) / dy : dy < 0 ? (r.y0 - p[1]) / dy : Infinity]
  const t = Math.min(...ts)
  if (!isFinite(t)) return p
  return [p[0] + dx * t + (dx / len) * gap, p[1] + dy * t + (dy / len) * gap]
}

/**
 * An arrow between boxes, from edge to edge: an end that lands inside a box (a designer often aims at the box's
 * centre) is moved to where the arrow leaves that box, so the line never runs through the box's label.
 */
export function clipToBoxes(from: Pt, to: Pt, boxes: Rect[], gap = 14): { from: Pt; to: Pt } {
  const a = boxes.find((r) => inside(from, r))
  const b = boxes.find((r) => inside(to, r))
  let f = from
  let t = to
  if (a && a !== b) f = exitPoint(from, to, a, gap)
  if (b && a !== b) t = exitPoint(to, from, b, gap)
  return { from: f, to: t }
}
