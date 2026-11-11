import { describe, expect, it } from 'vitest'
import { lintScript, retentionPrompt } from '../src/main/services/scriptCraft'

const words = (n: number) => Array.from({ length: n }, (_, i) => (i % 12 === 11 ? 'word.' : 'word')).join(' ')
const good = `Your question never reaches the cloud. It walks.\n\n${words(140)}`

describe('lintScript', () => {
  it('passes a clean script of the right length', () => {
    expect(lintScript(good, 150)).toEqual([])
  })

  it('catches tired phrases, wherever they are and however they are typed', () => {
    const issues = lintScript(good.replace('It walks.', "It walks. Let's dive in. It’s important to note this."), 150)
    expect(issues.join(' ')).toContain('"let\'s dive in"')
    expect(issues.join(' ')).toContain('"it\'s important to note"')
  })

  it('catches a script that is too long or too short', () => {
    expect(lintScript(good, 300)[0]).toMatch(/must be about 300/)
    expect(lintScript(`${good} ${words(100)}`, 150)[0]).toMatch(/Cut the weakest/)
  })

  it('catches a greeting or a definition as the first sentence', () => {
    expect(lintScript(`Hi everyone, welcome back. ${words(145)}`, 150).join(' ')).toMatch(/greeting or a definition/)
    expect(lintScript(`TCP is a type of protocol that computers use. ${words(142)}`, 150).join(' ')).toMatch(/greeting or a definition/)
  })

  it('catches very long sentences and formatting', () => {
    const long = Array.from({ length: 35 }, () => 'and').join(' ') + '.'
    expect(lintScript(`It walks. ${long} ${words(110)}`, 150).join(' ')).toMatch(/Split these long sentences/)
    expect(lintScript(`It walks.\n\n# Part one\n\n${words(145)}`, 150).join(' ')).toMatch(/headings/)
    expect(lintScript(`It walks. [music swells] ${words(145)}`, 150).join(' ')).toMatch(/stage directions/)
  })
})

describe('lintScript, the house voice', () => {
  it('wants sentences of at most 20 words (simple English)', () => {
    const ok = Array.from({ length: 19 }, () => 'and').join(' ') + '.'
    const long = Array.from({ length: 22 }, () => 'and').join(' ') + '.'
    expect(lintScript(`It walks. ${ok} ${words(120)}`, 150).join(' ')).not.toMatch(/Split these long sentences/)
    expect(lintScript(`It walks. ${long} ${words(120)}`, 150).join(' ')).toMatch(/Split these long sentences/)
  })
})

describe('lintScript, the thread', () => {
  const opening = 'Five hours, three agents, and the token limit hits. You cannot explain a line you shipped.'
  it('catches a beat that opens on a new subject with no bridge', () => {
    const issues = lintScript(`${opening}\n\nNow meet Chris Wellons, skeeto on GitHub.\n\nHere's the secret: it's fun.`, 0)
    expect(issues.some((i) => i.includes('open cold') && i.includes('Now meet') && i.includes("Here's the secret"))).toBe(true)
  })
  it('lets bridged beats through', () => {
    expect(lintScript(`${opening}\n\nSo who still writes code by hand? Chris Wellons does.\n\nBut here is why it pays.`, 0).filter((i) => i.includes('open cold'))).toEqual([])
  })
  it('catches a line that talks down to the viewer', () => {
    expect(lintScript(`${opening} Fine, you don't care.`, 0).some((i) => i.includes('talks down'))).toBe(true)
  })
})

describe('the editor pass', () => {
  it('asks for the jumps and the thread, with the local findings and the house voice', () => {
    const p = retentionPrompt('A script.', ['It is 10 words; it must be about 300.'], 300)
    expect(p).toContain('Jumps')
    expect(p).toContain('It is 10 words')
    expect(p).toContain('THE HOUSE VOICE')
    expect(p).toContain('CHAIN')
    expect(p).toContain('Stay at about 300 words')
    expect(p).toContain('THE THREAD')
  })
})
