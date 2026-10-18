import { create } from 'zustand'
import type { AppSettings, CharacterDef, Project, Status, StyleDef } from '@shared/types'

export type Route =
  | { name: 'home' }
  | { name: 'styles'; tab?: 'Library' | 'My styles' | 'Learn from a video' }
  | { name: 'characters'; id?: string }
  | { name: 'settings' }
  | { name: 'editor'; id: string }

interface AppState {
  route: Route
  go: (r: Route) => void
  projects: Project[]
  styles: StyleDef[]
  characters: CharacterDef[]
  settings?: AppSettings
  status?: Status
  toast?: { text: string; at: number }
  showToast: (text: string) => void
  refresh: () => Promise<void>
  upsertProject: (p: Project) => void
}

export const useApp = create<AppState>((set, get) => ({
  route: { name: 'home' },
  go: (route) => set({ route }),
  projects: [],
  styles: [],
  characters: [],
  showToast: (text) => {
    const at = Date.now()
    set({ toast: { text, at } })
    setTimeout(() => get().toast?.at === at && set({ toast: undefined }), 3200)
  },
  refresh: async () => {
    const [projects, styles, characters, settings, status] = await Promise.all([
      window.api.projects.list(),
      window.api.styles.list(),
      window.api.characters.list(),
      window.api.settings.get(),
      window.api.status()
    ])
    set({ projects, styles, characters, settings, status })
  },
  upsertProject: (p) =>
    set((s) => {
      const rest = s.projects.filter((x) => x.id !== p.id)
      return { projects: [p, ...rest].sort((a, b) => b.updatedAt - a.updatedAt) }
    })
}))

export const fmtTime = (s: number) => {
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${m}:${r.toString().padStart(2, '0')}`
}
