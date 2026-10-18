import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, FileText, Paperclip, Pause, RotateCcw, Trash2, X } from 'lucide-react'
import type { Comment, Part, Project } from '@shared/types'
import { APP_NAME } from '@shared/brand'
import { fmtTime, useApp } from '@/store/app'
import { useElapsed } from './Working'

export type Tab = 'Changes' | 'Material' | 'Checks' | 'History' | 'Render'
const TABS: Tab[] = ['Changes', 'Material', 'Checks', 'History', 'Render']
const QUICK = ['Bigger text', 'Slower', 'Faster', 'More movement', 'Use my material here', 'A different idea', 'Fix the timing', 'Simpler']

export function SidePanel({
  p,
  tab,
  setTab,
  selected,
  composing,
  setComposing,
  pending,
  setPending
}: {
  p: Project
  tab: Tab
  setTab: (t: Tab) => void
  selected: Part[]
  composing: boolean
  setComposing: (v: boolean) => void
  pending: Comment[]
  setPending: (c: Comment[]) => void
}) {
  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-l border-line/70 2xl:w-[480px]">
      <div className="flex gap-5 overflow-x-auto border-b border-line/70 px-5 pt-4 2xl:gap-7 2xl:px-6">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`tab ${tab === t ? 'tab-on font-semibold' : ''}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {tab === 'Changes' && (
          <Changes p={p} selected={selected} composing={composing} setComposing={setComposing} pending={pending} setPending={setPending} />
        )}
        {tab === 'Material' && <Material p={p} />}
        {tab === 'Checks' && <Checks p={p} />}
        {tab === 'History' && <History p={p} selected={selected} />}
        {tab === 'Render' && <RenderTab p={p} />}
      </div>
    </aside>
  )
}

function JobCard({ p }: { p: Project }) {
  const elapsed = useElapsed(p.job.startedAt, p.job.running)
  if (!p.job.running) return null
  return (
    <div className="relative overflow-hidden rounded-xl border border-accent/70 bg-[#121214] px-5 py-4">
      <div className="absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-accent via-accent/50 to-transparent" />
      <div className="flex items-center gap-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-accent" />
        <span className="flex-1 text-[19px] font-semibold text-accent">{APP_NAME} is working</span>
        <span className="text-[14px] text-muted">{elapsed}</span>
        <button onClick={() => window.api.job.stop(p.id)} className="ml-3 flex items-center gap-1.5 text-[15px] font-medium">
          <Pause size={14} fill="currentColor" /> Stop
        </button>
      </div>
      <div className="mt-1 text-[13.5px] text-muted">
        {p.settings.provider} · {p.settings.model} · {p.settings.effort} · {p.job.steps.length} steps so far
      </div>
      <div className="mt-3 flex items-center gap-2.5">
        <span className="h-[15px] w-[15px] rounded-full border-2 border-accent" />
        <span className="text-[16px] font-semibold">{p.job.title}</span>
      </div>
      <div className="mt-1 text-[15px] italic leading-snug text-ink/80">{p.job.detail}</div>
    </div>
  )
}

function Changes({
  p,
  selected,
  composing,
  setComposing,
  pending,
  setPending
}: {
  p: Project
  selected: Part[]
  composing: boolean
  setComposing: (v: boolean) => void
  pending: Comment[]
  setPending: (c: Comment[]) => void
}) {
  const { styles, characters, go } = useApp()
  const [text, setText] = useState('')
  const [mode, setMode] = useState<Comment['mode']>('Fix just this')
  const [attachments, setAttachments] = useState<string[]>([])
  const ref = useRef<HTMLTextAreaElement>(null)
  const one = selected.length === 1 ? selected[0] : null

  useEffect(() => {
    if (composing) ref.current?.focus()
  }, [composing, selected.map((s) => s.id).join()])

  const save = () => {
    if (!text.trim() || !selected.length) return
    setPending([
      ...pending,
      {
        id: crypto.randomUUID(),
        partIds: selected.map((s) => s.id),
        text: text.trim(),
        mode,
        attachments,
        at: Date.now(),
        state: 'Waiting'
      }
    ])
    setText('')
    setAttachments([])
    setComposing(false)
  }

  const queue = [...pending, ...p.comments.slice().reverse()]

  return (
    <>
      <JobCard p={p} />
      {one && (
        <div className="rounded-xl border border-line bg-[#121214] p-4">
          <div className="flex gap-4">
            <div className="h-[92px] w-[164px] shrink-0 overflow-hidden rounded-lg bg-black">
              {one.thumb && <img src={window.api.media.url(one.thumb) + `?v=${one.history.length}`} className="h-full w-full object-cover" />}
            </div>
            <div className="pt-4">
              <div className="text-[18px] font-semibold">{one.title}</div>
              <div className="text-[14.5px] text-muted">
                Part {one.index + 1} · {fmtTime(one.start)}–{fmtTime(one.end)}
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-[96px_1fr] items-center gap-y-3 text-[14.5px]">
            <span className="text-muted">Material</span>
            <span className="text-ink/80">
              {one.material.length ? one.material.map((m) => m.split(/[\\/]/).pop()).join(', ') : 'None yet. Drag a file here from Material.'}
            </span>
            <span className="text-muted">Style</span>
            <select
              className="rounded-lg border border-line bg-[#0f0f11] px-3 py-1.5 font-medium outline-none"
              value={one.styleId ?? ''}
              onChange={async (e) => {
                const parts = p.parts.map((x) => (x.id === one.id ? { ...x, styleId: e.target.value || undefined } : x))
                await window.api.projects.update(p.id, { parts })
              }}
            >
              <option value="" className="bg-card">
                {styles.find((s) => s.id === p.settings.styleId)?.name} (the video's style)
              </option>
              {styles
                .filter((s) => s.id !== p.settings.styleId)
                .map((s) => (
                  <option key={s.id} value={s.id} className="bg-card">
                    {s.name}
                  </option>
                ))}
            </select>
            <span className="text-muted">Characters</span>
            {p.settings.characterIds.length ? (
              <span>{characters.filter((c) => p.settings.characterIds.includes(c.id)).map((c) => c.name).join(', ')}</span>
            ) : (
              <button className="text-left font-semibold text-accent" onClick={() => go({ name: 'characters' })}>
                Add characters to this video
              </button>
            )}
            <span className="text-muted">Status</span>
            <span className="flex items-center gap-4">
              <span
                className={`rounded-md px-2 py-0.5 text-[13.5px] font-medium ${
                  one.status === 'Failed' ? 'bg-red-500/15 text-red-400' : one.status === 'Rendered' || one.status === 'Up to date' ? 'bg-ok/15 text-ok' : 'bg-accent/15 text-accent2'
                }`}
              >
                {one.status === 'Up to date' ? 'Rendered' : one.status}
              </span>
              <button
                className="font-medium"
                onClick={() =>
                  window.api.projects.update(p.id, { parts: p.parts.map((x) => (x.id === one.id ? { ...x, locked: !x.locked } : x)) })
                }
              >
                {one.locked ? 'Unlock' : 'Lock'}
              </button>
            </span>
          </div>
        </div>
      )}
      {selected.length > 1 && (
        <div className="rounded-xl border border-line bg-[#121214] px-4 py-3 text-[15px]">
          {selected.length} parts selected: {selected.map((s) => s.index + 1).join(', ')}
        </div>
      )}
      {selected.length > 0 && (composing || text) && (
        <div className="rounded-xl border border-accent/80 bg-[#121214] p-4">
          <div className="flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button key={q} className="chip px-2.5 py-1 text-[13.5px]" onClick={() => setText((t) => (t ? t.replace(/\s*$/, '. ') : '') + q)}>
                {q}
              </button>
            ))}
          </div>
          <textarea
            ref={ref}
            className="mt-3 h-24 w-full resize-none bg-transparent text-[15.5px] leading-relaxed outline-none placeholder:text-dim"
            placeholder={`What should change in ${selected.length > 1 ? 'these parts' : 'this part'}? Write as much as you like.`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) save()
              if (e.key === 'Escape') setComposing(false)
              e.stopPropagation()
            }}
          />
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {attachments.map((a) => (
                <span key={a} className="chip flex items-center gap-1.5 px-2 py-0.5 text-[12.5px]">
                  {a.split(/[\\/]/).pop()}
                  <button onClick={() => setAttachments(attachments.filter((x) => x !== a))}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="inline-flex rounded-lg border border-line p-0.5">
            {(['Fix just this', 'Rethink the scene'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1.5 text-[14px] ${mode === m ? 'bg-card2 font-semibold' : 'text-muted'}`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center">
            <button
              className="flex items-center gap-2 text-[15px] font-medium"
              onClick={async () => setAttachments([...attachments, ...(await window.api.pick.file([{ name: 'Files', extensions: ['*'] }], true))])}
            >
              <Paperclip size={15} /> Attach
            </button>
            <div className="flex-1" />
            <button
              className="px-4 text-[15px]"
              onClick={() => {
                setText('')
                setComposing(false)
              }}
            >
              Cancel
            </button>
            <button className="btn-accent" disabled={!text.trim()} onClick={save}>
              Save comment <kbd className="rounded border border-white/30 px-1.5 text-[11px] font-normal">Ctrl ↵</kbd>
            </button>
          </div>
        </div>
      )}
      {queue.map((c) => {
        const parts = p.parts.filter((x) => c.partIds.includes(x.id))
        const first = parts[0]
        const isPending = pending.includes(c)
        return (
          <div key={c.id} className="rounded-xl border border-line bg-[#121214] px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {parts.slice(0, 4).map((x) => (
                <span key={x.id} className="flex items-center gap-1.5 rounded-md bg-card2 px-2 py-1 text-[13.5px]">
                  Part {x.index + 1} · {fmtTime(x.start)}
                </span>
              ))}
              {parts.length > 4 && <span className="text-[13.5px] text-muted">+{parts.length - 4}</span>}
              <span className="flex-1" />
              <span
                className={`flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[13.5px] ${
                  c.state === 'Working' ? 'text-accent2' : c.state === 'Done' ? 'text-ok' : c.state === 'Failed' ? 'text-red-400' : 'bg-card2 text-ink/80'
                }`}
              >
                {c.state === 'Working' && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                {isPending ? 'Not sent' : c.state}
              </span>
            </div>
            <div className="mt-2.5 text-[16px] font-medium leading-snug">{c.text}</div>
            <div className="mt-2 flex items-center text-[14px] text-muted">
              {c.mode}
              {!first && ' · all parts'}
              <span className="flex-1" />
              {isPending && (
                <button onClick={() => setPending(pending.filter((x) => x !== c))}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        )
      })}
      {!p.job.running && !queue.length && !selected.length && (
        <div className="rounded-xl border border-dashed border-line px-5 py-8 text-center text-[15px] text-muted">
          Click a part on the timeline to comment on it.
          <br />
          Your notes are sent to Claude together, and only those parts are made again.
        </div>
      )}
    </>
  )
}

function Material({ p }: { p: Project }) {
  const add = async () => {
    const files = await window.api.pick.file([{ name: 'Material', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'mp4', 'mov', 'pdf', 'txt', 'md', 'csv'] }], true)
    if (files.length) await window.api.projects.update(p.id, { material: [...new Set([...p.material, ...files])] })
  }
  const isImg = (f: string) => /\.(png|jpe?g|webp|gif|svg)$/i.test(f)
  return (
    <>
      <div className="text-[14.5px] text-muted">Drag a file onto a part on the timeline to use it there.</div>
      <div
        className="grid grid-cols-2 gap-3"
        onDragOver={(e) => e.preventDefault()}
        onDrop={async (e) => {
          e.preventDefault()
          const files = [...e.dataTransfer.files].map((f) => window.api.pathOf(f))
          if (files.length) await window.api.projects.update(p.id, { material: [...new Set([...p.material, ...files])] })
        }}
      >
        {p.material.map((m) => {
          const used = p.parts.filter((x) => x.material.includes(m))
          return (
            <div
              key={m}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('text/x-material', m)}
              className="group relative cursor-grab overflow-hidden rounded-xl border border-line bg-[#121214]"
            >
              <div className="flex aspect-video items-center justify-center bg-black">
                {isImg(m) ? <img src={window.api.media.url(m)} className="h-full w-full object-contain" draggable={false} /> : <FileText size={26} className="text-muted" />}
              </div>
              <div className="truncate px-3 py-2 text-[13.5px]">{m.split(/[\\/]/).pop()}</div>
              <div className="px-3 pb-2 text-[12.5px] text-muted">{used.length ? `In part ${used.map((u) => u.index + 1).join(', ')}` : 'Not used yet'}</div>
              <button
                className="absolute right-2 top-2 hidden rounded-md bg-black/70 p-1 group-hover:block"
                onClick={() => window.api.projects.update(p.id, { material: p.material.filter((x) => x !== m) })}
              >
                <X size={13} />
              </button>
            </div>
          )
        })}
        <button onClick={add} className="flex aspect-[16/11] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line text-[14px] text-muted hover:border-[#45454c]">
          <Paperclip size={18} /> Add or drop files
        </button>
      </div>
    </>
  )
}

function Checks({ p }: { p: Project }) {
  const checked = p.parts.filter((x) => x.checks)
  const bad = checked.filter((x) => !x.checks!.ok)
  return (
    <>
      <div className="rounded-xl border border-line bg-[#121214] px-5 py-4">
        <div className="text-[16px] font-semibold">Checks · {p.settings.checks}</div>
        <div className="mt-1 text-[14px] text-muted">
          After each part is drawn, Claude looks at it again: text cut off, things off screen, words and pictures out of sync.
          {p.settings.checks === 'High' && ' Parts that fail are made again once by themselves.'}
        </div>
        <div className="mt-3 flex gap-2">
          {(['Off', 'Low', 'Medium', 'High'] as const).map((l) => (
            <button
              key={l}
              className={`chip ${p.settings.checks === l ? 'chip-on' : ''}`}
              onClick={() => window.api.projects.update(p.id, { settings: { ...p.settings, checks: l } })}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="text-[14.5px] text-muted">
        {checked.length} of {p.parts.length} parts checked · {bad.length} with notes
      </div>
      {p.parts.map((x) => (
        <div key={x.id} className="flex gap-3 rounded-xl border border-line bg-[#121214] px-4 py-3">
          {!x.checks ? (
            <span className="mt-0.5 h-4 w-4 rounded-full border-2 border-line" />
          ) : x.checks.ok ? (
            <CheckCircle2 size={17} className="mt-0.5 text-ok" />
          ) : (
            <AlertTriangle size={17} className="mt-0.5 text-accent" />
          )}
          <div className="min-w-0">
            <div className="text-[15px] font-medium">
              Part {x.index + 1} · {x.title}
            </div>
            <div className="text-[13.5px] text-muted">{x.checks ? (x.checks.notes.length ? x.checks.notes.join(' · ') : 'Looks good') : 'Not checked yet'}</div>
          </div>
        </div>
      ))}
    </>
  )
}

function History({ p, selected }: { p: Project; selected: Part[] }) {
  const parts = selected.length ? selected : p.parts
  return (
    <>
      <div className="text-[14.5px] text-muted">
        {selected.length ? 'Versions of the selected part.' : 'Every version of every part. Pick one to go back to it.'}
      </div>
      {parts.map((x) =>
        x.history.length ? (
          <div key={x.id} className="rounded-xl border border-line bg-[#121214] px-4 py-3">
            <div className="text-[15px] font-semibold">
              Part {x.index + 1} · {x.title}
            </div>
            {x.history
              .slice()
              .reverse()
              .map((h, i) => (
                <div key={h.at} className="mt-2 flex items-center gap-3 text-[14px]">
                  <span className="w-14 text-muted">{new Date(h.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="flex-1 truncate">{h.note}</span>
                  {i === 0 ? (
                    <span className="flex items-center gap-1 text-ok">
                      <Check size={13} /> Now
                    </span>
                  ) : (
                    <button className="flex items-center gap-1 font-medium text-accent" onClick={() => window.api.parts.restore(p.id, x.id, h.file)}>
                      <RotateCcw size={13} /> Go back
                    </button>
                  )}
                </div>
              ))}
          </div>
        ) : null
      )}
      <div className="pt-2 text-[13px] font-medium tracking-[.06em] text-muted">ACTIVITY</div>
      {p.job.steps
        .slice()
        .reverse()
        .slice(0, 60)
        .map((s) => (
          <div key={s.id} className="flex items-center gap-3 text-[14px]">
            <span className="w-14 text-muted">{new Date(s.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="truncate text-ink/85">{s.label}</span>
          </div>
        ))}
    </>
  )
}

function RenderTab({ p }: { p: Project }) {
  const { showToast } = useApp()
  const [h, setH] = useState<number>(p.settings.quality.height)
  const [fps, setFps] = useState<number>(p.settings.quality.fps)
  const [busy, setBusy] = useState(false)
  const rendered = p.parts.filter((x) => x.video).length
  return (
    <>
      <div className="rounded-xl border border-line bg-[#121214] px-5 py-4">
        <div className="text-[16px] font-semibold">Final video</div>
        <div className="mt-1 text-[14px] text-muted">
          {rendered}/{p.parts.length} parts rendered · {p.output ? p.output : 'not put together yet'}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-[13.5px] text-muted">
            Size
            <select className="input mt-1 py-2" value={h} onChange={(e) => setH(+e.target.value)}>
              <option value={720}>720p</option>
              <option value={1080}>1080p</option>
              <option value={2160}>4K</option>
            </select>
          </label>
          <label className="text-[13.5px] text-muted">
            Frame rate
            <select className="input mt-1 py-2" value={fps} onChange={(e) => setFps(+e.target.value)}>
              <option value={30}>30 fps</option>
              <option value={60}>60 fps</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            className="btn-accent flex-1"
            disabled={busy || p.job.running || !rendered}
            onClick={async () => {
              setBusy(true)
              try {
                const out = await window.api.job.exportVideo(p.id, { height: h, fps })
                if (out) {
                  showToast('Saved your video')
                  window.api.shell.reveal(out)
                }
              } catch (e) {
                showToast((e as Error).message)
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'Exporting…' : 'Export MP4'}
          </button>
          {p.output && (
            <button className="btn" onClick={() => window.api.shell.reveal(p.output!)}>
              Show file
            </button>
          )}
        </div>
      </div>
      {p.parts.map((x) => (
        <div key={x.id} className="flex items-center gap-3 rounded-lg border border-line bg-[#121214] px-4 py-2.5 text-[14px]">
          <span className="w-6 text-muted">{x.index + 1}</span>
          <span className="flex-1 truncate">{x.title}</span>
          <span className={x.video ? 'text-ok' : 'text-muted'}>{x.video ? 'Rendered' : x.status}</span>
        </div>
      ))}
    </>
  )
}
