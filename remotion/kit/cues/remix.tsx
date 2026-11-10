// Stand-in for '@kit/remix' when finding sound cues, Fireship style: hard cuts are silent, a whip or glitch gets its
// swish, a pen for the highlighter, pops for stickers and things that appear on their beat.
import React, { useContext } from 'react'
import { CutStart, FrameCtx, useCue } from './record'
import { flashFree } from '../flash'

type Kids = { children?: React.ReactNode }
type Any = { start?: number; [k: string]: unknown }

export function Cuts({ at, children, whip = false, fx }: { at: number[]; whip?: boolean; fx?: string[] } & Kids) {
  // The same shots as the real kit shows: flashes under 0.8 s are left out.
  const { fps, dur } = useContext(FrameCtx)
  const shots = flashFree(React.Children.toArray(children), at, dur, Math.round(fps * 0.8))
  shots.forEach(({ from }, i) => {
    const how = i === 0 ? 'cut' : fx?.[i - 1] ?? (whip ? 'whip' : 'cut')
    if (how === 'whip') useCue('whip', from, 10, 0.5)
    else if (how === 'glitch') useCue('whoosh', from, 6, 0.45)
  })
  return (
    <>
      {shots.map(({ c, from }, i) => (
        <CutStart.Provider key={i} value={from}>
          {c}
        </CutStart.Provider>
      ))}
    </>
  )
}
export function Punch({ at = [], children }: { at?: number[] } & Kids) {
  at.forEach((f) => useCue('boom', f))
  return <>{children}</>
}
export function Shake({ at = [], children }: { at?: number[] } & Kids) {
  at.forEach((f) => useCue('boom', f))
  return <>{children}</>
}
export function FreezeFrame({ at = 0, children }: { at?: number } & Kids) {
  useCue('scratch', at)
  return <>{children}</>
}
const pop = (strength: number) =>
  function Block({ start = 0 }: Any) {
    useCue('pop', start, undefined, strength)
    return null
  }
export const Shot = () => null
export const Clip = () => null
export const Post = pop(0.7)
export const Meme = pop(0.9)
export function Timeline({ items = [], start = 0, every = 24, at }: Any & { items?: unknown[]; every?: number; at?: number[] }) {
  items.forEach((_, i) => useCue('pop', at?.[i] ?? start + i * every, undefined, 0.6))
  return null
}
export function Bars({ items = [], start = 0, every = 26 }: Any & { items?: unknown[]; every?: number }) {
  items.forEach((_, i) => useCue('pop', start + i * every, undefined, 0.5))
  return null
}
export const Gif = pop(0.9)
export function Diagram({ children }: Kids) {
  return <>{children}</>
}
export const Caption = pop(0.5)
export const Box = pop(0.6)
export const Hand = pop(0.5)
export const TitleCard = pop(0.8)
export const Sticker = pop(0.9)
export const Label = pop(0.5)
export function Page({ start = 0, markAt = 18, marks = [] }: Any & { markAt?: number; marks?: unknown[] }) {
  if (marks.length) useCue('pen', start + markAt, 12, 0.6)
  return null
}
// Code and terminals are shown whole (no typing), so they make no sound of their own.
export const Code = () => null
export const Shell = () => null
export const Quote = pop(0.5)
export const Flow = pop(0.35)
export const Circle = pop(0.6)
export function Split({ left, right }: Any & { left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <>
      {left}
      {right}
    </>
  )
}
export function Loop({ items = [], start = 0, every = 8 }: Any & { items?: unknown[]; every?: number }) {
  items.forEach((_, k) => useCue('pop', start + k * every, undefined, 0.4))
  return null
}
export const Chart = pop(0.5)
export function Stats({ start = 0, every = 10 }: Any & { every?: number }) {
  ;[0, 1, 2].forEach((i) => useCue('pop', start + i * every, undefined, 0.5))
  return null
}
export const Dots = pop(0.5)
export function Compare({ rows = [], start = 0, every = 16 }: Any & { rows?: unknown[]; every?: number }) {
  rows.forEach((_, i) => useCue('pop', start + 10 + i * every, undefined, 0.45))
  return null
}
export function Stack({ layers = [], start = 0, every = 12 }: Any & { layers?: unknown[]; every?: number }) {
  layers.forEach((_, k) => useCue('pop', start + k * every, undefined, 0.5))
  return null
}
export function Pipeline({ steps = [], start = 0, every = 22 }: Any & { steps?: unknown[]; every?: number }) {
  steps.forEach((_, i) => i > 0 && useCue('pop', start + 8 + (i - 1) * every, undefined, 0.4))
  return null
}
export function Tree({ branches = [], start = 0, every = 14 }: Any & { branches?: unknown[]; every?: number }) {
  useCue('pop', start, undefined, 0.6)
  branches.forEach((_, i) => useCue('pop', start + 10 + i * every, undefined, 0.45))
  return null
}
export function Magnify({ start = 0 }: Any) {
  useCue('pop', start + 14, undefined, 0.6)
  return null
}
