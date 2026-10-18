import { useRef, useState } from 'react'
import { Lock, Palette, Scissors } from 'lucide-react'
import type { Part, Project } from '@shared/types'
import { fmtTime } from '@/store/app'
import { Waveform } from '@/components/ui'

const LABEL: Record<string, string> = {
  'Up to date': 'Up to date',
  Rendered: 'Up to date',
  'Making it again': 'Making it again',
  Designing: 'Designing',
  Rendering: 'Rendering',
  Designed: 'Designed',
  Failed: 'Failed'
}

export function Timeline({
  p,
  peaks,
  time,
  zoom,
  selected,
  changed,
  onSelect,
  onSeek,
  onDropMaterial,
  onCut
}: {
  p: Project
  peaks: number[]
  time: number
  zoom: number
  selected: string[]
  changed: string[]
  onSelect: (id: string, shift: boolean) => void
  onSeek: (t: number) => void
  onDropMaterial: (partId: string, file: string) => void
  onCut: (from: number, to: number) => void
}) {
  const dur = p.voiceover?.duration || 1
  const wrap = useRef<HTMLDivElement>(null)
  const [cut, setCut] = useState<{ a: number; b: number; dragging: boolean } | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const pct = (t: number) => `${(t / dur) * 100}%`
  const tAt = (clientX: number) => {
    const r = wrap.current!.getBoundingClientRect()
    return Math.max(0, Math.min(dur, ((clientX - r.left) / r.width) * dur))
  }
  const ticks = Array.from({ length: Math.floor(dur / 5) + 1 }, (_, i) => i * 5)
  const working = p.job.running

  return (
    <div className="overflow-x-auto px-5 pb-3">
      <div ref={wrap} className="relative" style={{ width: `${100 * zoom}%`, minWidth: '100%' }}>
        {/* ruler */}
        <div className="relative h-7 cursor-pointer" onMouseDown={(e) => onSeek(tAt(e.clientX))}>
          {ticks.map((t) => (
            <span key={t} className="absolute top-1 -translate-x-1/2 text-[13px] text-muted" style={{ left: pct(t) }}>
              {fmtTime(t)}
            </span>
          ))}
        </div>
        {/* parts */}
        <div className="relative h-[100px]">
          {p.parts.map((part) => (
            <PartTile
              key={part.id}
              part={part}
              left={pct(part.start)}
              width={`calc(${pct(part.end - part.start)} - 4px)`}
              selected={selected.includes(part.id)}
              changed={changed.includes(part.id)}
              showBadges={working || p.parts.some((x) => x.status === 'Making it again')}
              over={over === part.id}
              onClick={(e) => onSelect(part.id, e.shiftKey)}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(part.id)
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault()
                setOver(null)
                const f = e.dataTransfer.getData('text/x-material') || (e.dataTransfer.files[0] && window.api.pathOf(e.dataTransfer.files[0]))
                if (f) onDropMaterial(part.id, f)
              }}
            />
          ))}
          {p.parts.length === 0 &&
            Array.from({ length: 10 }, (_, i) => (
              <div
                key={i}
                className={`absolute top-0 flex h-full items-end rounded-md border border-line/60 bg-[#0d0d0f] p-2 text-[13.5px] ${i === 0 && working ? 'stripes' : ''}`}
                style={{ left: `${i * 10}%`, width: 'calc(10% - 4px)' }}
              />
            ))}
        </div>
        {/* waveform + cut selection */}
        <div
          className="relative mt-2 h-14 cursor-text"
          onMouseDown={(e) => {
            const t = tAt(e.clientX)
            setCut({ a: t, b: t, dragging: true })
          }}
          onMouseMove={(e) => cut?.dragging && setCut({ ...cut, b: tAt(e.clientX) })}
          onMouseUp={() => {
            if (!cut) return
            if (Math.abs(cut.b - cut.a) < 0.15) {
              onSeek(cut.a)
              setCut(null)
            } else setCut({ ...cut, dragging: false })
          }}
        >
          <Waveform peaks={peaks} progress={time / dur} height={56} color="#6b6b72" played="#d8d8dc" className="h-14 w-full" />
          {cut && Math.abs(cut.b - cut.a) >= 0.15 && (
            <div
              className="absolute top-0 h-full border-x border-accent bg-accent/20"
              style={{ left: pct(Math.min(cut.a, cut.b)), width: pct(Math.abs(cut.b - cut.a)) }}
            >
              {!cut.dragging && (
                <div className="absolute -top-9 left-1/2 flex -translate-x-1/2 gap-1 whitespace-nowrap">
                  <button
                    className="btn-accent px-2.5 py-1 text-[13px]"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      onCut(Math.min(cut.a, cut.b), Math.max(cut.a, cut.b))
                      setCut(null)
                    }}
                  >
                    <Scissors size={13} /> Cut {fmtTime(Math.min(cut.a, cut.b))}–{fmtTime(Math.max(cut.a, cut.b))}
                  </button>
                  <button className="btn px-2.5 py-1 text-[13px]" onMouseDown={(e) => e.stopPropagation()} onClick={() => setCut(null)}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {/* playhead */}
        <div className="pointer-events-none absolute bottom-0 top-1" style={{ left: pct(time) }}>
          <div className="absolute -left-[6px] top-0 h-3 w-3 rounded-sm bg-accent" />
          <div className="absolute left-0 top-0 h-full w-[2px] -translate-x-1/2 bg-accent" />
        </div>
      </div>
    </div>
  )
}

function PartTile({
  part,
  left,
  width,
  selected,
  changed,
  showBadges,
  over,
  ...handlers
}: {
  part: Part
  left: string
  width: string
  selected: boolean
  changed: boolean
  showBadges: boolean
  over: boolean
  onClick: (e: React.MouseEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
}) {
  const busy = part.status === 'Making it again' || part.status === 'Designing' || part.status === 'Rendering'
  const badge = LABEL[part.status]
  return (
    <div
      {...handlers}
      title={`${part.title} · ${fmtTime(part.start)}–${fmtTime(part.end)}\n${part.text}`}
      className={`group absolute top-0 h-full cursor-pointer overflow-hidden rounded-md border bg-[#0d0d0f] ${
        selected ? 'border-accent ring-1 ring-accent' : over ? 'border-ok' : 'border-line/60 hover:border-[#45454c]'
      }`}
      style={{ left, width }}
    >
      {part.thumb && <img src={window.api.media.url(part.thumb) + `?v=${part.history.length}`} className="absolute inset-0 h-full w-full object-cover opacity-80" draggable={false} />}
      {busy && <div className="stripes absolute inset-0 opacity-80" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
      {showBadges && badge && (
        <span className={`absolute left-2 top-1.5 flex items-center gap-1 text-[13px] font-semibold ${busy ? 'text-accent2' : part.status === 'Failed' ? 'text-red-400' : 'text-ok'}`}>
          {busy && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
          {badge}
        </span>
      )}
      <span className="absolute right-1.5 top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-md bg-[#8e5bd6]/90" title="Style">
        <Palette size={12} className="text-white" />
      </span>
      {part.locked && <Lock size={13} className="absolute right-8 top-2 text-ink" />}
      {changed && <span className="absolute right-[34px] top-2 h-2 w-2 rounded-full bg-accent" />}
      <div className="absolute bottom-1.5 left-2 right-2 truncate text-[14px] font-semibold">
        <span className="mr-1 text-ink/70">{part.index + 1}</span>
        {part.status === 'Not designed yet' ? 'Not designed yet' : part.title}
      </div>
    </div>
  )
}
