import { describe, expect, it } from 'vitest'

describe('suggestions are fixed too', () => {
  it('a part with only "could be better" notes is sent to the fix with them', async () => {
    const { autoFixNote } = await import('../src/main/services/job/checkRules')
    const part = { index: 2, checks: { ok: true, notes: [], minor: ['The caption sits over the cable, generic for "nobody can listen in"'], at: 1 } } as never
    const note = autoFixNote({} as never, part, false)
    expect(note).toContain('nobody can listen in')
    expect(note).toContain('suggests improvements')
  })
})

describe('scripts in simple English', () => {
  it('flags hard words in a script', async () => {
    const { lintScript } = await import('../src/main/services/scriptCraft')
    const out = lintScript('Attackers utilize clandestine radios. It is simple.', 0).join(' ')
    expect(out).toContain('"utilize"')
    expect(out).toContain('"clandestine"')
    expect(lintScript('The cable leaks. A cheap radio hears it.', 0).join(' ')).not.toContain('simple everyday words')
  })
})

describe('upload text for more views', () => {
  it('drops hashtags and keeps tags within YouTube limits', async () => {
    const { stripHashtags, fitTags } = await import('../src/main/services/publish')
    expect(stripHashtags('Hook line.\n\nChapters\n0:00 Start\n\n#FAA #GroundStop #RetryStorm\n#Networking')).toBe('Hook line.\n\nChapters\n0:00 Start')
    expect(stripHashtags('A #1 bug.')).toBe('A #1 bug.')
    const tags = fitTags(['#FAA', 'faa', 'retry storm', ...Array.from({ length: 60 }, (_, i) => `long search phrase number ${i}`)])
    expect(tags[0]).toBe('FAA')
    expect(tags).not.toContain('faa')
    expect(tags.join(',').length).toBeLessThanOrEqual(480)
  })
  it('a script ends on a sign-off, never a tease of another video', async () => {
    const { lintScript } = await import('../src/main/services/scriptCraft')
    const good = 'The cable leaks. Nobody broke in. Thanks for watching, see you in the next one.'
    expect(lintScript(good, 0, true).join(' ')).not.toMatch(/sign-off|teases|fades out/)
    const tease = "Why is the backup the thing that takes you down? That's the next video. Nobody broke in."
    expect(lintScript(tease, 0, true).join(' ')).toContain('teases another video')
    expect(lintScript(tease, 0, true).join(' ')).toContain('End with a short sign-off')
    expect(lintScript('It leaks. So there you have it. Thanks for watching.', 0, true).join(' ')).toContain('fades out')
  })
})

describe('upload text, the edge cases', () => {
  it('drops hashtags after the last words too, but keeps a #1', async () => {
    const { stripHashtags } = await import('../src/main/services/publish')
    expect(stripHashtags('Why retries made it worse. #FAA #RetryStorm')).toBe('Why retries made it worse.')
    expect(stripHashtags('It is now #1')).toBe('It is now #1')
  })
  it('counts the quotes YouTube adds to phrase tags, and skips only the tag that does not fit', async () => {
    const { fitTags } = await import('../src/main/services/publish')
    const tags = fitTags([...Array.from({ length: 40 }, (_, i) => `search phrase ${i}`), 'jitter'])
    const youtube = tags.map((t) => (/\s/.test(t) ? `"${t}"` : t)).join(',').length
    expect(youtube).toBeLessThanOrEqual(500)
    expect(fitTags(['a'.repeat(495), 'jitter'])).toEqual(['jitter'])
  })
})
