import { describe, expect, it } from 'vitest'
import { extractJson } from '../src/shared/json'

describe('extractJson', () => {
  it('reads a fenced block', () => {
    expect(extractJson('Here you go:\n```json\n{"ok": true, "notes": []}\n```')).toEqual({ ok: true, notes: [] })
  })
  it('reads bare JSON after prose', () => {
    expect(extractJson<{ parts: unknown[] }>('Plan: {"parts": [{"start": 0, "end": 9.5}]} done').parts).toHaveLength(1)
  })
  it('ignores braces inside strings', () => {
    expect(extractJson<{ t: string }>('{"t": "a } b { c"}').t).toBe('a } b { c')
  })
  it('reads an array', () => {
    expect(extractJson('[1, [2, 3]]')).toEqual([1, [2, 3]])
  })
  it('fails on cut-off JSON', () => {
    expect(() => extractJson('{"a": 1')).toThrow(/cut off/)
  })
  it('fails when there is no JSON', () => {
    expect(() => extractJson('no json here')).toThrow(/no JSON/)
  })
})
