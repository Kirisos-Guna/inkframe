// Renders a scene with the stand-in kit at a few moments and returns every cue it noted.
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SceneProps } from '../index'
import { SceneProvider } from './kit'
import { FrameCtx, takeCues, type Cue } from './record'

export function run(Scene: React.ComponentType, props: SceneProps): Cue[] {
  const dur = Math.max(1, props.frames)
  // Every 10 frames and the last one: elements that only exist for part of the scene are still found.
  const frames = [...Array.from({ length: Math.ceil(dur / 10) }, (_, i) => i * 10), dur - 1]
  const seen = new Map<string, Cue>()
  takeCues()
  for (const frame of frames) {
    try {
      renderToStaticMarkup(
        <FrameCtx.Provider value={{ frame, fps: props.fps, dur }}>
          <SceneProvider value={props}>
            <Scene />
          </SceneProvider>
        </FrameCtx.Provider>
      )
    } catch {
      /* this moment does not render outside the browser: the others still count */
    }
    for (const c of takeCues()) if (c.at >= 0 && c.at < dur) seen.set(`${c.kind}:${c.at}`, c)
  }
  return [...seen.values()].sort((a, b) => a.at - b.at)
}
