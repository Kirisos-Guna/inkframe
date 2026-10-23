// Small fixes to a scene's code that need no agent (kept free of Electron, so it can be tested on its own).

/** Module name and the names it offers, e.g. ['@kit', ['Board', 'Draw', ...]]. */
export type Offered = [string, string[]][]

/** The names a module's source exports. */
export function exportsOf(src: string) {
  const out = [...src.matchAll(/export\s+(?:function|const|class)\s+(\w+)/g)].map((m) => m[1])
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) out.push(...m[1].split(',').map((s) => s.trim().split(/\s+as\s+/).pop()!).filter(Boolean))
  return out
}

/** React's and Remotion's own names that scenes use without the kit re-exporting them. */
export const LIBRARY_NAMES: Offered = [
  ['react', ['useMemo', 'useState', 'useRef', 'useEffect', 'useLayoutEffect', 'useCallback', 'Fragment']],
  ['remotion', ['Sequence', 'useVideoConfig', 'random', 'interpolateColors', 'Img', 'staticFile', 'Series', 'Freeze']]
]

/**
 * Fixes the two slips that most often break a scene: a name that is used but not imported (from the kit, React or
 * Remotion), and a missing default export. Returns the code unchanged when neither applies.
 */
export function fixImports(src: string, offered: Offered) {
  // The code without comments and strings, to see which names it really uses.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/(['"`])(?:\\.|(?!\1)[^\\\n])*\1/g, '""')
  const known = new Set<string>()
  for (const m of code.matchAll(/import\s+([\s\S]*?)\s+from\s*""/g))
    for (const n of m[1].replace(/[{}*]/g, ',').split(',')) {
      const name = n.trim().split(/\s+as\s+/).pop()
      if (name) known.add(name)
    }
  for (const m of code.matchAll(/\b(?:function|const|let|var|class)\s+(\w+)/g)) known.add(m[1])
  for (const m of code.matchAll(/\b(?:const|let|var)\s*[{[]([^}\]=]*)[}\]]\s*=/g))
    for (const n of m[1].split(',')) {
      const name = n.split(':').pop()!.split('=')[0].trim()
      if (name) known.add(name)
    }
  const body = code.replace(/^\s*import\s[\s\S]*?from\s*""\s*$/gm, '')
  // Used as a JSX tag (<Pop ...>), a call (spring(...), useState<number>(0)) or an object (shape.rect, THREE.Shape).
  const used = (n: string) => new RegExp(`<${n}[\\s/>]|(?<![\\w.$])${n}\\s*(?:<[^<>()]*>)?\\s*[(.]`).test(body)
  let out = src
  const taken = new Set(known)
  for (const [mod, names] of offered) {
    const missing = names.filter((n) => !taken.has(n) && used(n))
    if (!missing.length) continue
    missing.forEach((n) => taken.add(n))
    const existing = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${mod.replace('/', '\\/')}['"]`)
    out = existing.test(out)
      ? out.replace(existing, (_m, list: string) => `import { ${[...list.split(',').map((s) => s.trim()).filter(Boolean), ...missing].join(', ')} } from '${mod}'`)
      : `import { ${missing.join(', ')} } from '${mod}'\n` + out
  }
  if (!/export\s+default\b/.test(out)) {
    if (/export\s+function\s+Scene\b/.test(out)) out = out.replace(/export\s+function\s+Scene\b/, 'export default function Scene')
    else if (/(?:function|const)\s+Scene\b/.test(out)) out += '\nexport default Scene\n'
  }
  return out
}
