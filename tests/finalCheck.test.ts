import { describe, expect, it } from 'vitest'
import type { Project } from '../src/shared/types'
import { readFinalLog } from '../src/main/services/job/finalCheck'
import { saidAround } from '../src/main/services/job/checks'

const p = {
  voiceover: { duration: 26 },
  parts: [
    { index: 0, start: 0, end: 9 },
    { index: 1, start: 9, end: 18 },
    { index: 2, start: 18, end: 26 }
  ],
  words: [
    { w: 'You', start: 0.1, end: 0.3 },
    { w: 'hit', start: 0.4, end: 0.6 },
    { w: 'send.', start: 0.7, end: 1 },
    { w: 'Radio', start: 10, end: 10.4 },
    { w: 'waves.', start: 10.5, end: 11 }
  ]
} as unknown as Project

const ok = `  Duration: 00:00:26.05, start: 0.000000, bitrate: 700 kb/s
  Stream #0:1(und): Audio: aac (LC), 48000 Hz, mono
[Parsed_volumedetect_2 @ 0] max_volume: -3.2 dB`

describe('final video check', () => {
  it('a good video has no notes', () => {
    expect(readFinalLog(ok, p)).toEqual([])
  })

  it('reports black frames, freezes, silence and a wrong length, with the part', () => {
    const log = `  Duration: 00:00:31.00, start: 0.000000
  Stream #0:1(und): Audio: aac (LC), 48000 Hz, mono
[blackdetect @ 0] black_start:12.5 black_end:13.7 black_duration:1.2
[freezedetect @ 0] lavfi.freezedetect.freeze_start: 19.0
[freezedetect @ 0] lavfi.freezedetect.freeze_duration: 9.5
[Parsed_volumedetect_2 @ 0] max_volume: -60.0 dB`
    expect(readFinalLog(log, p)).toEqual([
      'Black picture for 1.2 s at 0:12 (part 2)',
      'The picture does not move for 10 s from 0:19 (part 3)',
      'The sound is (almost) silent',
      'The video is 31.0 s long, the voiceover 26.0 s'
    ])
  })

  it('notices a missing sound track', () => {
    expect(readFinalLog('  Duration: 00:00:26.00, start: 0', p)).toContain('The video has no sound track')
  })
})

describe('what is said at a moment', () => {
  it('takes the words of the last 3 seconds', () => {
    expect(saidAround(p, 1)).toBe('You hit send.')
    expect(saidAround(p, 11)).toBe('Radio waves.')
    expect(saidAround(p, 6)).toBe('')
  })
})
