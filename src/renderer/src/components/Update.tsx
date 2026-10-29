import { useEffect, useState } from 'react'
import { ArrowDownToLine, RefreshCw, RotateCw, Sparkles } from 'lucide-react'
import { errorText, useApp } from '@/store/app'

type UpdateInfo = Awaited<ReturnType<typeof window.api.update.get>>

export function useUpdate() {
  const [u, setU] = useState<UpdateInfo | null>(null)
  useEffect(() => {
    window.api.update.get().then(setU)
    return window.api.update.on(setU)
  }, [])
  return u
}

/** A small card in the sidebar when a new version is out. */
export function UpdateBanner() {
  const u = useUpdate()
  if (!u || !['available', 'downloading', 'ready'].includes(u.state)) return null
  return (
    <div className="mx-3 mb-2 rounded-xl border border-accent/60 bg-accent/10 px-4 py-3">
      <div className="flex items-center gap-2 text-[14.5px] font-semibold text-accent2">
        <Sparkles size={14} /> Version {u.next} is out
      </div>
      {u.state === 'available' && (
        <button className="btn-accent mt-2 w-full py-1.5 text-[13.5px]" onClick={() => window.api.update.download()}>
          <ArrowDownToLine size={14} /> Download
        </button>
      )}
      {u.state === 'downloading' && (
        <div className="mt-2">
          <div className="h-1.5 overflow-hidden rounded bg-black/30">
            <div className="h-full bg-accent transition-all" style={{ width: `${u.percent ?? 0}%` }} />
          </div>
          <div className="mt-1 text-[12.5px] text-muted">Downloading · {u.percent ?? 0}%</div>
        </div>
      )}
      {u.state === 'ready' && (
        <button className="btn-accent mt-2 w-full py-1.5 text-[13.5px]" onClick={() => window.api.update.install().catch((e) => useApp.getState().showToast(errorText(e)))}>
          <RotateCw size={14} /> Restart to update
        </button>
      )}
    </div>
  )
}

/** The Updates section in Settings. */
export function UpdateSettings() {
  const u = useUpdate()
  const [checking, setChecking] = useState(false)
  if (!u) return null
  const line =
    u.state === 'checking' ? 'Checking…'
    : u.state === 'none' ? 'You have the newest version.'
    : u.state === 'available' ? `Version ${u.next} is out.`
    : u.state === 'downloading' ? `Downloading ${u.next} · ${u.percent ?? 0}%`
    : u.state === 'ready' ? `Version ${u.next} is downloaded. Restart to finish.`
    : u.state === 'error' ? `Could not check: ${u.message}`
    : 'Checks for new versions on its own every few hours.'
  return (
    <section className="card mt-5 px-7 py-5">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="text-[19px] font-semibold">Updates</div>
          <div className="mt-1 text-[14px] text-muted">
            You have version {u.version}. {line}
          </div>
        </div>
        {u.state === 'available' && (
          <button className="btn-accent" onClick={() => window.api.update.download()}>
            <ArrowDownToLine size={15} /> Download {u.next}
          </button>
        )}
        {u.state === 'ready' && (
          <button className="btn-accent" onClick={() => window.api.update.install().catch((e) => useApp.getState().showToast(errorText(e)))}>
            <RotateCw size={15} /> Restart to update
          </button>
        )}
        {!['available', 'downloading', 'ready'].includes(u.state) && (
          <button
            className="btn"
            disabled={checking || u.state === 'checking'}
            onClick={async () => {
              setChecking(true)
              try {
                await window.api.update.check()
              } finally {
                setChecking(false)
              }
            }}
          >
            <RefreshCw size={15} className={checking ? 'animate-spin' : ''} /> Check for updates
          </button>
        )}
      </div>
      {u.state === 'available' && u.notes && <div className="mt-3 max-h-40 overflow-y-auto whitespace-pre-line rounded-lg bg-[#0f0f11] p-3 text-[13px] text-ink/80">{u.notes}</div>}
    </section>
  )
}
