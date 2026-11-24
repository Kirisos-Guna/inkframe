import { useEffect, useState } from 'react'
import { OPENROUTER_DEFAULT } from '@shared/openrouter'

let cached: string[] | null = null

/** The free OpenRouter models that can do the app's work, read live from OpenRouter once per session. */
export function useFreeModels(extra?: string) {
  const [list, setList] = useState<string[]>(cached ?? [OPENROUTER_DEFAULT])
  useEffect(() => {
    if (cached) return
    window.api.openrouter
      .models()
      .then((m) => {
        cached = m.length ? m.map((x) => x.id) : [OPENROUTER_DEFAULT]
        setList(cached)
      })
      .catch(() => {})
  }, [])
  // A model chosen earlier that is no longer listed still shows, so the choice is not silently lost.
  return extra && !list.includes(extra) ? [extra, ...list] : list
}
