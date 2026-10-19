import { useState } from 'react'
import { Copy, Download, Globe, Sparkles, X } from 'lucide-react'
import { useApp } from '@/store/app'
import { Chips } from './ui'

const PLATFORMS = ['YouTube', 'YouTube Shorts', 'Instagram Reels', 'TikTok'] as const
const TONES = ['Calm and nerdy', 'Energetic', 'Friendly', 'Serious', 'Funny'] as const

/** Writes a voiceover script with the writer (Codex by default). Record it, then drop the voiceover. */
export function ScriptWriter({ onClose, onUse }: { onClose: () => void; onUse: (script: string, title: string) => void }) {
  const { status, settings, showToast } = useApp()
  const [topic, setTopic] = useState('')
  const [angle, setAngle] = useState('')
  const [minutes, setMinutes] = useState(10)
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>('YouTube')
  const [tone, setTone] = useState<(typeof TONES)[number]>('Calm and nerdy')
  const [research, setResearch] = useState(true)
  const [busy, setBusy] = useState(false)
  const [out, setOut] = useState<{ title: string; script: string; sources: string[]; by: string } | null>(null)
  const writer = (settings?.writerProvider ?? 'Codex') === 'Codex' && status?.codex ? 'Codex' : 'Claude Code'

  async function write() {
    setBusy(true)
    try {
      setOut(await window.api.writer.script({ topic, angle, minutes: platform === 'YouTube' ? minutes : Math.min(minutes, 1.5), platform, tone, research }))
    } catch (e) {
      showToast((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    } finally {
      setBusy(false)
    }
  }

  const words = out ? out.script.split(/\s+/).filter(Boolean).length : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="card flex max-h-full w-full max-w-[860px] flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line/70 px-6 py-4">
          <Sparkles size={18} className="text-accent" />
          <div className="flex-1">
            <div className="text-[18px] font-semibold">Write the script</div>
            <div className="text-[13.5px] text-muted">Written by {writer}{writer === 'Codex' ? ' on your ChatGPT plan' : ''}. Record it, then drop the voiceover.</div>
          </div>
          <button onClick={onClose} disabled={busy} className="p-1 text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!out ? (
            <div className="space-y-4">
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
            </div>
          ) : (
            <div>
              <input className="input mb-3 text-[17px] font-semibold" value={out.title} onChange={(e) => setOut({ ...out, title: e.target.value })} />
              <textarea className="input h-[44vh] resize-none text-[15px] leading-relaxed" value={out.script} onChange={(e) => setOut({ ...out, script: e.target.value })} />
              <div className="mt-2 flex justify-between text-[13px] text-dim">
                <span>
                  {words} words · about {Math.max(1, Math.round(words / 150))} min spoken · {out.by}
                </span>
                {out.sources.length > 0 && <span className="max-w-[60%] truncate" title={out.sources.join('\n')}>Sources: {out.sources.join(' · ')}</span>}
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
              <button className="btn-accent" onClick={() => onUse(out.script, out.title)}>
                Use this script
              </button>
            </>
          ) : (
            <>
              <div className="flex-1 text-[13.5px] text-muted">{busy ? (research ? 'Researching and writing. This takes a minute or two.' : 'Writing…') : ''}</div>
              <button className="btn-accent" disabled={!topic.trim() || busy} onClick={write}>
                {busy ? <span className="spinner" /> : <Sparkles size={15} />} {busy ? 'Writing…' : 'Write it'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
