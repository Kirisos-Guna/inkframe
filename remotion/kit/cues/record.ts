// Sound cues: the stand-in kit in this folder renders a scene in Node (no browser) and notes, for every element,
// when it appears, moves, is drawn or typed. The app turns those moments into sound effects. No AI is involved.
import { createContext, useContext } from 'react'

export type CueKind = 'pop' | 'whoosh' | 'pen' | 'typing' | 'count'
export interface Cue {
  kind: CueKind
  /** Frame in the part. */
  at: number
  /** Length in frames, for sounds that last (drawing, typing, counting). */
  dur?: number
  /** 0..1, for quieter versions (a character stepping in pops softer than a big reveal). */
  strength?: number
}

let cues: Cue[] = []

export const FrameCtx = createContext({ frame: 0, fps: 30, dur: 1 })
/** Frames added by enclosing <Sequence from>. */
export const SeqOffset = createContext(0)

export function useCue(kind: CueKind, at: number, dur?: number, strength = 1) {
  const off = useContext(SeqOffset)
  if (Number.isFinite(at)) cues.push({ kind, at: Math.round(at + off), dur: dur && Number.isFinite(dur) ? Math.round(dur) : undefined, strength })
}

export function takeCues() {
  const c = cues
  cues = []
  return c
}
