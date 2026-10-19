import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Download,
  Gauge,
  Layers,
  Lock,
  Merge,
  MessageCircle,
  MoreHorizontal,
  Palette,
  Pause,
  Play,
  Scissors,
  Trash2,
  Users,
  Video,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Send
} from 'lucide-react'
import type { Comment, Project } from '@shared/types'
import { APP_NAME } from '@shared/brand'
import { fmtTime, useApp } from '@/store/app'
import { Working } from './editor/Working'
import { Timeline } from './editor/Timeline'
import { SidePanel, type Tab } from './editor/SidePanel'
import { MapView } from './editor/MapView'

/** Room for the Windows min/max/close buttons drawn over the top-right corner, at any display scale. */
const CONTROLS_GAP = 'max(160px, calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw) + 16px))'

export default function Editor({ id }: { id: string }) {
  const { projects, styles, status, go, showToast, upsertProject } = useApp()
  const p = projects.find((x) => x.id === id)
  const [peaks, setPeaks] = useState<number[]>([])
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [view, setView] = useState<'Timeline' | 'Map'>('Timeline')
  const [tab, setTab] = useState<Tab>('Changes')
  const [selected, setSelected] = useState<string[]>([])
  const [composing, setComposing] = useState(false)
  const [pending, setPending] = useState<Comment[]>([])
  const [showWorking, setShowWorking] = useState(true)
  const [menu, setMenu] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const media = useRef<HTMLVideoElement & HTMLAudioElement>(null)

  useEffect(() => {
    window.api.projects.get(id).then(upsertProject)
  }, [id])
  useEffect(() => {
    if (p?.voiceover) window.api.media.peaks(p.voiceover.file).then(setPeaks)
  }, [p?.voiceover?.file])
  useEffect(() => {
    if (p?.job.running) setShowWorking(true)
  }, [p?.job.running])

  const parts = p?.parts ?? []
  const current = parts.find((x) => time >= x.start && time < x.end) ?? parts[parts.length - 1]
  const selParts = parts.filter((x) => selected.includes(x.id))
  const changedIds = [...new Set(pending.flatMap((c) => c.partIds))]

  const src = p?.output ? window.api.media.url(p.output) + `?v=${p.updatedAt}` : p?.voiceover ? window.api.media.url(p.voiceover.file) : ''

  const seek = useCallback((t: number) => {
    setTime(t)
    if (media.current) media.current.currentTime = t
  }, [])
  /** Next/previous part. "Previous" first goes back to the start of the current part, like a music player.
   *  Before there are parts, it skips 5 seconds. */
  const jump = (dir: 1 | -1) => {
    const t = media.current?.currentTime ?? time
    const total = p?.voiceover?.duration ?? 0
    if (!parts.length) return seek(Math.max(0, Math.min(total, t + dir * 5)))
    const i = Math.max(0, parts.findIndex((x) => t >= x.start - 0.1 && t < x.end - 0.1))
    const target = dir < 0 && t - parts[i].start > 1 ? parts[i] : parts[Math.max(0, Math.min(parts.length - 1, i + dir))]
    seek(target.start + 0.05)
  }
  const toggle = useCallback(() => {
    const m = media.current
    if (!m) return
    if (m.paused) {
      m.play()
      setPlaying(true)
      setShowWorking(false)
    } else {
      m.pause()
      setPlaying(false)
    }
  }, [])

  const select = (pid: string, shift: boolean) => {
    setSelected((s) => (shift ? (s.includes(pid) ? s.filter((x) => x !== pid) : [...s, pid]) : s.length === 1 && s[0] === pid ? [] : [pid]))
    const part = parts.find((x) => x.id === pid)
    if (part && !shift) seek(part.start + 0.05)
    setTab('Changes')
    setComposing(true)
  }

  const sendChanges = async () => {
    if (!p || !pending.length) return
    for (const c of pending) await window.api.job.comment(p.id, c)
    showToast(`Sent ${pending.length} change${pending.length > 1 ? 's' : ''}. Claude is on it.`)
    setPending([])
    setSelected([])
    setShowWorking(true)
  }

  // Keyboard: Space play, ←/→ parts, C comment, L lock.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'INPUT') return
      if (e.code === 'Space') {
        e.preventDefault()
        toggle()
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        jump(e.key === 'ArrowRight' ? 1 : -1)
      } else if (e.key.toLowerCase() === 'c' && current) {
        if (!selected.length) setSelected([current.id])
        setTab('Changes')
        setComposing(true)
      } else if (e.key.toLowerCase() === 'l' && p) {
        const ids = selected.length ? selected : current ? [current.id] : []
        window.api.projects.update(p.id, { parts: parts.map((x) => (ids.includes(x.id) ? { ...x, locked: !x.locked } : x)) })
      } else if (e.key === 'Escape') setSelected([])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, current?.id, selected, parts, p?.id])

  const style = useMemo(() => styles.find((s) => s.id === p?.settings.styleId), [styles, p?.settings.styleId])

  if (!p) return <div className="flex h-full items-center justify-center text-muted">Opening…</div>
  const dur = p.voiceover?.duration ?? 0
  const lockedCount = parts.filter((x) => x.locked).length
  const stale = parts.filter((x) => x.status !== 'Up to date').length
  const working = p.job.running || (showWorking && !!p.job.error)

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      {/* Top bar: the same items as the original, shrinking to compact forms on narrow windows. */}
      <header style={{ paddingRight: CONTROLS_GAP }} className="drag flex h-[58px] shrink-0 items-center gap-2 whitespace-nowrap border-b border-line/70 pl-2 text-[14px] 2xl:pl-3 2xl:text-[15px]">
        {/* Left: everything that can shrink or be clipped. Right: the menu and Export, which never move. */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden 2xl:gap-2.5 [&>*]:shrink-0">
        <button onClick={() => go({ name: 'home' })} className="p-1.5 text-muted hover:text-ink" title="Back to videos">
          <ArrowLeft size={18} />
        </button>
        <button onClick={() => go({ name: 'home' })} className="text-muted hover:text-ink">
          Videos /
        </button>
        {renaming ? (
          <input
            autoFocus
            defaultValue={p.title}
            className="input w-[220px] py-1 text-[15px] font-semibold"
            onBlur={async (e) => {
              const t = e.currentTarget.value.trim()
              if (t && t !== p.title) await window.api.projects.update(p.id, { title: t })
              setRenaming(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') setRenaming(false)
            }}
          />
        ) : (
          <span className="!shrink min-w-[48px] max-w-[110px] truncate text-[16px] font-semibold xl:max-w-[220px] 2xl:max-w-[300px] 2xl:text-[17px]" title={`${p.title} (double-click to rename)`} onDoubleClick={() => setRenaming(true)}>
            {p.title}
          </span>
        )}
        <button className="btn ml-1 gap-1.5 px-2.5 py-1.5 font-normal" title={`Style: ${style?.name ?? ''}`} onClick={() => go({ name: 'styles' })}>
          <Palette size={14} /> <span className="hidden max-w-[150px] truncate lg:inline">{style?.name ?? 'Style'}</span>
        </button>
        <button className="btn gap-1.5 px-2.5 py-1.5 font-normal" title="Characters" onClick={() => go({ name: 'characters' })}>
          <Users size={14} /> <span className="hidden 2xl:inline">Characters</span>
        </button>
        {p.job.running ? (
          <span className="flex items-center gap-2 rounded-lg border border-accent/70 bg-accent/10 px-2.5 py-1.5 font-medium text-accent2" title={p.job.paused ? 'Paused' : `${APP_NAME} is working`}>
            <span className="h-2 w-2 rounded-full bg-accent" /> {p.job.paused ? 'Paused' : <><span className="hidden 2xl:inline">{APP_NAME} is working</span><span className="2xl:hidden">Working</span></>}
          </span>
        ) : (
          <span className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 font-medium text-ok">
            <span className="h-2 w-2 rounded-full bg-ok" /> {p.job.error ? 'Stopped' : p.output ? 'Ready' : 'Not made yet'}
          </span>
        )}
        <div className="ml-1 inline-flex rounded-lg border border-line p-0.5">
          {(['Timeline', 'Map'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} title={v} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 ${view === v ? 'bg-card2 font-semibold' : 'text-muted'}`}>
              {v === 'Timeline' ? <Video size={14} /> : <Layers size={14} />} <span className="hidden 2xl:inline">{v}</span>
            </button>
          ))}
        </div>
        <button className="flex items-center gap-1.5 px-1.5" title="Checks" onClick={() => setTab('Checks')}>
          <CircleCheck size={15} className="text-muted" /> <span className="hidden 2xl:inline">Checks</span> <b>{p.settings.checks}</b>
        </button>
        <UsageMeter provider={p.settings.provider} />
        <span className="flex items-center gap-1.5 px-1.5" title="Quality">
          <Gauge size={15} className="text-muted" />
          <span className="hidden 2xl:inline">{p.settings.quality.height === 2160 ? '4K' : `${p.settings.quality.height}p`} · {p.settings.quality.fps} fps</span>
          <span className="2xl:hidden">{p.settings.quality.height === 2160 ? '4K' : `${p.settings.quality.height}p`}{p.settings.quality.fps}</span>
        </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
        <div className="relative">
          <button className="p-2 text-muted hover:text-ink" onClick={() => setMenu(!menu)}>
            <MoreHorizontal size={18} />
          </button>
          {menu && (
            <div className="absolute right-0 top-full z-40 mt-1 w-56 rounded-lg border border-line bg-[#141416] py-1 shadow-2xl" onMouseLeave={() => setMenu(false)}>
              <MenuItem
                label="Make the whole video again"
                onClick={() => {
                  window.api.job.start(p.id, true)
                  setMenu(false)
                }}
              />
              <MenuItem label="Rename" onClick={() => { setRenaming(true); setMenu(false) }} />
              <MenuItem label="Open the project folder" onClick={() => window.api.shell.open(p.dir)} />
              <MenuItem
                label="Delete this video"
                danger
                onClick={async () => {
                  if (!confirm('Delete this video and all its parts? This cannot be undone.')) return
                  await window.api.projects.remove(p.id)
                  useApp.setState((s) => ({ projects: s.projects.filter((x) => x.id !== p.id) }))
                  go({ name: 'home' })
                }}
              />
            </div>
          )}
        </div>
        <button className="btn px-3 py-1.5" title="Export" onClick={() => setTab('Render')}>
          <Download size={15} /> <span className="hidden lg:inline">Export</span>
        </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Stage */}
          <div className="relative min-h-0 flex-1">
            {view === 'Map' ? (
              <MapView p={p} selected={selected} onSelect={select} />
            ) : (
              <div className="flex h-full flex-col">
                <div className="flex min-h-0 flex-1 overflow-y-auto px-4 pt-4 2xl:px-8 2xl:pt-5">
                  <div className={`flex w-full justify-center ${working && showWorking ? "m-auto" : "h-full"}`}>
                  {working && showWorking ? (
                    <Working p={p} onWatch={() => setShowWorking(false)} />
                  ) : (
                    <Preview p={p} time={time} />
                  )}
                  </div>
                </div>
                <div className="flex items-center gap-4 px-6 py-3">
                  <button onClick={toggle} className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-card2">
                    {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                  </button>
                  <button className="text-muted hover:text-ink" onClick={() => jump(-1)} title="Previous part (←)">
                    <ChevronLeft size={20} />
                  </button>
                  <button className="text-muted hover:text-ink" onClick={() => jump(1)} title="Next part (→)">
                    <ChevronRight size={20} />
                  </button>
                  <span className="text-[16px]">
                    <b>{fmtTime(time)}</b> <span className="text-muted">/ {fmtTime(dur)}</span>
                  </span>
                  {p.job.running && !showWorking && (
                    <button className="text-[14px] font-medium text-accent" onClick={() => setShowWorking(true)}>
                      See what Claude is doing
                    </button>
                  )}
                  <span className="ml-auto text-[15px] text-muted">{current ? `Part ${current.index + 1} · ${current.title}` : ''}</span>
                </div>
              </div>
            )}
            <video
              ref={media}
              src={src}
              className="hidden"
              onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
              onEnded={() => setPlaying(false)}
            />
          </div>

          {/* Toolbar */}
          <div className="flex h-[52px] shrink-0 items-center gap-1 whitespace-nowrap border-y border-line/70 px-4 text-[15px]">
            {selected.length ? (
              <>
                <span className="mr-2 font-semibold">
                  {selected.length}<span className="hidden xl:inline"> part{selected.length > 1 ? 's' : ''} selected</span>
                </span>
                <ToolBtn icon={MessageCircle} label="Comment" boxed onClick={() => { setTab('Changes'); setComposing(true) }} />
                <ToolBtn
                  icon={Lock}
                  label={selParts.every((x) => x.locked) ? 'Unlock' : 'Lock'}
                  onClick={() => {
                    const lock = !selParts.every((x) => x.locked)
                    window.api.projects.update(p.id, { parts: parts.map((x) => (selected.includes(x.id) ? { ...x, locked: lock } : x)) })
                  }}
                />
                <span className="mx-2 h-5 w-px bg-line" />
                <ToolBtn
                  icon={Scissors}
                  label="Split"
                  disabled={selected.length !== 1}
                  onClick={async () => {
                    const part = selParts[0]
                    const at = time > part.start + 0.5 && time < part.end - 0.5 ? time : (part.start + part.end) / 2
                    await window.api.parts.split(p.id, part.id, at)
                  }}
                />
                <ToolBtn
                  icon={Merge}
                  label="Merge with next"
                  disabled={selected.length !== 1 || selParts[0]?.index === parts.length - 1}
                  onClick={async () => {
                    await window.api.parts.merge(p.id, selected[0])
                    setSelected([])
                  }}
                />
                <ToolBtn
                  icon={Trash2}
                  label="Delete"
                  danger
                  onClick={async () => {
                    if (!confirm('Delete the selected parts? Their words are cut from the voiceover.')) return
                    await window.api.parts.remove(p.id, selected)
                    setSelected([])
                  }}
                />
                <button className="ml-3 px-2 text-muted hover:text-ink" onClick={() => setSelected([])}>
                  Clear
                </button>
              </>
            ) : (
              <span className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-muted">
                <MessageCircle size={15} className="mr-1 shrink-0" />
                Click a part to comment · <b className="text-ink">Shift-click</b> to pick several · Drag material onto a part
                <Kbd>Space</Kbd> play <Kbd>← →</Kbd> parts <Kbd>C</Kbd> comment <Kbd>L</Kbd> lock · drag on the sound wave to cut words
              </span>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-2 whitespace-nowrap">
              <span className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-[14px]">
                <Lock size={13} /> {lockedCount} locked
              </span>
              {!p.job.running && !pending.length && stale > 0 && (
                <button className="btn-accent px-3 py-1 text-[14px]" onClick={() => window.api.job.start(p.id)}>
                  <RefreshCw size={13} /> Update {stale} part{stale > 1 ? 's' : ''}
                </button>
              )}
              {pending.length ? (
                <button className="btn-accent px-3 py-1 text-[14px]" onClick={sendChanges}>
                  <Send size={13} /> Send {pending.length} change{pending.length > 1 ? 's' : ''}
                </button>
              ) : (
                <span className="flex items-center gap-1.5 rounded-lg border border-accent/60 px-2.5 py-1 text-[14px] text-accent2">
                  <RefreshCw size={13} /> 0 changed
                </span>
              )}
              <button className="p-1.5 text-muted hover:text-ink" onClick={() => setZoom(Math.max(1, zoom / 1.5))}>
                <ZoomOut size={17} />
              </button>
              <button className="p-1.5 text-muted hover:text-ink" onClick={() => setZoom(Math.min(8, zoom * 1.5))}>
                <ZoomIn size={17} />
              </button>
            </div>
          </div>

          <div className="shrink-0 pt-2">
            <Timeline
              p={p}
              peaks={peaks}
              time={time}
              zoom={zoom}
              selected={selected}
              changed={changedIds}
              onSelect={select}
              onSeek={seek}
              onDropMaterial={async (partId, file) => {
                const material = p.material.includes(file) ? p.material : [...p.material, file]
                await window.api.projects.update(p.id, {
                  material,
                  parts: parts.map((x) => (x.id === partId ? { ...x, material: [...new Set([...x.material, file])] } : x))
                })
                showToast(`Added ${file.split(/[\\/]/).pop()} to part ${parts.find((x) => x.id === partId)!.index + 1}`)
              }}
              onCut={async (from, to) => {
                await window.api.parts.cut(p.id, from, to)
                showToast(`Cut ${fmtTime(from)}–${fmtTime(to)}. Those parts will be timed again.`)
              }}
            />
          </div>
        </div>

        <SidePanel
          p={p}
          tab={tab}
          setTab={setTab}
          selected={selParts}
          composing={composing}
          setComposing={setComposing}
          pending={pending}
          setPending={setPending}
        />
      </div>
    </div>
  )
}

function Preview({ p, time }: { p: Project; time: number }) {
  const part = p.parts.find((x) => time >= x.start && time < x.end) ?? p.parts[0]
  const ref = useRef<HTMLVideoElement>(null)
  // Follow the master clock with the part's own clip (muted; the sound comes from the master).
  useEffect(() => {
    const v = ref.current
    if (!v || !part) return
    const t = time - part.start
    if (Math.abs(v.currentTime - t) > 0.25) v.currentTime = Math.max(0, t)
  }, [time, part?.id])
  return (
    <div className="flex aspect-video h-full max-h-full max-w-full items-center justify-center overflow-hidden rounded-xl bg-[#08080a]">
      {part?.video ? (
        <video
          ref={ref}
          src={window.api.media.url(part.video) + `?v=${part.history.length}`}
          poster={part.thumb ? window.api.media.url(part.thumb) + `?v=${part.history.length}` : undefined}
          muted
          className="h-full w-full object-contain"
        />
      ) : part?.thumb ? (
        <img src={window.api.media.url(part.thumb) + `?v=${part.history.length}`} className="h-full w-full object-contain" />
      ) : (
        <div className="text-[15px] text-muted">{p.parts.length ? 'This part is not drawn yet.' : 'Nothing drawn yet.'}</div>
      )}
    </div>
  )
}

function ToolBtn({
  icon: Icon,
  label,
  onClick,
  boxed,
  danger,
  disabled
}: {
  icon: typeof Lock
  label: string
  onClick: () => void
  boxed?: boolean
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      title={label}
      className={`flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 disabled:opacity-35 ${boxed ? 'border border-line bg-card2' : 'hover:bg-white/5'} ${
        danger ? 'text-red-400' : ''
      }`}
    >
      <Icon size={15} /> <span className="hidden xl:inline">{label}</span>
    </button>
  )
}

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="ml-2 rounded-md border border-line bg-card2 px-1.5 py-0.5 text-[13px] font-normal text-ink/80">{children}</kbd>
)

function MenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`block w-full px-3.5 py-2 text-left text-[14px] hover:bg-white/5 ${danger ? 'text-red-400' : ''}`}>
      {label}
    </button>
  )
}

/** "Claude 5h ▬ 12%": the share of the 5-hour Claude limit used, as reported by Claude Code on each run. */
function UsageMeter({ provider }: { provider: string }) {
  const [u, setU] = useState<{ fiveHour: number; resetsAt: number } | null>(null)
  useEffect(() => {
    window.api.usage.get().then(setU)
    return window.api.usage.on(setU)
  }, [])
  if (provider !== 'Claude Code') return null
  const fresh = u && u.resetsAt > Date.now()
  const pct = fresh ? Math.round(u!.fiveHour) : null
  const colour = pct === null ? 'bg-dim' : pct >= 85 ? 'bg-red-500' : pct >= 60 ? 'bg-accent' : 'bg-ok'
  const resets = fresh ? new Date(u!.resetsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5"
      title={pct === null ? 'Share of your 5-hour Claude limit used. Shows after the next Claude step.' : `${pct}% of your 5-hour Claude limit used · resets at ${resets}`}
    >
      <span className="text-muted"><span className="hidden 2xl:inline">Claude </span>5h</span>
      <div className="h-1.5 w-8 overflow-hidden rounded bg-card2 xl:w-14">
        <div className={`h-full ${colour}`} style={{ width: `${pct ?? 0}%` }} />
      </div>
      <span>{pct === null ? '–' : `${pct}%`}</span>
    </div>
  )
}
