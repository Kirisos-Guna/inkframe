import { describe, expect, it } from 'vitest'
import type { Project } from '../src/shared/types'
import { linksIn } from '../src/main/services/realMedia'
import { mediaCredits } from '../src/main/services/job/mediaPlan'

describe('clips from the direction', () => {
  it('reads a link with the seconds wanted, in the ways people write it', () => {
    expect(linksIn('Use https://youtu.be/abc 1:20-1:28 for the launch, and https://x.com/v/1 from 0:05 to 0:09.')).toEqual([
      { link: 'https://youtu.be/abc', from: '1:20', to: '1:28' },
      { link: 'https://x.com/v/1', from: '0:05', to: '0:09' }
    ])
    expect(linksIn('https://www.youtube.com/watch?v=x1 1:02:10 – 1:02:15')).toEqual([{ link: 'https://www.youtube.com/watch?v=x1', from: '1:02:10', to: '1:02:15' }])
  })

  it('ignores links without times', () => {
    expect(linksIn('See https://example.com for more.')).toEqual([])
  })
})

describe('media credits', () => {
  it('lists each licence credit once, and not screenshots or posts', () => {
    const p = {
      media: {
        a: [{ kind: 'photo', name: 'm/1.jpg', credit: 'Jensen.jpg by X, CC BY 4.0, via Wikimedia Commons' }, { kind: 'page', name: 'm/2.png', credit: 'Screenshot of nvidia.com' }],
        b: [{ kind: 'photo', name: 'm/3.jpg', credit: 'Jensen.jpg by X, CC BY 4.0, via Wikimedia Commons' }, { kind: 'tweet', name: 'm/4.png', credit: 'Post by Elon Musk on X' }, { kind: 'clip', name: 'm/5.mp4', credit: 'Video by Ana on Pexels' }]
      }
    } as unknown as Project
    expect(mediaCredits(p)).toEqual(['Jensen.jpg by X, CC BY 4.0, via Wikimedia Commons', 'Video by Ana on Pexels'])
  })
})
