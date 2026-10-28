import { useEffect, useState } from 'react'
import { Copy, Download, Globe, Link2, Sparkles, X } from 'lucide-react'
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
 * concept in new words. Record it, then drop the voiceover.
 */
export function ScriptWriter({ onClose, onUse }: { onClose: () => void; onUse: (script: string, title: string, direction?: string) => void }) {
  const { status, settings, showToast } = useApp()
  const [mode, setMode] = useState<'Topic' | 'Recreate'>('Topic')
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
  const [out, setOut] = useState<{ title: string; script: string; sources: string[]; by: string; direction?: string; recreated?: Recreated } | null>(null)
  const writer = (settings?.writerProvider ?? 'Codex') === 'Codex' && status?.codex ? 'Codex' : 'Claude Code'
  useEffect(() => window.api.writer.onRecreate(setStage), [])

  async function write() {
    setBusy(true)
    setStage('')
    try {
      if (mode === 'Topic') setOut(await window.api.writer.script({ topic, angle, minutes: platform === 'YouTube' ? minutes : Math.min(minutes, 1.5), platform, tone, research }))
      else {
        const r = await window.api.writer.recreate({ url, minutes: reMinutes, tone: reTone === 'Like the original' ? 'the same tone as the original' : reTone, notes: notes.trim() || undefined, research })
        setOut({ title: r.title, script: r.script, sources: [r.source.url], by: r.by, direction: r.direction, recreated: r })
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
          {mode === 'Topic' ? <Sparkles size={18} className="text-accent" /> : <Link2 size={18} className="text-accent" />}
          <div className="flex-1">
            <div className="text-[18px] font-semibold">{mode === 'Topic' ? 'Write the script' : 'Recreate a YouTube video'}</div>
            <div className="text-[13.5px] text-muted">Written by {writer}{writer === 'Codex' ? ' on your ChatGPT plan' : ''}. Record it, then drop the voiceover.</div>
          </div>
          <button onClick={onClose} disabled={busy} className="p-1 text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!out ? (
            <div className="space-y-4">
              <div className="inline-flex rounded-lg border border-line p-0.5">
                {(['Topic', 'Recreate'] as const).map((m) => (
                  <button key={m} disabled={busy} onClick={() => setMode(m)} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[14px] ${mode === m ? 'bg-card2 font-semibold' : 'text-muted'}`}>
                    {m === 'Topic' ? <Sparkles size={14} /> : <Link2 size={14} />} {m === 'Topic' ? 'From a topic' : 'Recreate a YouTube video'}
                  </button>
                ))}
              </div>
              {mode === 'Recreate' ? (
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
                    <Globe size={15} /> Check facts and numbers on the web {writer !== 'Codex' && <span className="text-[13px] text-dim">(Codex only)</span>}
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
                    <Globe size={15} /> Research the topic on the web first {writer !== 'Codex' && <span className="text-[13px] text-dim">(Codex only)</span>}
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
                {busy ? (mode === 'Recreate' ? stage || 'Starting…' : research ? 'Researching and writing. This takes a minute or two.' : 'Writing…') : ''}
              </div>
              <button className="btn-accent" disabled={busy || (mode === 'Topic' ? !topic.trim() : !url.trim())} onClick={write}>
                {busy ? <span className="spinner" /> : <Sparkles size={15} />} {busy ? 'Writing…' : mode === 'Topic' ? 'Write it' : 'Analyse and write'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
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
