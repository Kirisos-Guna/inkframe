import { create } from 'zustand'
import type { AppSettings, Project, Status, StyleDef } from '@shared/types'

export type Route =
  | { name: 'home' }
  | { name: 'styles'; tab?: 'Library' | 'My styles' | 'Learn from a video' }
  | { name: 'settings' }
  | { name: 'editor'; id: string }

interface AppState {
  route: Route
  go: (r: Route) => void
  projects: Project[]
  styles: StyleDef[]
  settings?: AppSettings
  status?: Status
  toast?: { text: string; at: number; error?: boolean }
  showToast: (text: string) => void
  /** An error, in plain words, shown as an error and long enough to read; the status is checked again (sign-in). */
  showError: (e: unknown) => void
  refresh: () => Promise<void>
  upsertProject: (p: Project) => void
}

export const useApp = create<AppState>((set, get) => ({
  route: { name: 'home' },
  go: (route) => set({ route }),
  projects: [],
  styles: [],
  showToast: (text) => {
    const at = Date.now()
    set({ toast: { text, at } })
    setTimeout(() => get().toast?.at === at && set({ toast: undefined }), 3200)
  },
  showError: (e) => {
    const at = Date.now()
    const text = errorText(e)
    set({ toast: { text, at, error: true } })
    setTimeout(() => get().toast?.at === at && set({ toast: undefined }), Math.max(6000, text.length * 70))
    window.api.status().then((status) => set({ status }), () => {})
  },
  refresh: async () => {
    const [projects, styles, settings, status] = await Promise.all([
      window.api.projects.list(),
      window.api.styles.list(),
      window.api.settings.get(),
      window.api.status()
    ])
    set({ projects, styles, settings, status })
  },
  upsertProject: (p) =>
    set((s) => {
      const rest = s.projects.filter((x) => x.id !== p.id)
      return { projects: [p, ...rest].sort((a, b) => b.updatedAt - a.updatedAt) }
    })
}))

/** The message of an error from the app's back end, without Electron's "Error invoking remote method" prefix. */
export const errorText = (e: unknown) => String((e as Error)?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

export const fmtTime = (s: number) => {
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${m}:${r.toString().padStart(2, '0')}`
}
