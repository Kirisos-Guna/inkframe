import { useEffect, useState } from 'react'
import { OPENCODE_DEFAULT } from '@shared/opencode'

let cached: { list: string[]; at: number } | null = null
/** How long a read list is reused: short, so a free model OpenCode has just released shows up straight away. */
const FRESH = 2 * 60_000

/** The free models of the OpenCode desktop app, read from its console tool every time a picker opens. */
export function useOpenCodeModels(extra?: string) {
  const [list, setList] = useState<string[]>(cached?.list ?? [OPENCODE_DEFAULT])
  useEffect(() => {
    if (cached && Date.now() - cached.at < FRESH) return
    window.api.opencode
      .models()
      .then((m) => {
        cached = { list: m.length ? m : [OPENCODE_DEFAULT], at: Date.now() }
        setList(cached.list)
      })
      .catch(() => {})
  }, [])
  // A model chosen earlier that is no longer listed still shows, so the choice is not silently lost.
  return extra && extra.startsWith('opencode/') && !list.includes(extra) ? [extra, ...list] : list
}
