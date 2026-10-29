import { describe, expect, it } from 'vitest'
import { isLimitText, resetFromText } from '../src/main/services/limits'

describe('usage limit messages', () => {
  it('recognises the ways Claude Code and Codex say it', () => {
    for (const t of [
      "You've hit your session limit · resets 2pm",
      'Claude AI usage limit reached|1761600000',
      '5-hour limit reached ∙ resets 9pm',
      "You've hit your weekly limit",
      "You've hit your usage limit. Upgrade to Pro or try again later.",
      'API Error: 429 Too Many Requests',
      'Rate limit exceeded'
    ])
      expect(isLimitText(t), t).toBe(true)
  })

  it('does not take other errors for a limit', () => {
    for (const t of [
      'Claude Code is not signed in',
      'Part 3 does not draw: line 12: Expected ")"',
      'FFmpeg: Invalid argument',
      'The scene file is missing',
      'Text is too small'
    ])
      expect(isLimitText(t), t).toBe(false)
  })

  it('reads a reset time that is still ahead', () => {
    expect(resetFromText('usage limit reached|1761600000', 1761500000000)).toBe(1761600000000)
    expect(resetFromText('usage limit reached|1761600000', 1761700000000)).toBeUndefined()
    expect(resetFromText("You've hit your session limit · resets 2pm")).toBeUndefined()
  })
})
