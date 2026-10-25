import { describe, expect, it } from 'vitest'
import { readVtt } from '../src/main/services/vtt'

describe('readVtt', () => {
  it('reads YouTube auto captions without the rolling repeats', () => {
    // How YouTube serves auto captions: each new line is first shown word by word, then repeated above the next one.
    const vtt = `WEBVTT
Kind: captions
Language: en

00:00:00.320 --> 00:00:02.990 align:start position:0%

so<00:00:00.640><c> here</c><00:00:00.880><c> we</c><00:00:01.040><c> are</c>

00:00:02.990 --> 00:00:03.000 align:start position:0%
so here we are


00:00:03.000 --> 00:00:05.110 align:start position:0%
so here we are
in<00:00:03.360><c> front</c><00:00:03.600><c> of</c><00:00:03.760><c> the</c><00:00:04.000><c> elephants</c>

00:00:05.110 --> 00:00:05.120 align:start position:0%
in front of the elephants


00:01:05.120 --> 00:01:07.000 align:start position:0%
in front of the elephants
the cool thing &amp; that's it
`
    expect(readVtt(vtt)).toEqual([
      { t: 0, text: 'so here we are' },
      { t: 3, text: 'in front of the elephants' },
      { t: 65, text: "the cool thing & that's it" }
    ])
  })

  it('reads plain uploaded subtitles', () => {
    const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:03.000
First line.

2
00:00:03.500 --> 00:00:06.000
Second line,
in two rows.
`
    expect(readVtt(vtt).map((l) => l.text)).toEqual(['First line.', 'Second line,', 'in two rows.'])
  })
})
