import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { APP_NAME, APP_NAME_SPLIT } from '@shared/brand'
import { useApp } from '@/store/app'
import iconUrl from '../../../../build/icon.svg'

export function Logo({ size = 34 }: { size?: number }) {
  return <img src={iconUrl} width={size} height={size} alt={APP_NAME} draggable={false} />
}

export function Wordmark() {
  return (
    <span className="text-[17px] font-semibold tracking-tight">
      {APP_NAME.slice(0, APP_NAME_SPLIT)}
      <span className="text-accent">{APP_NAME.slice(APP_NAME_SPLIT)}</span>
    </span>
  )
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  className = ''
}: {
  value: T
  options: T[]
  onChange: (v: T) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center justify-between rounded-lg border bg-[#0f0f11] px-3.5 py-2 text-[14px] ${
          open ? 'border-accent' : 'border-line hover:border-[#3a3a40]'
        }`}
      >
        <span className="truncate">{value}</span>
        <ChevronDown size={16} className="text-ink/80" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1.5 overflow-hidden rounded-lg border border-line bg-[#141416] py-1 shadow-2xl">
          {options.map((o) => (
            <button
              key={o}
              onClick={() => {
                onChange(o)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] hover:bg-white/5"
            >
              <span className="w-4">{o === value && <Check size={14} className="text-accent" />}</span>
              <span className={o === value ? 'font-semibold' : ''}>{o}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Chips<T extends string>({
  options,
  value,
  onToggle,
  size = 'md'
}: {
  options: readonly T[]
  value: T | T[]
  onToggle: (v: T) => void
  size?: 'sm' | 'md'
}) {
  const on = (o: T) => (Array.isArray(value) ? value.includes(o) : value === o)
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onToggle(o)}
          className={`chip ${size === 'sm' ? 'px-2.5 py-1 text-[12.5px]' : ''} ${on(o) ? 'chip-on' : ''}`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-[#0f0f11] p-1">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`rounded-md px-4 py-1.5 text-[14px] ${
            value === o ? 'bg-card2 font-semibold text-ink' : 'text-ink/75 hover:text-ink'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

export function StepBadge({ n, done }: { n: number; done: boolean }) {
  return done ? (
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ok/90">
      <Check size={17} strokeWidth={3} className="text-white" />
    </div>
  ) : (
    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-[13px] text-ink/80">
      {n}
    </div>
  )
}

export function Toast() {
  const toast = useApp((s) => s.toast)
  if (!toast) return null
  return (
    <div className="toast fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-line bg-[#1a1a1d] px-5 py-3 text-[15px] font-medium shadow-2xl">
      <Check size={16} className="text-ok" />
      {toast.text}
    </div>
  )
}

export function Waveform({
  peaks,
  progress = 0,
  height = 40,
  color = '#d4d4d8',
  played = '#ffffff',
  className = ''
}: {
  peaks: number[]
  progress?: number
  height?: number
  color?: string
  played?: string
  className?: string
}) {
  const bars = peaks.length ? peaks : Array.from({ length: 120 }, (_, i) => 0.25 + 0.5 * Math.abs(Math.sin(i * 0.7)))
  return (
    <svg className={className} viewBox={`0 0 ${bars.length * 3} ${height}`} preserveAspectRatio="none" height={height}>
      {bars.map((p, i) => {
        const h = Math.max(2, p * height)
        return (
          <rect
            key={i}
            x={i * 3}
            y={(height - h) / 2}
            width={1.6}
            height={h}
            rx={0.8}
            fill={i / bars.length <= progress ? played : color}
          />
        )
      })}
    </svg>
  )
}

export function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-[7px] text-[14.5px]">
      <span className="text-muted">{k}</span>
      <span className="font-semibold text-ink">{v}</span>
    </div>
  )
}

