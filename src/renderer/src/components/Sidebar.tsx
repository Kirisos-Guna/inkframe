import { Home, Palette, SlidersHorizontal, Users } from 'lucide-react'
import { APP_VERSION } from '@shared/brand'
import { useApp, type Route } from '@/store/app'
import { Logo, Wordmark } from './ui'

const NAV: { label: string; icon: typeof Home; route: Route }[] = [
  { label: 'Home', icon: Home, route: { name: 'home' } },
  { label: 'Styles', icon: Palette, route: { name: 'styles' } },
  { label: 'Characters', icon: Users, route: { name: 'characters' } },
  { label: 'Settings', icon: SlidersHorizontal, route: { name: 'settings' } }
]

export function Sidebar() {
  const { route, go, projects, status } = useApp()
  const ready = (status?.claude && status.claudeSignedIn) || status?.codex
  const label = ready ? 'Ready' : !status ? 'Checking…' : status.claude ? 'Sign in to Claude Code' : 'Claude Code not found'
  return (
    <aside className="flex w-[248px] shrink-0 flex-col border-r border-line/70 bg-panel 2xl:w-[300px]">
      <div className="flex items-center justify-between px-5 pb-6 pt-5">
        <div className="flex items-center gap-2.5">
          <Logo />
          <Wordmark />
        </div>
        <span className="rounded-md border border-line px-2 py-0.5 text-[12px] text-muted">{APP_VERSION}</span>
      </div>
      <nav className="space-y-1 px-3">
        {NAV.map(({ label, icon: Icon, route: r }) => {
          const on = route.name === r.name
          return (
            <button
              key={label}
              onClick={() => go(r)}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[16px] ${
                on ? 'bg-card2 font-medium text-ink' : 'text-ink/85 hover:bg-white/[.03]'
              }`}
            >
              <Icon size={18} strokeWidth={1.8} className="text-ink/80" />
              {label}
            </button>
          )
        })}
      </nav>
      <div className="mt-7 px-6 text-[12px] font-medium tracking-[.12em] text-dim">RECENT</div>
      <div className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-3">
        {projects.filter((p) => !p.draft).slice(0, 12).map((p) => (
          <button
            key={p.id}
            onClick={() => go({ name: 'editor', id: p.id })}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[15px] text-ink/90 hover:bg-white/[.03]"
          >
            <div className="h-7 w-9 shrink-0 overflow-hidden rounded bg-[#0a0d18]">
              {p.parts[0]?.thumb ? (
                <img src={window.api.media.url(p.parts[0].thumb)} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-[9px] text-accent">●</div>
              )}
            </div>
            <span className="truncate">{p.title}</span>
          </button>
        ))}
      </div>
      <button onClick={() => !ready && go({ name: 'settings' })} className="m-3 rounded-xl border border-line bg-card px-4 py-2.5 text-left">
        <div className="flex items-center gap-2.5">
          <span className={`h-2 w-2 rounded-full ${ready ? 'bg-ok' : 'bg-accent'}`} />
          <div>
            <div className="text-[15px] font-semibold">This computer</div>
            <div className={`text-[14px] ${ready ? 'text-muted' : 'text-accent2'}`}>{label}</div>
          </div>
        </div>
      </button>
    </aside>
  )
}
