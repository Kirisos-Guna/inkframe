import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  Check,
  FileText,
  Folder,
  GraduationCap,
  Lightbulb,
  LineChart,
  Megaphone,
  Mic,
  Paperclip,
  Play,
  Pause,
  Users,
  Music,
  Sparkles,
  X
} from 'lucide-react'
import type { Effort, Project, ProjectSettings, Provider, VideoKind } from '@shared/types'
import { APP_NAME } from '@shared/brand'
import { fmtTime, useApp } from '@/store/app'
import { Chips, Row, Select, StepBadge, Waveform } from '@/components/ui'
import { CharacterSvg } from '@/components/CharacterSvg'
import { StylePreview } from '@/components/StylePreview'
import { ScriptWriter } from '@/components/ScriptWriter'

const TEMPLATES: Record<string, string> = {
  Explainer:
    'Explain one idea from the ground up. Start with a question the viewer already has, show the moving parts one at a time, and end on the one sentence they should remember.',
  'Case study':
    'Tell the before and after of one real result. Show the problem, the number that hurt, what changed step by step, and the final number big on screen.',
  'Sales pitch':
    'Open on the pain, show the offer as the obvious fix, prove it with one example, and end with a clear call to action.',
  Story: 'One character, one problem, three beats. Build tension, turn it, and land the payoff in the last part.',
  Tutorial: 'Show how to do it, one step per part. Number each step on screen and show the result at the end.'
}

const KINDS: { kind: VideoKind; sub: string; icon: typeof Lightbulb }[] = [
  { kind: 'Explainer', sub: 'Make an idea click', icon: Lightbulb },
  { kind: 'Story', sub: 'A narrative with a payoff', icon: BookOpen },
  { kind: 'Case study', sub: 'Real results, step by step', icon: LineChart },
  { kind: 'Tutorial', sub: 'Show how to do it', icon: GraduationCap },
  { kind: 'Sales pitch', sub: 'Sell an offer', icon: Megaphone }
]
const TONES = ['Calm', 'Nerdy', 'Energetic', 'Friendly', 'Serious', 'Funny', 'Warm', 'Bold'] as const
const CREATIVITY = [
  { v: 'Faithful', sub: 'Show what is said' },
  { v: 'Balanced', sub: 'A little extra' },
  { v: 'Storytelling', sub: 'Visual metaphors' },
  { v: 'Wild', sub: 'Surprise me' }
] as const
const ENGINES = ['Auto', 'Remotion', 'HyperFrames'] as const
const TRANSITIONS = ['None', 'Fade', 'Flash', 'Wipe', 'Slide', 'Zoom'] as const
const CAPTIONS = ['Off', 'Clean', 'Bold pop', 'Karaoke'] as const
const MODELS = ['Opus 5.5', 'Sonnet 5.5', 'Fable 5.1', 'Haiku 5.5']
const CODEX_MODELS = ['Codex default']

const defaultSettings = (): ProjectSettings => ({
  kind: 'Explainer',
  tone: ['Calm', 'Nerdy'],
  creativity: 'Storytelling',
  styleId: 'hand-drawn-board',
  characterIds: [],
  quality: { height: 1080, fps: 60 },
  checks: 'High',
  provider: 'Claude Code',
  model: 'Opus 5.5',
  effort: 'High',
  helpers: false,
  engine: 'Auto',
  transition: 'Fade',
  captions: 'Off',
  music: null
})

export default function NewVideo() {
  const { settings: app, styles, characters, go, showToast, upsertProject, status } = useApp()
  const [draft, setDraft] = useState<Project | null>(null)
  const [peaks, setPeaks] = useState<number[]>([])
  const [adding, setAdding] = useState(0)
  const [direction, setDirection] = useState('')
  const [script, setScript] = useState<string | null>(null)
  const [material, setMaterial] = useState<string[]>([])
  const [s, setS] = useState<ProjectSettings>(defaultSettings)
  const [playing, setPlaying] = useState(false)
  const [audio] = useState(() => new Audio())
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [writing, setWriting] = useState(false)
  const [allStyles, setAllStyles] = useState(false)
  const [styleDim, setStyleDim] = useState<'All' | '2D' | '3D'>('All')

  useEffect(() => {
    if (app) setS((x) => ({ ...x, provider: app.defaultProvider, model: app.defaultModel, effort: app.defaultEffort, checks: app.defaultChecks }))
  }, [app?.defaultProvider])

  // Follow the draft while the voiceover is being heard in the background.
  useEffect(() => {
    if (!draft) return
    return window.api.onProject((p) => p.id === draft.id && setDraft(p))
  }, [draft?.id])

  useEffect(() => {
    audio.onended = () => setPlaying(false)
    return () => audio.pause()
  }, [])

  const words = direction.trim() ? direction.trim().split(/\s+/).length : 0
  const style = styles.find((x) => x.id === s.styleId)
  const filtered = styles.filter((x) => styleDim === 'All' || x.dim === styleDim)
  // The chosen style always stays visible, even when the list is short.
  const shownStyles = allStyles ? filtered : [...filtered.slice(0, 8), ...filtered.slice(8).filter((x) => x.id === s.styleId)]
  const set = (patch: Partial<ProjectSettings>) => setS((x) => ({ ...x, ...patch }))

  async function addVoiceover(file: string) {
    setAdding(1)
    const t = setInterval(() => setAdding((a) => Math.min(95, a + 9)), 80)
    try {
      const { duration, peaks } = await window.api.media.probe(file)
      setPeaks(peaks)
      const name = file.split(/[\\/]/).pop()!
      const p = draft
        ? await window.api.projects.update(draft.id, { voiceover: { file, name, duration } })
        : await window.api.projects.create({ draft: true, voiceover: { file, name, duration }, title: name.replace(/\.[^.]+$/, '') })
      setDraft(p)
      audio.src = window.api.media.url(file)
    } catch (e) {
      showToast(`Could not read that file: ${(e as Error).message}`)
    } finally {
      clearInterval(t)
      setAdding(100)
    }
  }

  async function chooseVoiceover() {
    const [f] = await window.api.pick.file([{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a'] }])
    if (f) addVoiceover(f)
  }

  async function addMaterial() {
    const files = await window.api.pick.file(
      [{ name: 'Material', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'mp4', 'mov', 'pdf', 'txt', 'md', 'csv'] }],
      true
    )
    setMaterial((m) => [...new Set([...m, ...files])])
  }

  async function make() {
    if (!draft) return
    setBusy(true)
    try {
      const title = deriveTitle(direction) || draft.title
      const p = await window.api.projects.update(draft.id, {
        draft: false,
        title,
        direction,
        script: script ?? undefined,
        material,
        settings: s
      })
      upsertProject(p)
      await window.api.job.start(p.id)
      showToast(`${APP_NAME} is making your video`)
      go({ name: 'editor', id: p.id })
    } finally {
      setBusy(false)
    }
  }

  const voiceStatus = useMemo(() => {
    if (!draft) return null
    if (draft.transcribing) return 'working'
    if (draft.transcribeError) return 'error'
    return 'done'
  }, [draft])

  const toggleTone = (t: string) =>
    set({ tone: s.tone.includes(t) ? s.tone.filter((x) => x !== t) : [...s.tone, t].slice(-3) })

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-6 pb-6 pt-12 xl:flex-row xl:px-10 2xl:gap-9 2xl:px-12">
      <div className="min-w-0 flex-1">
        <h1 className="text-[34px] font-bold tracking-tight">New video</h1>
        <p className="mt-1 text-[17px] text-muted">
          Drop your voiceover, then tell Claude everything you have in mind. The more you say, the closer the first version.
        </p>

        {/* 1 · Voiceover */}
        <section className="card mt-7 px-8 py-6">
          <Header n={1} done={!!draft?.voiceover} title="Voiceover" right="Required" />
          {!draft?.voiceover || adding < 100 ? (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDrag(true)
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDrag(false)
                const f = e.dataTransfer.files[0]
                if (f) addVoiceover(window.api.pathOf(f))
              }}
              className={`mt-5 flex items-center gap-5 rounded-xl border border-dashed px-8 py-6 ${
                drag ? 'border-accent bg-accent/5' : 'border-line'
              }`}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-line bg-card2">
                <Mic size={20} />
              </div>
              <div className="flex-1">
                <div className="text-[17px] font-semibold">{adding ? `Adding the file · ${adding}%` : 'Drop your voiceover'}</div>
                <div className="text-[15px] text-muted">MP3, WAV or M4A. {APP_NAME} finds the words and splits it into parts.</div>
              </div>
              <button className="btn" onClick={chooseVoiceover}>
                Choose a file
              </button>
            </div>
          ) : (
            <div className="mt-5 flex items-center gap-5 rounded-xl border border-line bg-[#0f0f11] px-5 py-3.5">
              <button
                onClick={() => {
                  if (playing) audio.pause()
                  else audio.play()
                  setPlaying(!playing)
                }}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-black"
              >
                {playing ? <Pause size={18} fill="black" /> : <Play size={18} fill="black" className="ml-0.5" />}
              </button>
              <div className="min-w-0">
                <div className="truncate text-[16px] font-semibold">{draft.voiceover.name}</div>
                <div className="text-[14px] text-muted">Adding the file · 100%</div>
              </div>
              <Waveform peaks={peaks} height={44} className="h-11 min-w-0 flex-1" />
              <button className="px-3 text-[15px] text-muted hover:text-ink" onClick={chooseVoiceover}>
                Replace
              </button>
            </div>
          )}
          <div className="mt-3 flex items-center gap-2 text-[14.5px] text-muted">
            <Folder size={15} />
            Saved in {app?.saveDir}
            {!draft && (
              <>
                {' · '}
                <button
                  className="font-semibold text-accent"
                  onClick={async () => {
                    const d = await window.api.pick.folder()
                    if (d) useApp.setState({ settings: await window.api.settings.set({ saveDir: d }) })
                  }}
                >
                  Change
                </button>
              </>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2 text-[15px]">
            <FileText size={15} className="text-accent" />
            <button className="font-semibold text-accent" onClick={() => setScript(script === null ? '' : null)}>
              Add your script (optional)
            </button>
            <span className="text-muted">· names and numbers come out exactly right</span>
            <span className="flex-1" />
            <button className="flex items-center gap-1.5 font-semibold text-accent" onClick={() => setWriting(true)}>
              <Sparkles size={15} /> Write the script with AI
            </button>
          </div>
          {writing && (
            <ScriptWriter
              onClose={() => setWriting(false)}
              onUse={(text, title) => {
                setScript(text)
                if (title && !direction.trim()) setDirection(title)
                setWriting(false)
              }}
            />
          )}
          {script !== null && (
            <textarea
              className="input mt-3 h-32 resize-none text-[15px] leading-relaxed"
              placeholder={`Paste the script you read. ${APP_NAME} lines it up with the words it hears.`}
              value={script}
              onChange={(e) => setScript(e.target.value)}
            />
          )}
        </section>

        {/* 2 · Direction */}
        <section className="card mt-5 px-8 py-6">
          <Header n={2} done={words >= 5} title="Direction" right="The most important step" />
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            Describe the video like you would to a director: the idea, the scenes you imagine, what to show when. Then pick the
            options below.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <span className="text-[15px] text-muted">Start from a template:</span>
            {Object.keys(TEMPLATES).map((t) => (
              <button key={t} className="chip" onClick={() => setDirection(TEMPLATES[t])}>
                {t}
              </button>
            ))}
          </div>
          <div className="relative mt-4">
            <textarea
              className="input h-[216px] resize-none px-4 py-4 text-[17px] leading-[1.75]"
              placeholder="e.g. One prompt, followed from the phone to the chip and back…"
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
            />
            <MentionMenu text={direction} files={material} onPick={(f) => setDirection(direction.replace(/@\w*$/, '@' + base(f) + ' '))} />
          </div>
          <div className="mt-2.5 flex justify-between text-[14px] text-dim">
            <span>{words} words</span>
            <span>Type @ to point at one of your files (add them in step 3)</span>
          </div>

          <div className="mt-6 text-[15px] font-semibold text-ink/90">What kind of video</div>
          <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3">
            {KINDS.map(({ kind, sub, icon: Icon }) => (
              <button
                key={kind}
                onClick={() => set({ kind })}
                className={`flex min-w-0 items-start gap-3 rounded-xl border px-4 py-3 text-left ${
                  s.kind === kind ? 'border-accent bg-accent/[.06]' : 'border-line bg-card2 hover:border-[#3a3a40]'
                }`}
              >
                <Icon size={17} className={`mt-1 shrink-0 ${s.kind === kind ? 'text-accent' : 'text-ink/70'}`} />
                <div>
                  <div className="truncate text-[16px] font-medium">{kind}</div>
                  <div className="text-[13px] leading-tight text-muted">{sub}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 2xl:grid-cols-2 2xl:gap-8">
            <div>
              <div className="text-[15px] font-semibold text-ink/90">
                Tone <span className="font-normal text-dim">· up to 3</span>
              </div>
              <div className="mt-3">
                <Chips options={TONES} value={s.tone as (typeof TONES)[number][]} onToggle={toggleTone} />
              </div>
            </div>
            <div>
              <div className="text-[15px] font-semibold text-ink/90">Creativity</div>
              <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2">
                {CREATIVITY.map((c) => (
                  <button
                    key={c.v}
                    onClick={() => set({ creativity: c.v })}
                    className={`rounded-lg border px-3 py-2 text-left ${
                      s.creativity === c.v ? 'border-accent bg-accent/[.06]' : 'border-line bg-card2'
                    }`}
                  >
                    <div className="text-[14px] font-medium">{c.v}</div>
                    <div className="text-[12px] text-muted">{c.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 3 · Material */}
        <section className="card mt-5 px-8 py-6">
          <Header n={3} done={material.length > 0} title="Material" right="Optional" />
          <p className="mt-3 text-[15px] text-muted">
            Screenshots, logos, charts or clips you want on screen. Point at them with @ in your direction, or drag them onto a part
            later.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {material.map((m) => (
              <span key={m} className="chip flex items-center gap-2">
                <Paperclip size={13} />
                {base(m)}
                <button onClick={() => setMaterial(material.filter((x) => x !== m))}>
                  <X size={13} className="text-muted" />
                </button>
              </span>
            ))}
            <button className="btn" onClick={addMaterial}>
              <Paperclip size={15} /> Add files
            </button>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="text-[15px] font-semibold text-ink/90">Background music</div>
            {s.music ? (
              <>
                <span className="chip flex items-center gap-2">
                  <Music size={13} /> {base(s.music.file)}
                  <button onClick={() => set({ music: null })}>
                    <X size={13} className="text-muted" />
                  </button>
                </span>
                <label className="flex items-center gap-2 text-[14px] text-muted">
                  Volume
                  <input type="range" min={0.05} max={0.6} step={0.05} value={s.music.volume} onChange={(e) => set({ music: { ...s.music!, volume: +e.target.value } })} className="accent-accent" />
                </label>
                <span className="text-[13px] text-dim">It ducks under the voice by itself.</span>
              </>
            ) : (
              <button
                className="btn"
                onClick={async () => {
                  const [m] = await window.api.pick.file([{ name: 'Music', extensions: ['mp3', 'wav', 'm4a', 'ogg'] }])
                  if (m) set({ music: { file: m, volume: 0.25 } })
                }}
              >
                <Music size={15} /> Add music
              </button>
            )}
          </div>
        </section>

        {/* 4 · Look */}
        <section className="card mb-10 mt-5 px-8 py-6">
          <Header n={4} done title="Look" right="Change it any time" />
          <div className="mt-4 flex items-center justify-between">
            <div className="text-[15px] font-semibold text-ink/90">Style</div>
            <div className="flex items-center gap-2">
              {(['All', '2D', '3D'] as const).map((d) => (
                <button key={d} className={`chip px-2.5 py-1 text-[12.5px] ${styleDim === d ? 'chip-on' : ''}`} onClick={() => setStyleDim(d)}>
                  {d}
                </button>
              ))}
              <button className="ml-2 text-[14px] font-semibold text-accent" onClick={() => setAllStyles(!allStyles)}>
                {allStyles ? 'Show fewer' : `Show all ${styles.length} styles`}
              </button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
            {shownStyles.map((st) => (
              <button
                key={st.id}
                onClick={() => set({ styleId: st.id })}
                className={`overflow-hidden rounded-xl border text-left ${
                  s.styleId === st.id ? 'border-accent' : 'border-line hover:border-[#3a3a40]'
                }`}
              >
                <StylePreviewLazy id={st.id} />
                <div className="flex items-center justify-between px-3 py-2 text-[14px] font-medium">
                  {st.name}
                  {s.styleId === st.id && <Check size={15} className="text-accent" />}
                </div>
              </button>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between">
            <div className="text-[15px] font-semibold text-ink/90">Characters</div>
            <button className="text-[14px] font-semibold text-accent" onClick={() => go({ name: 'characters' })}>
              Make a character
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {characters.length === 0 && <div className="text-[14px] text-dim">No characters yet. Videos work fine without them.</div>}
            {characters.map((c) => {
              const on = s.characterIds.includes(c.id)
              return (
                <button
                  key={c.id}
                  onClick={() =>
                    set({ characterIds: on ? s.characterIds.filter((x) => x !== c.id) : [...s.characterIds, c.id] })
                  }
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${on ? 'border-accent bg-accent/[.06]' : 'border-line bg-card2'}`}
                >
                  <div className="h-9 w-9 overflow-hidden rounded-lg bg-[#0d0d0f]">
                    <CharacterSvg c={c} mini />
                  </div>
                  <span className="text-[14px] font-medium">{c.name}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 2xl:grid-cols-3">
            <div>
              <div className="text-[15px] font-semibold text-ink/90">Drawn with</div>
              <div className="mt-3">
                <Chips options={ENGINES} value={s.engine ?? 'Auto'} onToggle={(engine) => set({ engine })} size="sm" />
              </div>
              <div className="mt-2 text-[13px] text-dim">
                {(s.engine ?? 'Auto') === 'Auto' ? 'The style decides: React scenes, real 3D, or HTML.' : s.engine === 'HyperFrames' ? 'HTML + GSAP: great for kinetic type, charts and motion graphics.' : 'React scenes: hand-drawn lines and real 3D.'}
              </div>
            </div>
            <div>
              <div className="text-[15px] font-semibold text-ink/90">Between parts</div>
              <div className="mt-3">
                <Chips options={TRANSITIONS} value={s.transition ?? 'None'} onToggle={(transition) => set({ transition })} size="sm" />
              </div>
            </div>
            <div>
              <div className="text-[15px] font-semibold text-ink/90">Captions</div>
              <div className="mt-3">
                <Chips options={CAPTIONS} value={s.captions ?? 'Off'} onToggle={(captions) => set({ captions })} size="sm" />
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Summary */}
      <aside className="h-fit w-full shrink-0 xl:sticky xl:top-6 xl:w-[380px] 2xl:w-[440px]">
        <div className="card px-7 py-6 xl:mt-[92px]">
          <div className="mb-3 text-[19px] font-semibold">Your video</div>
          <Row k="Voiceover" v={draft?.voiceover ? fmtTime(draft.voiceover.duration) : '—'} />
          <Row k="Parts" v={draft?.words.length ? `about ${Math.max(1, Math.round(draft.voiceover!.duration / 10))}` : '—'} />
          <Row k="Material" v={`${material.length} file${material.length === 1 ? '' : 's'}`} />
          <Row k="Type" v={s.kind} />
          <Row k="Tone" v={s.tone.join(', ') || '—'} />
          <Row k="Creativity" v={s.creativity} />
          <Row k="Style" v={style?.name ?? '—'} />
          <Row k="Captions" v={s.captions ?? 'Off'} />
          <Row k="Characters" v={s.characterIds.length ? characters.filter((c) => s.characterIds.includes(c.id)).map((c) => c.name).join(', ') : '—'} />
          <Row
            k="Quality"
            v={
              <select
                className="bg-transparent text-right font-semibold outline-none"
                value={`${s.quality.height}-${s.quality.fps}`}
                onChange={(e) => {
                  const [h, f] = e.target.value.split('-').map(Number)
                  set({ quality: { height: h as 1080, fps: f as 60 } })
                }}
              >
                {['720-30', '1080-30', '1080-60', '2160-30', '2160-60'].map((q) => (
                  <option key={q} value={q} className="bg-card">
                    {q.replace('-', 'p · ').replace('2160p', '4K')} fps
                  </option>
                ))}
              </select>
            }
          />
          <Row
            k="Checks"
            v={
              <select
                className="bg-transparent text-right font-semibold outline-none"
                value={s.checks}
                onChange={(e) => set({ checks: e.target.value as ProjectSettings['checks'] })}
              >
                {['Off', 'Low', 'Medium', 'High'].map((q) => (
                  <option key={q} className="bg-card">
                    {q}
                  </option>
                ))}
              </select>
            }
          />

          <div className="mt-5 rounded-xl border border-line bg-[#101012] px-5 py-4">
            <div className="text-[14.5px] text-muted">Your voiceover</div>
            {!draft ? (
              <>
                <div className="mt-3 h-[3px] w-8 rounded bg-ink" />
                <div className="mt-4 text-[14.5px] text-muted">Drop a voiceover to start</div>
              </>
            ) : voiceStatus === 'working' ? (
              <>
                <div className="mt-1 text-[30px] font-bold tracking-tight">Working…</div>
                <div className="text-[14.5px] text-muted">You can keep writing while {APP_NAME} listens</div>
              </>
            ) : voiceStatus === 'error' ? (
              <>
                <div className="mt-1 text-[22px] font-bold">{fmtTime(draft.voiceover!.duration)}</div>
                <div className="text-[13.5px] text-accent">Could not hear the words: {draft.transcribeError}</div>
                <div className="text-[13px] text-muted">Claude will split it by time instead.</div>
              </>
            ) : (
              <>
                <div className="mt-1 text-[30px] font-bold tracking-tight">{fmtTime(draft.voiceover!.duration)}</div>
                <div className="text-[14.5px] text-muted">
                  Heard {draft.words.length} words · “{draft.words.slice(0, 7).map((w) => w.w).join(' ')}…”
                </div>
              </>
            )}
          </div>

          <div className="mt-5 flex gap-4">
            <div className="w-16 pt-[78px] text-[14.5px] text-muted">Made by</div>
            <div className="flex-1 space-y-2.5">
              <Select<Provider>
                value={s.provider}
                options={['Claude Code', 'Codex']}
                onChange={(provider) => set({ provider, model: provider === 'Codex' ? CODEX_MODELS[0] : 'Opus 5.5' })}
              />
              <Select value={s.model} options={s.provider === 'Codex' ? CODEX_MODELS : MODELS} onChange={(model) => set({ model })} />
              <Select<string>
                value={`Intelligence: ${s.effort}`}
                options={['Intelligence: Low', 'Intelligence: Medium', 'Intelligence: High']}
                onChange={(v) => set({ effort: v.split(': ')[1] as Effort })}
              />
              <label className="inline-flex cursor-pointer items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-[14.5px]">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-accent"
                  checked={s.helpers}
                  onChange={(e) => set({ helpers: e.target.checked })}
                />
                <Users size={14} /> Helpers
              </label>
            </div>
          </div>
          {(() => {
            const found = s.provider === 'Claude Code' ? status?.claude : status?.codex
            const signedOut = s.provider === 'Claude Code' && status?.claude && !status.claudeSignedIn
            const problem = found === false ? `${s.provider} not found on this computer. Set it in Settings.` : signedOut ? 'Claude Code is not signed in. Run claude in a terminal and sign in once.' : null
            return (
              <div className={`mt-4 flex items-center gap-2 text-[14.5px] ${problem ? 'text-accent2' : 'text-ok'}`}>
                {problem ? <X size={15} /> : <Check size={15} />}
                {problem ?? `Runs on your ${s.provider === 'Codex' ? 'ChatGPT' : 'Claude'} plan. No credits to buy.`}
              </div>
            )
          })()}
          <button
            className="btn-accent mt-4 w-full py-3.5 text-[17px]"
            disabled={!draft?.voiceover || busy || adding < 100}
            onClick={make}
          >
            Make my video <ArrowRight size={17} />
          </button>
        </div>
      </aside>
    </div>
  )
}

function Header({ n, done, title, right }: { n: number; done: boolean; title: string; right: string }) {
  return (
    <div className="flex items-center gap-4">
      <StepBadge n={n} done={done} />
      <div className="flex-1 text-[19px] font-semibold">{title}</div>
      <div className="text-[15px] text-muted">{right}</div>
    </div>
  )
}

function MentionMenu({ text, files, onPick }: { text: string; files: string[]; onPick: (f: string) => void }) {
  const m = text.match(/@(\w*)$/)
  if (!m) return null
  const list = files.filter((f) => base(f).toLowerCase().includes(m[1].toLowerCase()))
  return (
    <div className="absolute bottom-3 left-4 z-30 w-72 rounded-lg border border-line bg-[#141416] py-1 shadow-2xl">
      {list.length === 0 && <div className="px-3 py-2 text-[13px] text-muted">No files yet. Add them in step 3.</div>}
      {list.map((f) => (
        <button key={f} onClick={() => onPick(f)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] hover:bg-white/5">
          <Paperclip size={13} /> {base(f)}
        </button>
      ))}
    </div>
  )
}

const base = (f: string) => f.split(/[\\/]/).pop()!

function deriveTitle(direction: string) {
  const first = direction.split(/[.:\n]/)[0].trim()
  if (!first) return ''
  return first.length > 48 ? first.slice(0, 46).trim() + '…' : first
}

function StylePreviewLazy({ id }: { id: string }) {
  return (
    <div className="aspect-video w-full">
      <StylePreview id={id} />
    </div>
  )
}
