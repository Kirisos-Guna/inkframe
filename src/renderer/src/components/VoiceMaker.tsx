import { useEffect, useState } from 'react'
import { AudioLines, Pause, Play, X } from 'lucide-react'
import type { LocalVoice, VoiceChoice } from '@shared/types'
import { errorText } from '@/store/app'

/**
 * Makes the voiceover from the script on this PC (a local voice model, English): pick the voice, its pace and pitch,
 * hear a sample, then the script is spoken and handed back as the voiceover file. No account, no cost.
 */
export function VoiceMaker({ script, onDone, onClose }: { script: string; onDone: (file: string) => void; onClose: () => void }) {
  const [voices, setVoices] = useState<LocalVoice[]>([])
  const [choice, setChoice] = useState<VoiceChoice | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<'' | 'sample' | 'speak'>('')
  const [audio] = useState(() => new Audio())
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    window.api.voice
      .list()
      .then((r) => {
        setVoices(r.voices)
        setChoice(r.voices.some((v) => v.id === r.choice.id) ? r.choice : { ...r.choice, id: r.voices[0].id })
      })
      .catch((e) => setError(errorText(e)))
    const off = window.api.voice.onStatus(setStatus)
    audio.onended = () => setPlaying(false)
    return () => {
      off()
      audio.pause()
    }
  }, [])

  const voice = voices.find((v) => v.id === choice?.id)
  const words = script.split(/\s+/).filter(Boolean).length
  // About 180 words a minute at normal pace.
  const minutes = choice ? words / (180 * choice.speed) : 0

  function set(patch: Partial<VoiceChoice>) {
    audio.pause()
    setPlaying(false)
    setChoice((c) => (c ? { ...c, ...patch } : c))
  }

  async function sample() {
    if (!choice) return
    if (playing) {
      audio.pause()
      setPlaying(false)
      return
    }
    setBusy('sample')
    setError('')
    try {
      audio.src = window.api.media.url(await window.api.voice.preview(choice))
      await audio.play()
      setPlaying(true)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy('')
      setStatus('')
    }
  }

  async function go() {
    if (!choice) return
    setBusy('speak')
    setError('')
    audio.pause()
    try {
      onDone(await window.api.voice.speak(script, choice))
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy('')
      setStatus('')
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-line bg-card2 px-6 py-5">
      <div className="flex items-center gap-2.5">
        <AudioLines size={17} className="text-accent" />
        <div className="text-[17px] font-semibold">Make the voiceover on this PC</div>
        <span className="text-[13.5px] text-muted">free, offline, English</span>
        <span className="flex-1" />
        <button className="text-muted hover:text-ink" onClick={onClose} disabled={!!busy}>
          <X size={17} />
        </button>
      </div>
      {error && <div className="mt-3 text-[14.5px] text-[#ff6b6b]">{error}</div>}
      {!error && status && <div className="mt-3 text-[14.5px] text-muted">{status}…</div>}
      {choice && voice && (
        <>
          <div className="mt-4 flex items-center gap-4">
            <button onClick={sample} disabled={!!busy} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-black disabled:opacity-40" title="Hear a sample">
              {playing ? <Pause size={16} fill="black" /> : <Play size={16} fill="black" className="ml-0.5" />}
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-semibold">{voice.name}</div>
              <div className="truncate text-[14px] text-muted">{voice.about}</div>
            </div>
            <select className="input w-[240px] py-2 text-[14px]" value={choice.id} disabled={!!busy} onChange={(e) => set({ id: e.target.value })}>
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} · {v.about.split(',').slice(0, 2).join(',')}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px] text-muted">
            <label className="flex items-center gap-2">
              Pace
              <input type="range" min={0.8} max={1.3} step={0.05} value={choice.speed} disabled={!!busy} onChange={(e) => set({ speed: +e.target.value })} />
              {choice.speed.toFixed(2)}×
            </label>
            <label className="flex items-center gap-2">
              Pitch
              <input type="range" min={-3} max={3} step={0.5} value={choice.pitch} disabled={!!busy} onChange={(e) => set({ pitch: +e.target.value })} />
              {choice.pitch > 0 ? '+' : ''}
              {choice.pitch}
            </label>
            <span>
              {words.toLocaleString()} words · about {minutes < 1 ? `${Math.round(minutes * 60)} s` : `${minutes.toFixed(1)} min`}
            </span>
            <span className="flex-1" />
            <button className="btn-accent px-5 py-2.5" onClick={go} disabled={!!busy || !words}>
              {busy === 'speak' ? 'Speaking…' : 'Make the voiceover'}
            </button>
          </div>
          <div className="mt-2 text-[13px] text-dim">The first time, the voice model (about 90 MB) is fetched once. Speaking takes about as long as the voiceover.</div>
        </>
      )}
    </div>
  )
}
