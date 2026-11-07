import { describe, expect, it } from 'vitest'
import type { Part, Project } from '../src/shared/types'
import { readFinalLog, readPartLog } from '../src/main/services/job/finalCheck'
import { faultNote, saidAround } from '../src/main/services/job/checks'

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

describe('pace', () => {
  const cut = (t: number) => `[Parsed_showinfo_3 @ 0] n:0 pts:0 pts_time:${t}`
  it('notes a slow video in a fast style', () => {
    const log = `${ok}\n${[4, 10, 17, 22].map(cut).join('\n')}`
    expect(readFinalLog(log, p, 2.5).join(' ')).toMatch(/A shot lasts 5\.\d s on average/)
  })
  it('a fast video, or a style without a pace, has no note', () => {
    const log = `${ok}\n${Array.from({ length: 12 }, (_, i) => cut(i * 2 + 1)).join('\n')}`
    expect(readFinalLog(log, p, 2.5)).toEqual([])
    expect(readFinalLog(`${ok}\n${cut(10)}`, p)).toEqual([])
  })
})

describe('checking one rendered part', () => {
  const black = '[blackdetect @ 0x1] black_start:4.8 black_end:8.4 black_duration:3.6\n'
  // FFmpeg's metadata=print lines for each change of picture, with its score.
  const cuts = (ts: number[], score = 0.4) =>
    ts.map((t) => `[Parsed_metadata_2 @ 0x2] frame:0    pts:1   pts_time:${t}\n[Parsed_metadata_2 @ 0x2] lavfi.scene_score=${score}`).join('\n')
  it('finds black stretches', () => {
    expect(readPartLog(black, 12)).toEqual([{ kind: 'black', at: 4.8, dur: 3.6 }])
  })
  it('finds shots held too long in the fast styles, but not the ones that are black', () => {
    expect(readPartLog(cuts([2, 4, 8.5]), 10, 3.5)).toEqual([{ kind: 'long', at: 4, dur: 4.5 }])
    expect(readPartLog(black + cuts([2, 4.8, 8.4]), 10, 3.5)).toEqual([{ kind: 'black', at: 4.8, dur: 3.6 }])
  })
  it('flags a part cut too fast to read, but not one quick punch', () => {
    expect(readPartLog(cuts([2, 2.6, 3.2, 3.8, 7]), 10, 7)).toEqual([{ kind: 'fast', at: 2, dur: 3 }])
    expect(readPartLog(cuts([3, 3.6, 7]), 10, 7)).toEqual([])
  })
  it('counts a faint cut between two dark shots, but not as a flash', () => {
    // Part 3 of a test video: three dark shots whose cuts score only 0.1 to 0.2.
    expect(readPartLog(cuts([3.33, 6.67], 0.1), 10, 7)).toEqual([])
    expect(readPartLog(cuts([2, 2.5, 3, 3.5], 0.12), 10, 7)).toEqual([])
  })
  it('says where it is and what is said there', () => {
    const p = { words: [{ w: 'every', start: 102, end: 102.3 }, { w: 'cut', start: 102.3, end: 102.6 }] } as unknown as Project
    const x = { start: 100, end: 110 } as unknown as Part
    const note = faultNote(p, x, { kind: 'black', at: 1.5, dur: 1 })
    expect(note).toContain('black for 1.0 s from 1.5 s')
    expect(note).toContain('every cut')
  })
})
