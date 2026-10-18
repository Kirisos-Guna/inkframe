import { useEffect, useState } from 'react'
import { ArrowRight, Check, Link2, Sparkles, Trash2, Upload } from 'lucide-react'
import type { Effort, LearnSession, Provider } from '@shared/types'
import { APP_NAME } from '@shared/brand'
import { SHOWPIECES } from '@shared/styles'
import { useApp } from '@/store/app'
import { Segmented, Select } from '@/components/ui'
import { StylePreview } from '@/components/StylePreview'

type Tab = 'Library' | 'My styles' | 'Learn from a video'

export default function Styles({ initialTab }: { initialTab?: Tab }) {
  const { styles } = useApp()
  const [tab, setTab] = useState<Tab>(initialTab ?? 'Library')
  const [dim, setDim] = useState<'All' | '2D' | '3D'>('All')
  const mine = styles.filter((s) => s.custom)
  const list = (tab === 'My styles' ? mine : styles.filter((s) => !s.custom)).filter((s) => dim === 'All' || s.dim === dim)

  return (
    <div className="px-6 pb-6 pt-12 2xl:px-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[34px] font-bold tracking-tight">Styles</h1>
          <p className="mt-1 text-[17px] text-muted">
            Pick a look for the whole video, and add showpiece moments for the big beats. Or teach {APP_NAME} a new look from any video.
          </p>
        </div>
        <button className="btn mt-2 px-5 py-3 text-[16px]" onClick={() => setTab('Learn from a video')}>
          <Link2 size={16} /> Learn from a video
        </button>
      </div>
      <div className="mt-7 flex gap-8 border-b border-line/70">
        {(['Library', 'My styles', 'Learn from a video'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`tab flex items-center gap-2 px-4 text-[17px] ${tab === t ? 'tab-on font-semibold' : ''}`}>
            {t}
            {t === 'My styles' && <span className="rounded-full bg-card2 px-1.5 text-[12px] text-muted">{mine.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'Learn from a video' ? (
        <Learn />
      ) : (
        <>
          <div className="mt-6 flex gap-2">
            {(['All', '2D', '3D'] as const).map((d) => (
              <button key={d} className={`chip px-3.5 py-2 text-[15px] ${dim === d ? 'chip-on' : ''}`} onClick={() => setDim(d)}>
                {d}
              </button>
            ))}
          </div>
          <div className="mt-6 flex items-baseline gap-3">
            <h2 className="text-[19px] font-semibold">{tab === 'My styles' ? 'Your styles' : 'Whole video'}</h2>
            <span className="text-[16px] text-muted">One look for every part of the video</span>
          </div>
          {tab === 'My styles' && !mine.length && (
            <div className="mt-6 rounded-2xl border border-dashed border-line px-8 py-10 text-center text-muted">
              No styles of your own yet.{' '}
              <button className="font-semibold text-accent" onClick={() => setTab('Learn from a video')}>
                Learn one from a video
              </button>
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {list.map((s) => (
              <div key={s.id} className="group">
                <div className="relative aspect-video overflow-hidden rounded-xl border border-line">
                  <StylePreview id={s.id} />
                  {s.custom && (
                    <button
                      className="absolute right-2 top-2 hidden rounded-md bg-black/70 p-1.5 group-hover:block"
                      onClick={async () => {
                        if (!confirm(`Delete the style “${s.name}”?`)) return
                        await window.api.styles.remove(s.id)
                        useApp.setState({ styles: await window.api.styles.list() })
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="text-[18px] font-semibold leading-tight">{s.name}</div>
                  <div className="flex shrink-0 gap-1.5">
                    {s.tags.slice(0, 2).map((t) => (
                      <span key={t} className="rounded-md border border-line bg-card2 px-2 py-0.5 text-[13.5px] text-ink/85">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-1.5 text-[15px] leading-snug text-muted">{s.description}</div>
              </div>
            ))}
          </div>
          {tab === 'Library' && (
            <>
              <div className="mt-10 flex items-baseline gap-3">
                <h2 className="text-[19px] font-semibold">Showpiece moments</h2>
                <span className="text-[16px] text-muted">Drop one on a big beat. Mention it in a comment, e.g. “use Big number here”</span>
              </div>
              <div className="mb-10 mt-4 grid grid-cols-3 gap-4">
                {SHOWPIECES.map((sp) => (
                  <div key={sp.id} className="flex gap-3 rounded-xl border border-line bg-card px-4 py-3.5">
                    <Sparkles size={17} className="mt-0.5 shrink-0 text-accent" />
                    <div>
                      <div className="text-[16px] font-semibold">{sp.name}</div>
                      <div className="text-[14px] text-muted">{sp.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

const STEPS = ['Getting the video', 'Measuring pacing, colour, texture and camera', 'Building the style and testing it on your line', 'Ready for you to check']

function Learn() {
  const { status, showToast, settings } = useApp()
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [mode, setMode] = useState<LearnSession['mode']>('The look')
  const [line, setLine] = useState('')
  const [provider, setProvider] = useState<Provider>(settings?.defaultProvider ?? 'Claude Code')
  const [model, setModel] = useState(settings?.defaultModel ?? 'Opus 5.5')
  const [effort, setEffort] = useState<Effort>('High')
  const [sessions, setSessions] = useState<LearnSession[]>([])
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    window.api.learn.list().then((l) => {
      setSessions(l)
      if (l[0]) setOpenId(l[0].id)
    })
    return window.api.onLearn((s) => {
      setSessions((list) => [s, ...list.filter((x) => x.id !== s.id)].sort((a, b) => b.at - a.at))
      if (s.status === 'Ready to check') window.api.styles.list().then((styles) => useApp.setState({ styles }))
    })
  }, [])

  const open = sessions.find((s) => s.id === openId)

  async function start() {
    const source = file ?? url.trim()
    if (!source) return
    if (!file && !status?.ytDlp) {
      showToast('Links need yt-dlp. Install it, or drop a video file instead.')
      return
    }
    const s = await window.api.learn.start({ source, name: name.trim(), mode, testLine: line.trim() || undefined, provider, model, effort })
    setSessions((l) => [s, ...l])
    setOpenId(s.id)
    setUrl('')
    setFile(null)
    setName('')
    showToast('Learning started. You can leave this page: it carries on.')
  }

  return (
    <div className="mt-8 flex flex-col gap-6 xl:flex-row">
      <div className="w-full shrink-0 xl:w-[560px] 2xl:w-[600px]">
        <div className="card px-7 py-6">
          <div className="text-[19px] font-semibold">Learn a style from any video</div>
          <p className="mt-2 text-[15.5px] leading-relaxed text-muted">
            Paste a link or drop a video. {APP_NAME} measures the look, then Claude builds it as a style you can reuse and tests it on one of your lines. It learns the
            look only, never the characters, logos or footage.
          </p>
          <div className="mt-5 flex gap-3">
            <input className="input text-[15px]" placeholder="https://youtube.com/watch?v=..." value={url} onChange={(e) => setUrl(e.target.value)} disabled={!!file} />
            <button className="btn-accent shrink-0 px-5 text-[16px]" onClick={start} disabled={!url.trim() && !file}>
              <ArrowRight size={16} /> Learn
            </button>
          </div>
          {!status?.ytDlp && <div className="mt-2 text-[13px] text-dim">Links need yt-dlp on this computer (set it in Settings). Files always work.</div>}
          <button
            className="mt-3 flex w-full items-center gap-4 rounded-xl border border-dashed border-line px-5 py-4 text-left hover:border-[#45454c]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const f = e.dataTransfer.files[0]
              if (f) setFile(window.api.pathOf(f))
            }}
            onClick={async () => {
              const [f] = await window.api.pick.file([{ name: 'Video', extensions: ['mp4', 'mov', 'webm', 'mkv'] }])
              if (f) setFile(f)
            }}
          >
            <Upload size={17} className="text-ink/80" />
            <div>
              <div className="text-[16px] font-semibold">{file ? file.split(/[\\/]/).pop() : 'Or drop a video file'}</div>
              <div className="text-[14px] text-muted">{file ? 'Click to choose another' : 'MP4, MOV, WebM, MKV'}</div>
            </div>
            {file && (
              <span
                className="ml-auto text-[14px] text-muted hover:text-ink"
                onClick={(e) => {
                  e.stopPropagation()
                  setFile(null)
                }}
              >
                Remove
              </span>
            )}
          </button>
          <div className="mt-5 grid grid-cols-[1fr_auto] gap-4">
            <div>
              <div className="label mb-2">Name · optional</div>
              <input className="input" placeholder="e.g. Neon Ledger" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <div className="label mb-2">Learn</div>
              <Segmented options={['The look', 'Look + pacing'] as const} value={mode} onChange={setMode} />
            </div>
          </div>
          <div className="label mb-2 mt-4">Test it on your line · optional</div>
          <input className="input" placeholder="A line from one of your voiceovers" value={line} onChange={(e) => setLine(e.target.value)} />
          <div className="mt-4 flex gap-4">
            <div className="pt-6 text-[14.5px] text-muted">Built by</div>
            <div className="grid flex-1 grid-cols-2 gap-2.5">
              <Select<Provider> value={provider} options={['Claude Code', 'Codex']} onChange={setProvider} />
              <Select value={model} options={provider === 'Codex' ? ['gpt-5-codex', 'gpt-5'] : ['Opus 5.5', 'Sonnet 5.5', 'Fable 5.1']} onChange={setModel} />
              <Select<string>
                className="col-span-2"
                value={`Intelligence: ${effort}`}
                options={['Intelligence: Low', 'Intelligence: Medium', 'Intelligence: High']}
                onChange={(v) => setEffort(v.split(': ')[1] as Effort)}
              />
            </div>
          </div>
          <div className="mt-4 text-[13.5px] leading-snug text-muted">
            Learning takes about 10 to 30 minutes and uses a good share of your Claude limit. A strong model (Opus or Fable) learns best.
          </div>
        </div>
        {sessions.length > 0 && (
          <>
            <div className="mb-3 mt-7 text-[15.5px] text-muted">Your learning sessions</div>
            <div className="space-y-2">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setOpenId(s.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left ${openId === s.id ? 'border-accent/70 bg-card' : 'border-line bg-card'}`}
                >
                  <span className="flex-1 truncate text-[16px] font-semibold">{s.name || 'Untitled'}</span>
                  <span className={`rounded-md px-2 py-0.5 text-[13.5px] font-medium ${s.status === 'Ready to check' ? 'bg-accent/15 text-accent2' : s.status === 'Failed' ? 'text-red-400' : 'text-muted'}`}>
                    {s.status}
                  </span>
                  <span className="text-[13.5px] text-muted">{ago(s.at)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {open && (
        <div className="card h-fit min-w-0 flex-1 px-7 py-6">
          <div className="flex items-start">
            <div className="min-w-0 flex-1">
              <div className="text-[20px] font-semibold">{open.status === 'Ready to check' ? open.name : 'Learning a style'}</div>
              <div className="truncate text-[14.5px] text-muted">{open.source}</div>
            </div>
            <button className="p-2 text-muted hover:text-ink" onClick={() => navigator.clipboard.writeText(open.source)} title="Copy the source">
              <Link2 size={16} />
            </button>
            <button
              className="p-2 text-muted hover:text-ink"
              onClick={async () => {
                await window.api.learn.remove(open.id)
                setSessions((l) => l.filter((x) => x.id !== open.id))
                setOpenId(null)
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="mt-5 space-y-3.5">
            {STEPS.map((label, i) => {
              const done = open.step > i || (i === 3 && open.status === 'Ready to check')
              const active = open.step === i && open.status !== 'Failed' && open.status !== 'Ready to check'
              return (
                <div key={label} className="flex items-center gap-3 text-[16.5px]">
                  {done && i < 3 ? (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ok">
                      <Check size={15} strokeWidth={3} className="text-white" />
                    </span>
                  ) : active ? (
                    <span className="flex h-7 w-7 items-center justify-center">
                      <span className="spinner !h-6 !w-6" />
                    </span>
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-card2 text-[13px] text-muted">{i + 1}</span>
                  )}
                  <span className={active || (i === 3 && done) ? 'font-semibold' : done ? '' : 'text-ink/75'}>{label}</span>
                  {active && <span className="text-[14.5px] text-muted">· {open.detail}</span>}
                </div>
              )
            })}
          </div>
          {open.error && <div className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-[14px] text-red-300">{open.error}</div>}
          {(open.testClip || open.frames.length > 0) && (
            <>
              <div className="mt-6 text-[19px] font-semibold">
                The style, on your line <span className="text-[14px] font-normal text-muted">· test 1</span>
              </div>
              {open.testClip && <video src={window.api.media.url(open.testClip)} controls autoPlay loop className="mt-3 w-full rounded-xl border border-line bg-black" />}
              <div className="mt-3 grid grid-cols-3 gap-2">
                {open.frames.slice(0, 6).map((f) => (
                  <img key={f} src={window.api.media.url(f)} className="aspect-video w-full rounded-lg border border-line object-cover" />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

const ago = (t: number) => {
  const s = (Date.now() - t) / 1000
  if (s < 60) return 'Just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return new Date(t).toLocaleDateString()
}
