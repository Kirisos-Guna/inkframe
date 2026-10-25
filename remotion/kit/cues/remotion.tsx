// Stand-in for 'remotion' when finding sound cues: the pure helpers are the real ones, the frame comes from FrameCtx.
import React, { useContext } from 'react'
import { FrameCtx, SeqOffset } from './record'

export * from 'remotion-real'

export const useCurrentFrame = () => useContext(FrameCtx).frame - useContext(SeqOffset)
export const useVideoConfig = () => {
  const f = useContext(FrameCtx)
  return { fps: f.fps, width: 1920, height: 1080, durationInFrames: f.dur, id: 'Part', defaultProps: {}, props: {}, defaultCodec: null }
}
/** Children of a Sequence are always rendered here, so cues inside one are found whatever the frame. */
export const Sequence = ({ from = 0, children }: { from?: number; children?: React.ReactNode }) => (
  <SeqOffset.Provider value={useContext(SeqOffset) + from}>{children}</SeqOffset.Provider>
)
export const Series = Object.assign(({ children }: { children?: React.ReactNode }) => <>{children}</>, { Sequence })
export const Freeze = ({ children }: { children?: React.ReactNode }) => <>{children}</>
export const AbsoluteFill = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
export const Img = () => null
export const Audio = () => null
export const Video = () => null
export const OffthreadVideo = () => null
export const staticFile = (s: string) => s
export const delayRender = () => 0
export const continueRender = () => {}
