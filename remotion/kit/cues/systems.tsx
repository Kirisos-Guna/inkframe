// Stand-in for '@kit/systems' when finding sound cues: each block notes when it appears, moves or types.
import React from 'react'
import { useCue } from './record'
import { useScene } from './kit'

type Kids = { children?: React.ReactNode }
export const SIGNAL = { cyan: '#4cc4d6', amber: '#f6b73c', pink: '#f0569a', purple: '#9b7cf0', orange: '#e8873a' } as const
export const useIn = () => 1

const appears = (strength: number) =>
  function Block({ start = 0, children }: Kids & { start?: number; [k: string]: unknown }) {
    useCue('pop', start, undefined, strength)
    return <>{children}</>
  }
export const Panel = appears(0.5)
export const Browser = appears(0.7)
export const Server = appears(0.7)
export const Layer = appears(0.5)
export const Pill = appears(0.8)
export const Slot = appears(0.5)
export const Steps = appears(0.8)
export const SectionTitle = appears(0.7)

export function Terminal({ lines = [], start = 0, cps = 30 }: { lines: string[]; start?: number; cps?: number; [k: string]: unknown }) {
  const { fps } = useScene()
  useCue('pop', start, undefined, 0.6)
  useCue('typing', start + 8, (lines.join('').length / Math.max(1, cps)) * fps)
  return null
}
export function Connector({ start = 0, dur = 18 }: { start?: number; dur?: number; [k: string]: unknown }) {
  useCue('whoosh', start, dur, 0.45)
  return null
}
export function Packet({ start = 0, dur = 30 }: { start?: number; dur?: number; [k: string]: unknown }) {
  useCue('whoosh', start, dur, 0.7)
  return null
}
export function Message({ start = 0, dur = 16 }: { start?: number; dur?: number; [k: string]: unknown }) {
  useCue('whoosh', start, dur, 0.5)
  return null
}
export function Focus({ children }: Kids & { start: number; end?: number }) {
  return <>{children}</>
}
