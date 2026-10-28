import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Copy, Download, Image as ImageIcon, Music, RefreshCw, Sparkles, X } from 'lucide-react'
import type { CaptionStyle, Project, SfxLevel, Transition } from '@shared/types'
import { fmtTime, useApp } from '@/store/app'
import { Chips } from '@/components/ui'

const TRANSITIONS: Transition[] = ['None', 'Fade', 'Flash', 'Wipe', 'Slide', 'Zoom']
const CAPTIONS: CaptionStyle[] = ['Off', 'Clean', 'Bold pop', 'Karaoke']
const SFX: SfxLevel[] = ['Off', 'Subtle', 'Lively']
const clean = (e: unknown) => (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

/** Everything for putting the video out: thumbnail, title and description, captions, and the finishing pass. */
export function Publish({ p }: { p: Project }) {
  const { showToast, status, settings } = useApp()
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [changed, setChanged] = useState(false)
  const writer = (settings?.writerProvider ?? 'Codex') === 'Codex' && status?.codex ? 'Codex' : 'Claude Code'
  const ready = !!p.output && !p.job.running

  const run = async (what: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(what)
    try {
      await fn()
      if (done) showToast(done)
    } catch (e) {
      showToast(clean(e))
    } finally {
      setBusy(null)
    }
  }
  const setSettings = async (patch: Partial<Project['settings']>) => {
    await window.api.projects.update(p.id, { settings: { ...p.settings, ...patch } })
    setChanged(true)
  }
  const copy = (text: string, what: string) => {
    navigator.clipboard.writeText(text)
    showToast(`${what} copied`)
  }

  return (
    <>
      {/* Thumbnail */}
      <Section title="Thumbnail" sub={`Drawn by ${p.settings.provider} in the video's style, from its own frames: one big glowing subject, 2–4 huge words, strong contrast.`}>
        <div className="flex gap-2">
          <input className="input py-2 text-[14px]" placeholder="Optional: what should it show? e.g. a glowing GPU, the words “WHERE IT GOES”" value={note} onChange={(e) => setNote(e.target.value)} />
          <button
            className="btn-accent shrink-0"
            disabled={!!busy || p.job.running || !p.parts.length}
            onClick={() => run('thumbs', () => window.api.thumbs.make(p.id, 3, note.trim() || undefined), 'Thumbnails ready')}
          >
            {busy === 'thumbs' ? <span className="spinner" /> : <ImageIcon size={15} />} {busy === 'thumbs' ? 'Drawing…' : 'Make 3'}
          </button>
        </div>
        {busy === 'thumbs' && <div className="mt-2 text-[13px] text-muted">Three different ideas (glowing object, big number, mystery…), one after the other. About a minute each.</div>}
        <div className="mt-3 grid grid-cols-2 gap-3">
          {(p.thumbnails ?? []).map((t) => (
            <div key={t.id} className="group relative overflow-hidden rounded-lg border border-line">
              <img src={window.api.media.url(t.file) + `?v=${t.at}`} className="aspect-video w-full object-cover" />
              {t.note && <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-ink/90">{t.note}</span>}
              <div className="absolute inset-x-0 bottom-0 hidden justify-end gap-1 bg-gradient-to-t from-black/80 p-2 group-hover:flex">
                <button className="btn px-2 py-1 text-[12.5px]" onClick={() => window.api.file.saveCopy(t.file, `${p.title} thumbnail`)}>
                  <Download size={13} /> Save PNG
                </button>
                <button
                  className="btn px-2 py-1 text-[12.5px]"
                  onClick={() => window.api.projects.update(p.id, { thumbnails: (p.thumbnails ?? []).filter((x) => x.id !== t.id) })}
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Title, description, tags */}
      <Section title="Title & description" sub={`Written by ${writer}, with chapters from the parts.`}>
        <button className="btn-accent" disabled={!!busy || !p.parts.length} onClick={() => run('publish', () => window.api.writer.publish(p.id))}>
          {busy === 'publish' ? <span className="spinner" /> : <Sparkles size={15} />} {p.publish ? 'Write again' : 'Write them'}
        </button>
        {p.publish && (
          <div className="mt-4 space-y-4">
            <div>
              <div className="label mb-2">Titles · click one to use it as the video's name, or copy it</div>
              <div className="space-y-1.5">
                {p.publish.titles.map((t) => (
                  <div key={t} className={`flex items-center rounded-lg border ${t === p.title ? 'border-accent' : 'border-line hover:border-[#45454c]'}`}>
                    <button
                      onClick={() => window.api.projects.update(p.id, { title: t }).then(() => showToast('Renamed the video'))}
                      className="min-w-0 flex-1 px-3 py-2 text-left text-[14.5px]"
                      title="Use as the video's name"
                    >
                      {t} <span className="text-[12px] text-dim">{t.length}</span>
                    </button>
                    <button onClick={() => copy(t, 'Title')} className="shrink-0 px-2.5 py-2 text-muted hover:text-ink" title="Copy this title">
                      <Copy size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center">
                <span className="label flex-1">Description</span>
                <IconBtn onClick={() => copy(p.publish!.description, 'Description')} label="Copy" icon={<Copy size={13} />} />
                <IconBtn onClick={() => window.api.file.saveText(p.publish!.description, `${p.title} description`)} label="Save" icon={<Download size={13} />} />
              </div>
              <Description p={p} />
            </div>
            <div>
              <div className="mb-2 flex items-center">
                <span className="label flex-1">Tags</span>
                <IconBtn onClick={() => copy(p.publish!.tags.join(', '), 'Tags')} label="Copy" icon={<Copy size={13} />} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[...p.publish.tags, ...p.publish.hashtags].map((t) => (
                  <span key={t} className="chip px-2 py-0.5 text-[12.5px]">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* Captions */}
      <Section title="Captions" sub="From the words in your voiceover. Shown in the video, and as files for YouTube.">
        <div className="label mb-2">In the video</div>
        <Chips options={CAPTIONS} value={p.settings.captions ?? 'Off'} onToggle={(captions) => setSettings({ captions })} size="sm" />
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn" disabled={!!busy || !p.words.length} onClick={() => run('captions', () => window.api.writer.captions(p.id, true), 'Captions tidied')}>
            {busy === 'captions' ? <span className="spinner" /> : <Sparkles size={15} />} Tidy with {writer}
          </button>
          <button className="btn" disabled={!p.words.length} onClick={() => window.api.captions.save(p.id, 'srt')}>
            <Download size={15} /> .srt
          </button>
          <button className="btn" disabled={!p.words.length} onClick={() => window.api.captions.save(p.id, 'vtt')}>
            <Download size={15} /> .vtt
          </button>
        </div>
        {p.captionLines?.length ? (
          <div className="mt-3 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-line bg-[#0f0f11] p-3 text-[13px]">
            {p.captionLines.slice(0, 40).map((l, i) => (
              <div key={i} className="flex gap-3">
                <span className="w-10 shrink-0 text-dim">{fmtTime(l.start)}</span>
                <span>{l.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 text-[13px] text-dim">Not tidied yet: the raw heard words are used.</div>
        )}
      </Section>

      {/* Finish */}
      <Section title="Finish" sub="Transitions, sound effects and music are added over the drawn parts. No part is drawn again.">
        <div className="label mb-2">Between parts</div>
        <Chips options={TRANSITIONS} value={p.settings.transition ?? 'None'} onToggle={(transition) => setSettings({ transition })} size="sm" />
        <div className="label mb-2 mt-4">Sound effects</div>
        <div className="flex flex-wrap items-center gap-3">
          <Chips options={SFX} value={p.settings.sfx ?? 'Off'} onToggle={(sfx) => setSettings({ sfx })} size="sm" />
          {(p.settings.sfx ?? 'Off') !== 'Off' && (
            <Volume value={p.settings.sfxVolume ?? 0.6} min={0.1} max={1} onCommit={(sfxVolume) => setSettings({ sfxVolume })} label="Sound effects volume" />
          )}
        </div>
        <div className="mt-1.5 text-[12.5px] text-dim">Timed to what happens on screen: pops, whooshes, typing, counters{p.settings.sfx === 'Lively' ? ' and the pen as it draws' : ''}.</div>
        <div className="label mb-2 mt-4">Music</div>
        {p.settings.music ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="chip flex items-center gap-2">
              <Music size={13} /> {p.settings.music.file.split(/[\\/]/).pop()}
              <button onClick={() => setSettings({ music: null })}>
                <X size={13} className="text-muted" />
              </button>
            </span>
            <Volume value={p.settings.music.volume} min={0.05} max={0.6} onCommit={(volume) => setSettings({ music: { ...p.settings.music!, volume } })} label="Music volume" />
          </div>
        ) : (
          <button
            className="btn"
            onClick={async () => {
              const [m] = await window.api.pick.file([{ name: 'Music', extensions: ['mp3', 'wav', 'm4a', 'ogg'] }])
              if (m) setSettings({ music: { file: m, volume: 0.25 } })
            }}
          >
            <Music size={15} /> Add music
          </button>
        )}
        <button
          className="btn-accent mt-5 w-full"
          disabled={!ready || !!busy}
          onClick={() => run('finish', () => window.api.job.refinish(p.id).then(() => setChanged(false)), 'The video is updated')}
        >
          {busy === 'finish' ? <span className="spinner" /> : <RefreshCw size={15} />} {busy === 'finish' ? 'Putting it together…' : changed ? 'Apply to the video' : 'Put the video together again'}
        </button>
        {!p.output && <div className="mt-2 text-[13px] text-dim">Make the video first.</div>}
      </Section>
    </>
  )
}

/**
 * The description is edited here and saved a moment after typing stops (and on leaving the box). Saving on every key
 * made the box follow the saved copy, which arrives a little later, so fast typing lost letters.
 */
function Description({ p }: { p: Project }) {
  const [text, setText] = useState(p.publish!.description)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const latest = useRef(p)
  latest.current = p
  // New text from "Write again" replaces what is in the box.
  useEffect(() => setText(p.publish!.description), [p.publish!.at])
  const save = (description: string) => {
    clearTimeout(timer.current)
    const cur = latest.current
    if (cur.publish && cur.publish.description !== description) window.api.projects.update(cur.id, { publish: { ...cur.publish, description } })
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <textarea
      className="input h-56 resize-none text-[13.5px] leading-relaxed"
      value={text}
      onChange={(e) => {
        const v = e.target.value
        setText(v)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => save(v), 600)
      }}
      onBlur={(e) => save(e.target.value)}
    />
  )
}

/** A volume slider: moves freely while dragging, saved when let go. */
function Volume({ value, min, max, label, onCommit }: { value: number; min: number; max: number; label: string; onCommit: (v: number) => void }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={0.05}
      value={v}
      onChange={(e) => setV(+e.target.value)}
      onPointerUp={() => v !== value && onCommit(v)}
      onKeyUp={() => v !== value && onCommit(v)}
      className="accent-accent"
      title={`${label} ${Math.round(v * 100)}%`}
    />
  )
}

function Section({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-[#121214] px-5 py-4">
      <div className="text-[16px] font-semibold">{title}</div>
      <div className="mb-3 mt-0.5 text-[13.5px] text-muted">{sub}</div>
      {children}
    </div>
  )
}

function IconBtn({ onClick, label, icon }: { onClick: () => void; label: string; icon: ReactNode }) {
  return (
    <button onClick={onClick} className="ml-1 flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] text-muted hover:bg-white/5 hover:text-ink">
      {icon} {label}
    </button>
  )
}
