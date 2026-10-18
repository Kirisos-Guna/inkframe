import { ArrowRight } from 'lucide-react'
import type { Project } from '@shared/types'
import { fmtTime } from '@/store/app'

// The whole video as a map: every part as a card with its idea, in order.
export function MapView({ p, selected, onSelect }: { p: Project; selected: string[]; onSelect: (id: string, shift: boolean) => void }) {
  if (!p.parts.length) return <div className="flex h-full items-center justify-center text-muted">The map appears once the voiceover is split into parts.</div>
  return (
    <div className="h-full overflow-auto px-8 py-6">
      <div className="flex flex-wrap items-stretch gap-y-6">
        {p.parts.map((x, i) => (
          <div key={x.id} className="flex items-center">
            <button
              onClick={(e) => onSelect(x.id, e.shiftKey)}
              className={`w-[250px] overflow-hidden rounded-xl border bg-[#121214] text-left ${selected.includes(x.id) ? 'border-accent' : 'border-line hover:border-[#45454c]'}`}
            >
              <div className="aspect-video bg-black">{x.thumb && <img src={window.api.media.url(x.thumb) + `?v=${x.history.length}`} className="h-full w-full object-cover" />}</div>
              <div className="px-3.5 py-3">
                <div className="text-[13px] text-muted">
                  Part {i + 1} · {fmtTime(x.start)}–{fmtTime(x.end)}
                </div>
                <div className="text-[15.5px] font-semibold">{x.title}</div>
                <div className="mt-1 line-clamp-2 text-[13px] text-ink/70">“{x.text}”</div>
                {x.idea && <div className="mt-1.5 line-clamp-3 text-[13px] italic text-muted">{x.idea}</div>}
              </div>
            </button>
            {i < p.parts.length - 1 && <ArrowRight size={18} className="mx-2 text-dim" />}
          </div>
        ))}
      </div>
    </div>
  )
}
