// Stand-in for '@kit/remix' when finding sound cues: a whoosh on every cut, typing for code and terminals, a pen for
// the highlighter and the drawn circle, pops for things that appear.
import React from 'react'
import { useCue } from './record'
import { Sequence } from './remotion'

type Kids = { children?: React.ReactNode }
type Any = { start?: number; [k: string]: unknown }

export function Cuts({ at, children }: { at: number[] } & Kids) {
  at.forEach((f, i) => i > 0 && useCue('whoosh', f, 10, 0.5))
  return (
    <>
      {React.Children.toArray(children).map((c, i) => (
        <Sequence key={i} from={at[i] ?? 0}>
          {c}
        </Sequence>
      ))}
    </>
  )
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
export const Caption = pop(0.5)
export const Box = pop(0.6)
export const Hand = pop(0.5)
export const TitleCard = pop(0.8)
export function Page({ start = 0, markAt = 18, marks = [] }: Any & { markAt?: number; marks?: unknown[] }) {
  if (marks.length) useCue('pen', start + markAt, 18 + marks.length * 8, 0.6)
  return null
}
export function Code({ code = '', start = 0, cps = 45 }: Any & { code?: string; cps?: number }) {
  useCue('typing', start + 8, (code.length / cps) * 30)
  return null
}
export function Shell({ command = '', start = 0, cps = 30 }: Any & { command?: string; cps?: number }) {
  useCue('typing', start + 8, (command.length / cps) * 30)
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
