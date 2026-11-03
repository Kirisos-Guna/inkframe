import { useEffect, useState } from 'react'
import { AudioLines, Pause, Play, X } from 'lucide-react'
import type { ElevenVoice, VoicePick } from '@shared/types'
import { errorText } from '@/store/app'

/**
 * Makes the voiceover from the script with ElevenLabs: the writer picks the voice that fits (it can be changed and
 * heard first), then the script is spoken and handed back as the voiceover file.
 */
export function VoiceMaker({ script, language, style, fast, onDone, onClose }: { script: string; language?: string; style?: string; fast?: boolean; onDone: (file: string) => void; onClose: () => void }) {
  const [voices, setVoices] = useState<ElevenVoice[]>([])
  const [left, setLeft] = useState<number>()
  const [pick, setPick] = useState<VoicePick | null>(null)
  const [status, setStatus] = useState('Reading your voices')
  const [error, setError] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const [audio] = useState(() => new Audio())
  const [playing, setPlaying] = useState('')

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const got = await window.api.voice.list(language)
        if (!live) return
        setVoices(got.voices)
        setLeft(got.left)
        if (!got.voices.length) throw new Error('No voices found in your ElevenLabs account.')
        setStatus('Picking the voice that fits the script')
        const p = await window.api.voice.pick(script, got.voices, { language, style, fast })
        if (!live) return
        setPick(p)
        setStatus('')
      } catch (e) {
        if (live) setError(errorText(e))
      }
    })()
    const off = window.api.voice.onStatus(setStatus)
    audio.onended = () => setPlaying('')
    return () => {
      live = false
      off()
      audio.pause()
    }
  }, [])

  const voice = voices.find((v) => v.id === pick?.id)
  const chars = script.length

  function hear(v: ElevenVoice) {
    if (playing === v.id) {
      audio.pause()
      setPlaying('')
      return
    }
    if (!v.preview) return
    audio.src = v.preview
    audio.play()
    setPlaying(v.id)
  }

  async function go() {
    if (!pick || !voice) return
    setSpeaking(true)
    setError('')
    try {
      audio.pause()
      onDone(await window.api.voice.speak(script, pick, voice, language))
    } catch (e) {
      setError(errorText(e))
    } finally {
      setSpeaking(false)
      setStatus('')
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-line bg-card2 px-6 py-5">
      <div className="flex items-center gap-2.5">
        <AudioLines size={17} className="text-accent" />
        <div className="text-[17px] font-semibold">Voiceover with ElevenLabs</div>
        <span className="flex-1" />
        <button className="text-muted hover:text-ink" onClick={onClose} disabled={speaking}>
          <X size={17} />
        </button>
      </div>
      {error && <div className="mt-3 text-[14.5px] text-[#ff6b6b]">{error}</div>}
      {!error && status && <div className="mt-3 text-[14.5px] text-muted">{status}…</div>}
      {pick && voice && (
        <>
          <div className="mt-4 flex items-center gap-4">
            <button onClick={() => hear(voice)} disabled={!voice.preview} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-black disabled:opacity-40" title="Hear a sample">
              {playing === voice.id ? <Pause size={16} fill="black" /> : <Play size={16} fill="black" className="ml-0.5" />}
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-semibold">
                {voice.name}
                <span className="ml-2 text-[13.5px] font-normal text-muted">{voice.mine ? 'your voice' : voice.library ? 'from the ElevenLabs library, added when used' : 'ElevenLabs voice'}</span>
              </div>
              <div className="truncate text-[14px] text-muted">{pick.why || voice.about}</div>
            </div>
            <select
              className="input w-[240px] py-2 text-[14px]"
              value={pick.id}
              disabled={speaking}
              onChange={(e) => setPick({ ...pick, id: e.target.value, why: voices.find((v) => v.id === e.target.value)?.about ?? '' })}
            >
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.mine ? ' (yours)' : v.library ? ' (library)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px] text-muted">
            <label className="flex items-center gap-2">
              Pace
              <input type="range" min={0.8} max={1.2} step={0.02} value={pick.speed} disabled={speaking} onChange={(e) => setPick({ ...pick, speed: +e.target.value })} />
              {pick.speed.toFixed(2)}×
            </label>
            <label className="flex items-center gap-2">
              Feeling
              <input type="range" min={0} max={0.6} step={0.05} value={pick.style} disabled={speaking} onChange={(e) => setPick({ ...pick, style: +e.target.value })} />
            </label>
            <span>
              {chars.toLocaleString()} characters{left !== undefined ? ` · ${left.toLocaleString()} left on your plan` : ''}
            </span>
            <span className="flex-1" />
            <button className="btn-accent px-5 py-2.5" onClick={go} disabled={speaking || (left !== undefined && left < chars)}>
              {speaking ? 'Speaking…' : 'Make the voiceover'}
            </button>
          </div>
          {left !== undefined && left < chars && <div className="mt-2 text-[14px] text-[#ff6b6b]">Your ElevenLabs plan has {left.toLocaleString()} characters left; this script needs {chars.toLocaleString()}.</div>}
        </>
      )}
    </div>
  )
}
