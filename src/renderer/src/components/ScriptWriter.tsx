import { useEffect, useState } from 'react'
import { Copy, Download, ExternalLink, Flame, Globe, Link2, Sparkles, X } from 'lucide-react'
import type { TrendIdea } from '@shared/types'
import { ideaBrief } from '@shared/ideas'
import { APP_NAME } from '@shared/brand'
import { errorText, useApp } from '@/store/app'
import { Chips } from './ui'

const PLATFORMS = ['YouTube', 'YouTube Shorts', 'Instagram Reels', 'TikTok'] as const
const TONES = ['Calm and nerdy', 'Energetic', 'Friendly', 'Serious', 'Funny'] as const
const RE_TONES = ['Like the original', ...TONES] as const

type Recreated = Awaited<ReturnType<typeof window.api.writer.recreate>>
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/**
 * Writes a voiceover script with the writer (Codex by default): from a topic, or by recreating a YouTube video's
 * concept in new words. Then make the voiceover on this PC, or record it yourself.
 */
export function ScriptWriter({ onClose, onUse }: { onClose: () => void; onUse: (script: string, title: string, direction?: string) => void }) {
  const { status, settings, showToast } = useApp()
  const [mode, setMode] = useState<'Trends' | 'Topic' | 'Recreate'>('Topic')
  const [days, setDays] = useState<'Today' | 'This week'>('This week')
  const [focus, setFocus] = useState('')
  const [ideas, setIdeas] = useState<{ ideas: TrendIdea[]; read: string[]; failed: string[]; by: string } | null>(null)
  const [topic, setTopic] = useState('')
  const [angle, setAngle] = useState('')
  const [minutes, setMinutes] = useState(10)
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>('YouTube')
  const [tone, setTone] = useState<(typeof TONES)[number]>('Calm and nerdy')
  const [research, setResearch] = useState(true)
  const [url, setUrl] = useState('')
  const [reMinutes, setReMinutes] = useState(0)
  const [reTone, setReTone] = useState<(typeof RE_TONES)[number]>('Like the original')
  const [notes, setNotes] = useState('')
  const [stage, setStage] = useState('')
  const [busy, setBusy] = useState(false)
  const [out, setOut] = useState<{ title: string; script: string; hooks?: string[]; sources: string[]; by: string; direction?: string; recreated?: Recreated } | null>(null)
  const writer = (settings?.writerProvider ?? 'Codex') === 'Codex' && status?.codex ? 'Codex' : 'Claude Code'
  useEffect(() => window.api.writer.onRecreate(setStage), [])
  useEffect(() => window.api.writer.onTrends(setStage), [])

  async function findIdeas() {
    setBusy(true)
    setStage('')
    try {
      setIdeas(await window.api.writer.trends({ days: days === 'Today' ? 1 : 7, focus: focus.trim() || undefined, minutes }))
    } catch (e) {
      showToast(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  /** The picked idea becomes the topic: its title, angle, facts and sources, ready to write (and still editable). */
  function pick(i: TrendIdea) {
    const b = ideaBrief(i)
    setTopic(b.topic)
    setAngle(b.angle)
    setResearch(true)
    setMode('Topic')
  }

  async function write() {
    setBusy(true)
    setStage('')
    try {
      if (mode === 'Topic') setOut(await window.api.writer.script({ topic, angle, minutes: platform === 'YouTube' ? minutes : Math.min(minutes, 1.5), platform, tone, research }))
      else {
        const r = await window.api.writer.recreate({ url, minutes: reMinutes, tone: reTone === 'Like the original' ? 'the same tone as the original' : reTone, notes: notes.trim() || undefined, research })
        setOut({ title: r.title, script: r.script, hooks: r.hooks, sources: [r.source.url], by: r.by, direction: r.direction, recreated: r })
      }
    } catch (e) {
      showToast(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const words = out ? out.script.split(/\s+/).filter(Boolean).length : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="card flex max-h-full w-full max-w-[860px] flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line/70 px-6 py-4">
          {mode === 'Topic' ? <Sparkles size={18} className="text-accent" /> : mode === 'Trends' ? <Flame size={18} className="text-accent" /> : <Link2 size={18} className="text-accent" />}
          <div className="flex-1">
            <div className="text-[18px] font-semibold">{mode === 'Topic' ? 'Write the script' : mode === 'Trends' ? 'Find a viral idea' : 'Recreate a YouTube video'}</div>
            <label className="mt-0.5 flex items-center gap-2 text-[13.5px] text-muted">
              Written by
              <select
                className="rounded-md border border-line bg-[#0f0f11] px-2 py-0.5 text-[13.5px] text-ink outline-none"
                value={writer}
                disabled={busy}
                onChange={async (e) => useApp.setState({ settings: await window.api.settings.set({ writerProvider: e.target.value as 'Claude Code' | 'Codex' }) })}
              >
                <option value="Claude Code">Claude Code</option>
                <option value="Codex" disabled={!status?.codex}>
                  Codex{status?.codex ? '' : ' (not installed)'}
                </option>
              </select>
            </label>
          </div>
          <button onClick={onClose} disabled={busy} className="p-1 text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!out ? (
            <div className="space-y-4">
              <div className="inline-flex rounded-lg border border-line p-0.5">
                {(['Trends', 'Topic', 'Recreate'] as const).map((m) => (
                  <button key={m} disabled={busy} onClick={() => setMode(m)} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[14px] ${mode === m ? 'bg-card2 font-semibold' : 'text-muted'}`}>
                    {m === 'Topic' ? <Sparkles size={14} /> : m === 'Trends' ? <Flame size={14} /> : <Link2 size={14} />}{' '}
                    {m === 'Topic' ? 'From a topic' : m === 'Trends' ? 'Find a viral idea' : 'Recreate a YouTube video'}
                  </button>
                ))}
              </div>
              {mode === 'Trends' ? (
                <Trends days={days} setDays={setDays} focus={focus} setFocus={setFocus} ideas={ideas} busy={busy} onPick={pick} />
              ) : mode === 'Recreate' ? (
                <>
                  <div>
                    <div className="label mb-2">YouTube link</div>
                    <input className="input text-[15px]" autoFocus placeholder="https://www.youtube.com/watch?v=…" value={url} onChange={(e) => setUrl(e.target.value)} />
                    <div className="mt-1.5 text-[13px] text-dim">
                      {APP_NAME} reads what the video says and how it is built, then writes a new script: the same concept, structure and facts, with every
                      sentence in new words. You make it in your own style.
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <div className="label mb-2">Length · {reMinutes ? `${reMinutes} min` : 'same as the original'}</div>
                      <input type="range" min={0} max={20} value={reMinutes} onChange={(e) => setReMinutes(+e.target.value)} className="w-full accent-accent" />
                    </div>
                    <div>
                      <div className="label mb-2">Tone</div>
                      <Chips options={RE_TONES} value={reTone} onToggle={setReTone} size="sm" />
                    </div>
                  </div>
                  <div>
                    <div className="label mb-2">Anything to change · optional</div>
                    <textarea
                      className="input h-16 resize-none text-[15px]"
                      placeholder="e.g. Aim it at small business owners. Skip the sponsor part. Add a section on costs."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                  <label className="flex cursor-pointer items-center gap-2.5 text-[15px]">
                    <input type="checkbox" className="h-4 w-4 accent-accent" checked={research} onChange={(e) => setResearch(e.target.checked)} />
                    <Globe size={15} /> Check facts and numbers on the web
                  </label>
                </>
              ) : (
                <>
                  <div>
                    <div className="label mb-2">Topic</div>
                    <input className="input text-[15px]" autoFocus placeholder="e.g. Where your prompt actually goes when you ask an AI a question" value={topic} onChange={(e) => setTopic(e.target.value)} />
                  </div>
                  <div>
                    <div className="label mb-2">Angle, facts to include, who it is for · optional</div>
                    <textarea className="input h-20 resize-none text-[15px]" placeholder="e.g. Follow one prompt from the phone to the chip and back. For curious beginners." value={angle} onChange={(e) => setAngle(e.target.value)} />
                  </div>
                  <div>
                    <div className="label mb-2">Platform</div>
                    <Chips options={PLATFORMS} value={platform} onToggle={setPlatform} size="sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <div className="label mb-2">Length · {platform === 'YouTube' ? `${minutes} min` : 'under 90 s'}</div>
                      {platform === 'YouTube' && <input type="range" min={1} max={15} value={minutes} onChange={(e) => setMinutes(+e.target.value)} className="w-full accent-accent" />}
                    </div>
                    <div>
                      <div className="label mb-2">Tone</div>
                      <Chips options={TONES} value={tone} onToggle={setTone} size="sm" />
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2.5 text-[15px]">
                    <input type="checkbox" className="h-4 w-4 accent-accent" checked={research} onChange={(e) => setResearch(e.target.checked)} />
                    <Globe size={15} /> Research the topic on the web first
                  </label>
                </>
              )}
            </div>
          ) : (
            <div>
              {out.recreated && <Analysis r={out.recreated} />}
              <div className="mb-3 flex gap-2">
                <input className="input text-[17px] font-semibold" value={out.title} onChange={(e) => setOut({ ...out, title: e.target.value })} />
                <button
                  className="btn shrink-0 px-3"
                  title="Copy the title"
                  onClick={() => {
                    navigator.clipboard.writeText(out.title)
                    showToast('Title copied')
                  }}
                >
                  <Copy size={15} />
                </button>
              </div>
              {!!out.hooks?.length && (
                <div className="mb-3">
                  <div className="label mb-1.5">Other openings · click one to use it (the current opening moves here)</div>
                  <div className="space-y-1.5">
                    {out.hooks.map((h, i) => (
                      <button
                        key={i}
                        className="block w-full rounded-lg border border-line px-3 py-2 text-left text-[14px] leading-snug hover:border-[#45454c]"
                        onClick={() => {
                          // The opening is the first paragraph: swap it with this one.
                          const [first, ...rest] = out.script.split(/\n\s*\n/)
                          setOut({ ...out, script: [h, ...rest].join('\n\n'), hooks: out.hooks!.map((x, k) => (k === i ? first.trim() : x)) })
                        }}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <textarea className="input h-[44vh] resize-none text-[15px] leading-relaxed" value={out.script} onChange={(e) => setOut({ ...out, script: e.target.value })} />
              <div className="mt-2 flex justify-between text-[13px] text-dim">
                <span>
                  {words} words · about {Math.max(1, Math.round(words / 150))} min spoken · {out.by}
                </span>
                {!out.recreated && out.sources.length > 0 && (
                  <span className="max-w-[60%] truncate" title={out.sources.join('\n')}>
                    Sources: {out.sources.join(' · ')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-line/70 px-6 py-4">
          {out ? (
            <>
              <button className="btn" onClick={() => setOut(null)}>
                Start over
              </button>
              <button
                className="btn"
                onClick={() => {
                  navigator.clipboard.writeText(out.script)
                  showToast('Script copied')
                }}
              >
                <Copy size={15} /> Copy
              </button>
              <button className="btn" onClick={() => window.api.file.saveText(`${out.title}\n\n${out.script}`, out.title || 'script')}>
                <Download size={15} /> Save .txt
              </button>
              <div className="flex-1" />
              <button className="btn-accent" onClick={() => onUse(out.script, out.title, out.direction)}>
                Use this script
              </button>
            </>
          ) : (
            <>
              <div className="min-w-0 flex-1 truncate text-[13.5px] text-muted">
                {busy
                  ? mode === 'Topic'
                    ? research
                      ? 'Researching and writing. This takes a minute or two.'
                      : 'Writing…'
                    : stage || 'Starting…'
                  : mode === 'Trends' && ideas
                    ? `Read ${ideas.read.join(', ')}${ideas.failed.length ? ` (could not read ${ideas.failed.join(', ')})` : ''} · ranked by ${ideas.by}`
                    : ''}
              </div>
              {mode === 'Trends' ? (
                <button className={ideas ? 'btn' : 'btn-accent'} disabled={busy} onClick={findIdeas}>
                  {busy ? <span className="spinner" /> : <Flame size={15} />} {busy ? 'Searching…' : ideas ? 'Find new ideas' : 'Find 3 ideas'}
                </button>
              ) : (
                <button className="btn-accent" disabled={busy || (mode === 'Topic' ? !topic.trim() : !url.trim())} onClick={write}>
                  {busy ? <span className="spinner" /> : <Sparkles size={15} />} {busy ? 'Writing…' : mode === 'Topic' ? 'Write it' : 'Analyse and write'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Find a viral idea: what tech people are talking about right now, from public sources with their numbers, checked
 * on the web and ranked into 3 video ideas. Picking one fills the topic, ready to write.
 */
function Trends(o: {
  days: 'Today' | 'This week'
  setDays: (d: 'Today' | 'This week') => void
  focus: string
  setFocus: (f: string) => void
  ideas: { ideas: TrendIdea[] } | null
  busy: boolean
  onPick: (i: TrendIdea) => void
}) {
  return (
    <>
      <div className="text-[14px] leading-relaxed text-muted">
        Reads what is trending in tech right now (Hacker News, Reddit, GitHub, YouTube&apos;s most viewed, Lobsters, dev.to, Techmeme and Google News),
        with their numbers. Then the writer searches the web to check the strongest stories, and what X, Instagram and TikTok say about them, and
        ranks the 3 best video ideas. Pick one and it becomes your topic.
      </div>
      <div className="grid grid-cols-[auto_1fr] items-end gap-6">
        <div>
          <div className="label mb-2">Trending</div>
          <Chips options={['Today', 'This week'] as const} value={o.days} onToggle={o.setDays} size="sm" />
        </div>
        <div>
          <div className="label mb-2">About · optional</div>
          <input className="input text-[15px]" placeholder="e.g. AI, web development, Linux, phones" value={o.focus} disabled={o.busy} onChange={(e) => o.setFocus(e.target.value)} />
        </div>
      </div>
      {o.ideas && (
        <div className="space-y-3">
          {o.ideas.ideas.map((i, k) => (
            <div key={k} className="rounded-xl border border-line bg-[#0f0f11] px-4 py-3.5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[14px] font-bold text-accent">{k + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[16.5px] font-semibold leading-snug">{i.title}</div>
                  <div className="mt-1 text-[14px] leading-snug text-muted">{i.why}</div>
                  {i.concept && (
                    <div className="mt-1.5 text-[14px] leading-snug">
                      <span className="text-dim">Teaches:</span> {i.concept}
                    </div>
                  )}
                  {i.hook && <div className="mt-1.5 text-[14px] italic leading-snug text-ink/85">“{i.hook}”</div>}
                  {i.evidence.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {i.evidence.slice(0, 6).map((e, n) => (
                        <a key={n} href={e.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-md border border-line px-2 py-0.5 text-[12.5px] text-muted hover:text-ink" title={e.url}>
                          {e.source}
                          {e.metric ? ` · ${e.metric}` : ''} <ExternalLink size={11} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {i.score > 0 && <span className="text-[12.5px] text-dim">{Math.round(i.score)} / 100</span>}
                  <button className="btn-accent px-3 py-1.5 text-[14px]" onClick={() => o.onPick(i)}>
                    Write this one
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/** What the original video does, so the new script's choices make sense. Folded to one line until opened. */
function Analysis({ r }: { r: Recreated }) {
  const [open, setOpen] = useState(false)
  const a = r.analysis
  return (
    <div className="mb-4 rounded-xl border border-line bg-[#0f0f11] px-4 py-3 text-[14px]">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-muted">
          Recreated from <span className="text-ink">{r.source.title}</span>
          {r.source.channel ? ` · ${r.source.channel}` : ''} · {fmt(r.source.duration)}
        </span>
        <button className="shrink-0 font-medium text-accent" onClick={() => setOpen(!open)}>
          {open ? 'Hide the analysis' : 'Show the analysis'}
        </button>
      </div>
      {a.concept && (
        <div className="mt-1.5">
          <b>Concept:</b> {a.concept}
        </div>
      )}
      {open && (
        <div className="mt-2 space-y-2">
          {a.audience && (
            <div>
              <b>For:</b> {a.audience}
            </div>
          )}
          {a.hook && (
            <div>
              <b>Hook:</b> {a.hook}
            </div>
          )}
          {a.structure.length > 0 && (
            <div>
              <b>Structure</b>
              {a.structure.map((s, i) => (
                <div key={i} className="mt-1 flex gap-3">
                  <span className="w-12 shrink-0 text-dim">{s.at}</span>
                  <span>
                    {s.beat} <span className="text-muted">· {s.purpose}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
          {a.devices.length > 0 && (
            <div>
              <b>What keeps people watching:</b> {a.devices.join(' · ')}
            </div>
          )}
          {r.direction && (
            <div>
              <b>Visual direction</b> (goes into step 2): {r.direction}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
