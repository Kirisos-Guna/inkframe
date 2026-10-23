import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { exportsOf, fixImports, LIBRARY_NAMES, type Offered } from '../src/main/services/sceneFix'

const kit = (f: string) => exportsOf(readFileSync(join(__dirname, '..', 'remotion', 'kit', f), 'utf8'))
const offered: Offered = [['@kit', kit('index.tsx')], ['@kit/three', kit('three.tsx')], ['@kit/thumb', kit('thumb.tsx')], ...LIBRARY_NAMES]

describe('fixImports', () => {
  it('reads the kit exports, including re-exports', () => {
    expect(offered[0][1]).toEqual(expect.arrayContaining(['Board', 'Draw', 'shape', 'useScene', 'interpolate', 'AbsoluteFill']))
    expect(offered[1][1]).toEqual(expect.arrayContaining(['Stage3D', 'THREE']))
  })

  it('adds kit names that are used but not imported', () => {
    const src = `import { useScene, Board } from '@kit'

export default function Scene() {
  const { at } = useScene()
  return (
    <Board>
      <Draw d={shape.rect(0, 0, 10, 10)} start={at('a')} dur={20} />
      <Pop start={4} x={1} y={2}><Write text="hi" x={1} y={1} start={0} /></Pop>
    </Board>
  )
}
`
    const out = fixImports(src, offered)
    const names = out.match(/import \{([^}]*)\} from '@kit'/)![1].split(',').map((s) => s.trim())
    expect(names.sort()).toEqual(['Board', 'Draw', 'Pop', 'Write', 'shape', 'useScene'].sort())
    expect(out.match(/from '@kit'/g)).toHaveLength(1)
  })

  it('adds React and Remotion imports, and generic calls count as use', () => {
    const src = `import { Board } from '@kit'
export default function Scene() {
  const n = useState<number>(0)
  const { fps } = useVideoConfig()
  return <Board />
}
`
    const out = fixImports(src, offered)
    expect(out).toMatch(/^import \{ useState \} from 'react'$/m)
    expect(out).toMatch(/^import \{ useVideoConfig \} from 'remotion'$/m)
  })

  it('leaves names alone that are declared, imported elsewhere, or only in strings and comments', () => {
    const src = `import { Board } from '@kit'
import * as K from 'somewhere'
const Pop = () => null
// <Draw /> is mentioned in a comment
export default function Scene() {
  const label = '<Write text="x" />'
  return <Board><Pop /></Board>
}
`
    expect(fixImports(src, offered)).toBe(src)
  })

  it('adds a missing default export', () => {
    expect(fixImports(`import { Board } from '@kit'\nexport function Scene() { return <Board /> }\n`, offered)).toContain('export default function Scene')
    expect(fixImports(`import { Board } from '@kit'\nconst Scene = () => <Board />\n`, offered)).toMatch(/export default Scene\n$/)
  })
})
