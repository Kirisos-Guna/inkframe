// Stand-in for '@kit/three' when finding sound cues: the 3D world itself is not built, only its moments are noted.
import React from 'react'
import * as THREE from 'three'
import { useCue } from './record'
import { interpolate, useCurrentFrame } from './remotion'

export { THREE }
export type Vec3 = [number, number, number]
export interface CameraKey {
  at: number
  pos: Vec3
  look?: Vec3
  fov?: number
}

export function Stage3D({ camera = [] }: { camera?: CameraKey[]; children?: React.ReactNode; [k: string]: unknown }) {
  for (let i = 1; i < camera.length; i++) {
    const [a, b] = [camera[i - 1].pos, camera[i].pos]
    if (Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) > 2) useCue('whoosh', camera[i - 1].at, camera[i].at - camera[i - 1].at, 0.7)
  }
  return null
}

export function useProgress(start: number, dur = 20) {
  const frame = useCurrentFrame()
  return interpolate(frame, [start, start + Math.max(1, dur)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
}

export function usePop(start: number) {
  useCue('pop', start)
  return 1
}

export const Paper = () => null
export const Clay = () => null
export const Glow = () => null
export const LineBox = () => null
export const PaperPlane = () => null
