// Stand-in for '@kit/remix' when finding sound cues: a whoosh on every cut, typing for code and terminals, a pen for
// the highlighter and the drawn circle, pops for things that appear.
import React, { useContext } from 'react'
import { CutStart, FrameCtx, useCue } from './record'
import { flashFree } from '../flash'

type Kids = { children?: React.ReactNode }
type Any = { start?: number; [k: string]: unknown }

export function Cuts({ at, children, whip = false }: { at: number[]; whip?: boolean } & Kids) {
  // The same shots as the real kit shows: flashes under 0.8 s are left out.
  const { fps, dur } = useContext(FrameCtx)
  const shots = flashFree(React.Children.toArray(children), at, dur, Math.round(fps * 0.8))
  shots.forEach(({ from }, i) => i > 0 && useCue(whip ? 'whip' : 'whoosh', from, 10, 0.5))
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
  at.forEach((f) => useCue('boom', f, undefined, 0.6))
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
  items.forEach((_, i) => useCue('whoosh', start + i * every, 22, 0.35))
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
  if (marks.length) useCue('pen', start + markAt, 18 + marks.length * 8, 0.6)
  return null
}
export function Code({ code = '', start = 0, cps = 45 }: Any & { code?: string; cps?: number }) {
  // Typed in at most 1.2 s, as in the real kit.
  useCue('typing', start + 4, Math.min(code.length / cps, 1.2) * 30)
  return null
}
export function Shell({ command = '', start = 0, cps = 30 }: Any & { command?: string; cps?: number }) {
  useCue('typing', start + 4, Math.min(command.length / cps, 0.6) * 30)
  return null
}
export function Flow({ start = 0 }: Any) {
  useCue('whoosh', start, 14, 0.35)
  return null
}
export function Circle({ start = 0 }: Any) {
  useCue('pen', start, 14, 0.7)
  return null
}
export function Split({ left, right, start = 0 }: Any & { left?: React.ReactNode; right?: React.ReactNode }) {
  useCue('whoosh', start, 10, 0.4)
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
export function Chart({ start = 0, dur = 40 }: Any & { dur?: number }) {
  useCue('whoosh', start, dur, 0.4)
  useCue('count', start + dur * 0.6, dur * 0.4, 0.5)
  return null
}
export function Stats({ start = 0, every = 10 }: Any & { every?: number }) {
  ;[0, 1, 2].forEach((i) => useCue('count', start + i * every, 24, 0.5))
  return null
}
