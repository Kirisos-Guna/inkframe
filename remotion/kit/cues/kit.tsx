// Stand-in for '@kit' when finding sound cues. Same names and props as the real kit (../index.tsx); each element
// notes its moment instead of drawing. Shapes and fonts are the real ones.
import React, { createContext, useContext, useMemo } from 'react'
import type { SceneProps, SceneWord } from '../index'
import { useCue } from './record'
import { useCurrentFrame } from './remotion'

export { shape, hand } from '../index'
export type { SceneProps, SceneWord } from '../index'
export { AbsoluteFill, interpolate, spring, useCurrentFrame, Easing } from './remotion'

type Kids = { children?: React.ReactNode }

const Ctx = createContext<SceneProps | null>(null)
export const SceneProvider = Ctx.Provider

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{M}\p{N}']/gu, '')

/** As in the real kit, so at('word') gives the same frames. */
export function useScene() {
  const p = useContext(Ctx)!
  const frame = useCurrentFrame()
  return useMemo(() => {
    const fps = p.fps
    const words: SceneWord[] = p.words.map((w) => ({ w: w.w, start: Math.round(w.start * fps), end: Math.round(w.end * fps) }))
    const at = (word: string, nth = 1, fallback?: number) => {
      const target = norm(word)
      let seen = 0
      for (const w of words) {
        if (norm(w.w) === target || (target.length > 3 && norm(w.w).startsWith(target))) {
          seen++
          if (seen === nth) return w.start
        }
      }
      return fallback ?? Math.round(p.frames * 0.3)
    }
    const material = (name: string) => p.material.find((m) => m === name || m.toLowerCase().includes(name.toLowerCase()))
    return { ...p, frame, fps, dur: p.frames, words, at, material, palette: p.style.palette, font: 'Inter' }
  }, [p, frame])
}

export function Board({ children }: Kids & { camera?: unknown }) {
  return <svg>{children}</svg>
}

export function Draw({ start = 0, dur = 30 }: { d: string; start?: number; dur?: number; [k: string]: unknown }) {
  useCue('pen', start, dur)
  return null
}

export function Write({ text = '', start = 0, dur }: { text: string; start?: number; dur?: number; [k: string]: unknown }) {
  useCue('pen', start, dur ?? Math.max(8, text.length * 1.6), 0.8)
  return null
}

export function Typewriter({ text = '', start = 0, cps = 18 }: { text: string; start?: number; cps?: number; [k: string]: unknown }) {
  const { fps } = useScene()
  useCue('typing', start, (text.length / Math.max(1, cps)) * fps)
  return null
}

export function Pop({ start = 0, children }: Kids & { start?: number; [k: string]: unknown }) {
  useCue('pop', start)
  return <>{children}</>
}

export function Fade({ children }: Kids & { [k: string]: unknown }) {
  return <>{children}</>
}

export function Move({ from, to, start = 0, dur = 30, children }: Kids & { from: [number, number]; to: [number, number]; start?: number; dur?: number }) {
  // Only moves you notice get a whoosh.
  if (from && to && Math.hypot(to[0] - from[0], to[1] - from[1]) > 120) useCue('whoosh', start, dur)
  return <>{children}</>
}

export function Travel({ start = 0, dur = 40, children }: Kids & { d: string; start?: number; dur?: number; [k: string]: unknown }) {
  useCue('whoosh', start, dur, 0.7)
  return <>{children}</>
}

export function Count({ start = 0, dur = 40 }: { to: number; start?: number; dur?: number; [k: string]: unknown }) {
  useCue('count', start, dur)
  return null
}

export function useCamera(keys: { at: number; zoom: number; x: number; y: number }[]) {
  // A clear camera move (a zoom or a pan across the board) gets a whoosh as it starts.
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1]
    const b = keys[i]
    if (Math.abs(b.zoom - a.zoom) > 0.15 || Math.hypot(b.x - a.x, b.y - a.y) > 200) useCue('whoosh', a.at, b.at - a.at, 0.8)
  }
  return keys[keys.length - 1] ?? { zoom: 1, x: 960, y: 540 }
}

export function Character({ start = 0 }: { name: string; start?: number; [k: string]: unknown }) {
  useCue('pop', start, undefined, 0.6)
  return null
}

export function Picture({ start = 0 }: { name: string; start?: number; [k: string]: unknown }) {
  useCue('pop', start, undefined, 0.8)
  return null
}

export const makeRoot = () => () => null
