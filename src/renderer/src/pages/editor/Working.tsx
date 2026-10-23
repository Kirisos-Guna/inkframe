import { useEffect, useState } from 'react'
import { Check, Image as ImageIcon, Pause, Play, X } from 'lucide-react'
import type { Project, Stage } from '@shared/types'
import { APP_NAME } from '@shared/brand'
import { fmtTime } from '@/store/app'

const STAGES: Stage[] = ['Voiceover', 'Parts', 'Design', 'Render', 'Video']

/** Working time of the job: stands still while paused, and keeps the total once the job ends. */
export function useElapsed(j: Project['job']) {
  const ticking = j.running && !j.paused
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!ticking) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [ticking])
  if (!j.startedAt) return '0:00'
  const end = j.running ? (j.paused && j.pausedAt ? j.pausedAt : Math.max(now, j.startedAt)) : (j.endedAt ?? j.startedAt)
  return fmtTime(Math.max(0, end - j.startedAt - (j.pausedMs ?? 0)) / 1000)
}

export function Working({ p, onWatch }: { p: Project; onWatch?: () => void }) {
  const j = p.job
  const n = p.parts.length
  const elapsed = useElapsed(j)
  const stopped = !j.running && !j.error && j.title === 'Stopped'
  const stageIdx = STAGES.indexOf(j.stage)
  const latest = [...p.parts].reverse().find((x) => x.status === 'Designing' || x.status === 'Making it again' || x.status === 'Rendering')
  const picture = latest?.thumb ?? [...p.parts].reverse().find((x) => x.thumb)?.thumb
  const steps = [...j.steps].reverse()

  const pill = (s: Stage, i: number) => {
    const done = i < stageIdx || (s === 'Video' && !!p.output && stageIdx >= 4 && !j.running)
    const active = i === stageIdx && j.running
    const label =
      s === 'Parts' ? `Parts${n ? ` ${n}` : ''}` : s === 'Design' ? `Design ${j.designDone}/${n || 0}` : s === 'Render' ? `Render ${j.renderDone}/${n || 0}` : s
    const allDone = s === 'Design' ? j.designDone === n && n > 0 : s === 'Render' ? j.renderDone === n && n > 0 : done
    return (
      <div
        key={s}
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[14.5px] ${
          active ? 'border-accent text-ink' : 'border-line text-muted'
        } ${allDone && !active ? 'text-ink' : ''}`}
      >
        {allDone && !active ? (
          <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-ok">
            <Check size={11} strokeWidth={3.5} className="text-white" />
          </span>
        ) : (
          <span
            className={`flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px] ${
              active ? 'bg-accent text-white' : 'bg-card2 text-muted'
            }`}
          >
            {i + 1}
          </span>
        )}
        {label}
      </div>
    )
  }

  return (
    <div className="relative mx-auto h-fit w-full max-w-[1030px] overflow-hidden rounded-2xl border border-line bg-[#0e0e10] px-5 py-5 2xl:px-8 2xl:py-7">
      {j.running && !j.paused && <div className="absolute left-0 top-0 h-[2px] w-1/3 animate-pulse bg-gradient-to-r from-transparent via-accent to-transparent" />}
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${j.error ? 'bg-red-500' : j.running ? 'bg-accent' : stopped ? 'bg-dim' : 'bg-ok'}`} />
        <div className={`min-w-0 flex-1 truncate text-[20px] font-semibold 2xl:text-[23px] ${j.error ? 'text-red-400' : j.running ? 'text-accent' : stopped ? 'text-muted' : 'text-ok'}`}>
          {j.error ? 'Something went wrong' : !j.running ? (stopped ? 'Stopped' : 'Done') : j.paused ? 'Paused' : `${APP_NAME} is working`}
        </div>
        <span className="hidden whitespace-nowrap rounded-lg border border-line px-3 py-1 text-[13.5px] text-muted lg:inline">
          {p.settings.provider} · {p.settings.model} · {p.settings.effort}
        </span>
        <span className="w-12 text-right text-[14px] text-muted">{elapsed}</span>
        {j.running && <PauseButton p={p} />}
        {p.output && onWatch && (
          <button onClick={onWatch} className="flex items-center gap-1.5 text-[15px] font-medium">
            <Play size={13} fill="currentColor" /> Watch video
          </button>
        )}
      </div>
      <div className="mt-4 flex items-center gap-2.5">
        {j.running && j.paused ? <Pause size={16} className="text-accent" fill="currentColor" /> : j.running ? <div className="spinner" /> : j.error ? <X size={16} className="text-red-400" /> : stopped ? <Pause size={16} className="text-muted" /> : <Check size={16} className="text-ok" />}
        <div className="text-[19px] font-semibold">{j.error ? (steps.find((s) => !s.done)?.label ?? 'Stopped') : j.title}</div>
        {j.error && (
          <button className="btn-accent ml-auto px-3 py-1.5 text-[14px]" onClick={() => window.api.job.start(p.id)}>
            Try again
          </button>
        )}
      </div>
      <div className="mt-1.5 text-[16px] italic text-ink/80">{j.error ?? j.detail}</div>
      <div className="mt-5 flex flex-wrap gap-2.5">{STAGES.map(pill)}</div>
      <div className="mt-5 flex gap-5">
        <div className="relative flex aspect-video max-h-[34vh] w-[52%] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-black">
          {picture ? (
            <>
              <img src={window.api.media.url(picture) + `?t=${p.updatedAt}`} className="h-full w-full object-contain" />
              {latest && (
                <span className="absolute bottom-3 left-3 rounded-md bg-black/70 px-2.5 py-1 text-[13px]">
                  part {latest.index + 1} · review picture
                </span>
              )}
            </>
          ) : (
            <div className="text-center text-[15px] text-muted">
              <ImageIcon size={22} className="mx-auto mb-3 text-ink/60" />
              Pictures appear here as soon as {APP_NAME} draws the first part.
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="text-[13px] font-medium tracking-[.06em] text-muted">
            WHAT {APP_NAME.toUpperCase()} DID · {j.steps.length} steps
          </div>
          <div className="mt-3 max-h-[230px] flex-1 space-y-2.5 overflow-hidden">
            {steps.slice(0, 8).map((s, i) => (
              <div key={s.id} className="flex items-center gap-2.5 text-[15.5px]" style={{ opacity: 1 - i * 0.12 }}>
                {s.done ? (
                  <Check size={15} className="shrink-0 text-ok" />
                ) : (
                  <span className="h-[15px] w-[15px] shrink-0 rounded-full border-2 border-accent" />
                )}
                <span className={`truncate ${s.done ? 'text-ink/85' : 'font-semibold'}`}>{s.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 text-[14px] text-muted">Safe to close this window: the work carries on on this computer.</div>
        </div>
      </div>
    </div>
  )
}

/** Pause stops the step in progress and holds the job; Resume does that step again and carries on. */
export function PauseButton({ p }: { p: Project }) {
  const paused = !!p.job.paused
  return (
    <button
      onClick={() => (paused ? window.api.job.resume(p.id) : window.api.job.pause(p.id))}
      title={paused ? 'Resume' : 'Pause'}
      className={`ml-1 flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[15px] font-medium ${paused ? 'bg-accent text-white hover:bg-accent2' : 'hover:bg-white/5'}`}
    >
      {paused ? <Play size={13} fill="currentColor" /> : <Pause size={14} fill="currentColor" />} {paused ? 'Resume' : 'Pause'}
    </button>
  )
}
