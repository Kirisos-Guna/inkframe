import { useEffect, useState } from 'react'
import { CheckCircle2, FolderOpen, XCircle } from 'lucide-react'
import type { AppSettings, ChecksLevel, Effort, Provider } from '@shared/types'
import { APP_NAME, APP_VERSION } from '@shared/brand'
import { useApp } from '@/store/app'
import { Select } from '@/components/ui'
import { UpdateSettings } from '@/components/Update'

export default function Settings() {
  const { settings, status } = useApp()
  const [s, setS] = useState<AppSettings | undefined>(settings)
  useEffect(() => setS(settings), [settings])
  if (!s) return null

  const save = async (patch: Partial<AppSettings>) => {
    const next = await window.api.settings.set(patch)
    useApp.setState({ settings: next, status: await window.api.status() })
  }

  const pathRow = (label: string, key: keyof AppSettings, ok: boolean | undefined, help: string, ext = 'exe') => (
    <div className="flex items-center gap-4 border-t border-line/70 py-4 first:border-0">
      {ok ? <CheckCircle2 size={18} className="shrink-0 text-ok" /> : <XCircle size={18} className="shrink-0 text-accent" />}
      <div className="w-56 shrink-0">
        <div className="text-[15.5px] font-semibold">{label}</div>
        <div className="text-[13px] text-muted">{help}</div>
      </div>
      <input
        className="input text-[14px]"
        value={s[key] as string}
        placeholder="Found automatically"
        onChange={(e) => setS({ ...s, [key]: e.target.value })}
        onBlur={(e) => save({ [key]: e.target.value })}
      />
      <button
        className="btn shrink-0 px-3"
        onClick={async () => {
          const [f] = await window.api.pick.file([{ name: label, extensions: ext === 'bin' ? ['bin'] : ['exe', 'cmd', 'bat', '*'] }])
          if (f) save({ [key]: f })
        }}
      >
        <FolderOpen size={15} />
      </button>
    </div>
  )

  return (
    <div className="mx-auto max-w-[1000px] px-12 pb-6 pt-12">
      <h1 className="text-[34px] font-bold tracking-tight">Settings</h1>
      <p className="mt-1 text-[17px] text-muted">
        {APP_NAME} {APP_VERSION} runs everything on this computer, with the AI tools you already pay for.
      </p>

      <UpdateSettings />

      <section className="card mt-5 px-7 py-5">
        <div className="text-[19px] font-semibold">Where videos are saved</div>
        <div className="mt-3 flex gap-3">
          <input className="input" value={s.saveDir} readOnly />
          <button
            className="btn shrink-0"
            onClick={async () => {
              const d = await window.api.pick.folder()
              if (d) save({ saveDir: d })
            }}
          >
            Change
          </button>
          <button className="btn shrink-0" onClick={() => window.api.shell.open(s.saveDir)}>
            Open
          </button>
        </div>
      </section>

      <section className="card mt-5 px-7 py-5">
        <div className="mb-4 text-[19px] font-semibold">Made by (default for new videos)</div>
        <div className="grid grid-cols-4 gap-3">
          <Select<Provider> value={s.defaultProvider} options={['Claude Code', 'Codex']} onChange={(v) => save({ defaultProvider: v, defaultModel: v === 'Codex' ? 'Codex default' : 'Opus 5.5' })} />
          <Select value={s.defaultModel} options={s.defaultProvider === 'Codex' ? ['Codex default'] : ['Opus 5.5', 'Sonnet 5.5', 'Fable 5.1', 'Haiku 5.5']} onChange={(v) => save({ defaultModel: v })} />
          <Select<string>
            value={`Intelligence: ${s.defaultEffort}`}
            options={['Intelligence: Low', 'Intelligence: Medium', 'Intelligence: High']}
            onChange={(v) => save({ defaultEffort: v.split(': ')[1] as Effort })}
          />
          <Select<string> value={`Checks: ${s.defaultChecks}`} options={['Checks: Off', 'Checks: Low', 'Checks: Medium', 'Checks: High']} onChange={(v) => save({ defaultChecks: v.split(': ')[1] as ChecksLevel })} />
        </div>
      </section>

      <section className="card mt-5 px-7 py-5">
        <div className="text-[19px] font-semibold">Writing done by</div>
        <div className="mb-4 mt-1 text-[14px] text-muted">Scripts, titles, descriptions and captions.</div>
        <div className="grid grid-cols-4 gap-3">
          <Select<Provider> value={s.writerProvider ?? 'Codex'} options={['Codex', 'Claude Code']} onChange={(v) => save({ writerProvider: v })} />
          {(s.writerProvider ?? 'Codex') === 'Codex' && (
            <Select value={s.writerModel ?? 'Codex default'} options={['Codex default']} onChange={(v) => save({ writerModel: v })} />
          )}
        </div>
        {(s.writerProvider ?? 'Codex') === 'Codex' && !status?.codex && (
          <div className="mt-3 text-[13.5px] text-accent2">Codex is not on this computer, so Claude Code writes instead. Install the Codex app and sign in to use it.</div>
        )}
      </section>

      <section className="card mb-10 mt-5 px-7 py-3">
        <div className="pb-1 pt-3 text-[19px] font-semibold">Tools on this computer</div>
        {pathRow('Claude Code', 'claudePath', status?.claude && status.claudeSignedIn, status?.claude && !status.claudeSignedIn ? 'Found, but not signed in. Install the Claude Code CLI, run claude in a terminal and sign in once.' : 'Makes the videos. Install it and sign in once.')}
        {pathRow('Codex', 'codexPath', status?.codex, 'Optional second maker.')}
        {pathRow('whisper.cpp', 'whisperPath', status?.whisper, 'Hears the words in your voiceover. Downloaded the first time.')}
        {pathRow('Whisper model', 'whisperModel', status?.whisper, 'ggml model file (.bin).', 'bin')}
        {pathRow('yt-dlp', 'ytDlpPath', status?.ytDlp, 'Optional. Only for learning styles from links.')}
        <div className="flex items-center gap-4 border-t border-line/70 py-4">
          {status?.ffmpeg ? <CheckCircle2 size={18} className="text-ok" /> : <XCircle size={18} className="text-accent" />}
          <div className="text-[15.5px] font-semibold">FFmpeg</div>
          <div className="text-[13px] text-muted">Built in. Puts the parts and the voiceover together.</div>
        </div>
      </section>
    </div>
  )
}
