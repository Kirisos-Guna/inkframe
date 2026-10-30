import { describe, expect, it } from 'vitest'
import { lintScript } from '../src/main/services/scriptCraft'

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
