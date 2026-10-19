import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronDown, ChevronRight, Lightbulb, Plus, Shuffle, Trash2 } from 'lucide-react'
import { Users } from 'lucide-react'
import type { CharacterDef } from '@shared/types'
import { CharacterArt, DRAWN_IN, EXPRESSIONS, POSES, newCharacter } from '@shared/CharacterArt'
import { useApp } from '@/store/app'
import { Chips } from '@/components/ui'

const SKINS = ['#f6dcc8', '#f0c9a6', '#e3ac85', '#d9a07a', '#b97c55', '#9a5d3a', '#7a4628', '#4f2d1a']
const EYE_COLOURS = ['#2a2a30', '#5a3a22', '#3d6fe0', '#1f9e86', '#a8692e', '#6b7380', '#3a2418']
const HAIR_COLOURS = ['#151515', '#3b2a20', '#7a4a26', '#c98f4a', '#e3c78a', '#b3423a', '#9aa0a8', '#f2f2f2']
const OUTFIT_COLOURS = ['#4f6fd8', '#2f9e6b', '#d0473b', '#f2a33a', '#7d56d6', '#2b2b30', '#e6e6e6']
const NAMES = ['Ada', 'Max', 'Noor', 'Leo', 'Mia', 'Kai', 'Zoe', 'Ravi', 'Lena', 'Omar']

export default function Characters({ openId }: { openId?: string }) {
  const { characters, go } = useApp()
  const editing = characters.find((c) => c.id === openId)
  if (editing) return <CharacterEditor key={editing.id} initial={editing} />
  return (
    <div className="px-12 pb-6 pt-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[34px] font-bold tracking-tight">Characters</h1>
          <p className="mt-1 text-[17px] text-muted">Make a cast once and use them in any video. They follow each video's style by themselves.</p>
        </div>
        <div className="mt-2 flex shrink-0 gap-2">
        <button
          className="btn px-4 py-3 text-[15px]"
          title="Adds the ready-made cast members you do not have yet"
          onClick={async () => {
            const n = await window.api.characters.addCast()
            useApp.setState({ characters: await window.api.characters.list() })
            useApp.getState().showToast(n ? `Added ${n} characters` : 'You already have the whole starter cast')
          }}
        >
          <Users size={16} /> Add the starter cast
        </button>
        <button
          className="btn-accent px-5 py-3 text-[16px]"
          onClick={async () => {
            const c = await window.api.characters.save(newCharacter(crypto.randomUUID(), NAMES[characters.length % NAMES.length]))
            useApp.setState({ characters: await window.api.characters.list() })
            go({ name: 'characters', id: c.id })
          }}
        >
          <Plus size={17} /> New character
        </button>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
        {characters.map((c) => (
          <button key={c.id} onClick={() => go({ name: 'characters', id: c.id })} className="card overflow-hidden text-left hover:border-[#3a3a40]">
            <div className="flex h-56 items-center justify-center bg-[#0d0d0f] p-4">
              <CharacterArt c={c} />
            </div>
            <div className="px-4 py-3">
              <div className="text-[17px] font-semibold">{c.name}</div>
              <div className="text-[14px] text-muted">
                {c.description ? c.description : `${c.outfit} · drawn in ${c.drawnIn}`}
              </div>
            </div>
          </button>
        ))}
        {!characters.length && (
          <div className="col-span-full rounded-2xl border border-dashed border-line px-8 py-12 text-center text-muted">
            No characters yet. Make one, then pick it in step 4 of a new video.
          </div>
        )}
      </div>
    </div>
  )
}

function CharacterEditor({ initial }: { initial: CharacterDef }) {
  const { go, settings, showToast } = useApp()
  const [c, setC] = useState(initial)
  const [saved, setSaved] = useState(true)
  const [view, setView] = useState<'One pose' | 'All poses' | 'Faces' | 'In every style'>('One pose')
  const [desc, setDesc] = useState(initial.description ?? '')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState({ body: false, face: true })
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setSaved(false)
    const t = setTimeout(async () => {
      await window.api.characters.save(c)
      useApp.setState({ characters: await window.api.characters.list() })
      setSaved(true)
    }, 500)
    return () => clearTimeout(t)
  }, [c])

  const set = (patch: Partial<CharacterDef>) => setC((x) => ({ ...x, ...patch }))
  const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]

  const surprise = () =>
    set({
      skin: pick(SKINS),
      head: pick(['Round', 'Oval', 'Square', 'Long', 'Wide'] as const),
      eyes: pick(['Dots', 'Round', 'Big', 'Sleepy', 'Lashes'] as const),
      eyeColour: pick(EYE_COLOURS),
      eyebrows: pick(['None', 'Soft', 'Thick', 'Arched'] as const),
      nose: pick(['None', 'Dot', 'Button', 'Long'] as const),
      hair: pick(['Bob', 'Short', 'Long', 'Bun', 'Bald', 'Curly', 'Ponytail', 'Afro', 'Spiky', 'Side part'] as const),
      facialHair: pick(['None', 'None', 'Stubble', 'Beard', 'Mustache'] as const),
      hat: pick(['None', 'None', 'None', 'Cap', 'Beanie', 'Hard hat'] as const),
      headphones: Math.random() > 0.8,
      hairColour: pick(HAIR_COLOURS),
      glasses: Math.random() > 0.6,
      outfit: pick(['Lab coat', 'Hoodie', 'Suit', 'T-shirt', 'Apron', 'Jacket', 'Dress', 'Overalls', 'Sweater'] as const),
      outfitColour: pick(OUTFIT_COLOURS),
      body: pick(['Slim', 'Average', 'Broad'] as const)
    })

  return (
    <div className="px-6 pb-6 pt-12 2xl:px-10">
      <div className="flex items-center gap-4">
        <button onClick={() => go({ name: 'characters' })} className="p-1 text-muted hover:text-ink">
          <ArrowLeft size={20} />
        </button>
        <input value={c.name} onChange={(e) => set({ name: e.target.value })} className="w-72 bg-transparent text-[32px] font-bold tracking-tight outline-none" />
        <div className="flex-1" />
        <button
          className="p-2 text-muted hover:text-red-400"
          onClick={async () => {
            if (!confirm(`Delete ${c.name}?`)) return
            await window.api.characters.remove(c.id)
            useApp.setState({ characters: await window.api.characters.list() })
            go({ name: 'characters' })
          }}
        >
          <Trash2 size={17} />
        </button>
        <button className="flex items-center gap-2 px-3 text-[16px]" onClick={surprise}>
          <Shuffle size={16} /> Surprise me
        </button>
        <span className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-[16px] font-semibold ${saved ? 'bg-accent text-white' : 'bg-card2 text-muted'}`}>
          <Check size={16} /> {saved ? 'Saved' : 'Saving…'}
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-6 xl:flex-row 2xl:gap-7">
        <div className="card min-w-0 flex-1 overflow-hidden">
          <div className="flex h-[490px] items-center justify-center bg-gradient-to-b from-[#121214] to-[#0b0b0c] p-6">
            {view === 'One pose' && <div className="h-full">{<CharacterArt c={c} />}</div>}
            {view === 'All poses' && (
              <div className="grid h-full w-full grid-cols-5 gap-2 overflow-y-auto">
                {POSES.map((p) => (
                  <button key={p} onClick={() => { set({ pose: p }); setView('One pose') }} className="flex flex-col items-center rounded-lg hover:bg-white/5">
                    <div className="h-36"><CharacterArt c={{ ...c, pose: p }} /></div>
                    <span className="text-[12px] text-muted">{p}</span>
                  </button>
                ))}
              </div>
            )}
            {view === 'Faces' && (
              <div className="grid w-full grid-cols-5 gap-3">
                {EXPRESSIONS.map((e) => (
                  <button key={e} onClick={() => { set({ expression: e }); setView('One pose') }} className="flex flex-col items-center rounded-lg py-1 hover:bg-white/5">
                    <div className="h-28 w-28 overflow-hidden">
                      <div className="w-[260%] -translate-x-[31%] -translate-y-[10%]"><CharacterArt c={{ ...c, expression: e, pose: 'Stand' }} /></div>
                    </div>
                    <span className="text-[12px] text-muted">{e}</span>
                  </button>
                ))}
              </div>
            )}
            {view === 'In every style' && (
              <div className="grid h-full w-full grid-cols-6 gap-2 overflow-y-auto">
                {DRAWN_IN.map((d) => (
                  <button key={d} onClick={() => { set({ drawnIn: d }); setView('One pose') }} className={`flex flex-col items-center rounded-lg ${STYLE_BG[d] ?? ''}`}>
                    <div className="h-36"><CharacterArt c={{ ...c, drawnIn: d }} /></div>
                    <span className="pb-1 text-[12px] text-muted">{d}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-center border-t border-line/70 py-3">
            <div className="inline-flex rounded-lg border border-line p-1">
              {(['One pose', 'All poses', 'Faces', 'In every style'] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={`rounded-md px-4 py-1.5 text-[16px] ${view === v ? 'bg-card2 font-semibold' : 'text-ink/85'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-5 border-t border-line/70 px-6 py-5">
            <Field label="Pose">
              <Chips options={POSES} value={c.pose as (typeof POSES)[number]} onToggle={(pose) => set({ pose })} />
            </Field>
            <Field label="Expression">
              <Chips options={EXPRESSIONS} value={c.expression as (typeof EXPRESSIONS)[number]} onToggle={(expression) => set({ expression })} />
            </Field>
            <Field label="Drawn in" hint="it follows each video's style by itself">
              <Chips options={DRAWN_IN} value={c.drawnIn as (typeof DRAWN_IN)[number]} onToggle={(drawnIn) => set({ drawnIn })} />
            </Field>
          </div>
        </div>

        <div className="w-full shrink-0 space-y-5 xl:w-[480px] 2xl:w-[660px]">
          <div className="card px-6 py-5">
            <div className="text-[15px]">
              <b>Describe it</b> <span className="text-muted">· The app designs it for you, then you fine-tune it</span>
            </div>
            <textarea
              className="input mt-3 h-[105px] resize-none text-[16px] leading-relaxed"
              placeholder="e.g. A cheerful barista in her thirties with curly red hair, a green apron, round glasses and a big smile"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
            <div className="mt-3 flex items-center gap-4">
              <button
                className="btn"
                disabled={busy || !desc.trim()}
                onClick={async () => {
                  setBusy(true)
                  try {
                    const next = await window.api.characters.describe(c, desc)
                    setC({ ...next, description: desc })
                  } catch (e) {
                    showToast((e as Error).message.replace(/^Error invoking remote method '[^']+': /, ''))
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                {busy ? <span className="spinner" /> : <Lightbulb size={15} />} {busy ? 'Designing…' : 'Change it to match'}
              </button>
              <span className="text-[14px] leading-snug text-muted">
                Made by {settings?.defaultProvider} · {settings?.defaultModel} · {settings?.defaultEffort} · about a minute
              </span>
            </div>
          </div>

          <div className="card overflow-hidden">
            <button className="flex w-full items-center justify-between px-6 py-4 text-[17px] font-semibold" onClick={() => setOpen({ ...open, body: !open.body })}>
              Type and body {open.body ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
            </button>
            {open.body && (
              <div className="space-y-4 border-t border-line/70 px-6 py-5">
                <Field label="Body"><Opts v={c.body} o={['Slim', 'Average', 'Broad']} on={(body) => set({ body })} /></Field>
                <Field label="Age"><Opts v={c.age ?? 'Adult'} o={['Kid', 'Adult', 'Older']} on={(age) => set({ age })} /></Field>
                <Field label="Outfit"><Opts v={c.outfit} o={['Lab coat', 'Hoodie', 'Suit', 'T-shirt', 'Apron', 'Jacket', 'Dress', 'Overalls', 'Sweater']} on={(outfit) => set({ outfit })} /></Field>
                <Field label="Outfit colour"><Swatches v={c.outfitColour} o={OUTFIT_COLOURS} on={(outfitColour) => set({ outfitColour })} /></Field>
                <Field label="Hair"><Opts v={c.hair} o={['Bob', 'Short', 'Long', 'Bun', 'Ponytail', 'Curly', 'Afro', 'Spiky', 'Side part', 'Bald']} on={(hair) => set({ hair })} /></Field>
                <Field label="Hair colour"><Swatches v={c.hairColour} o={HAIR_COLOURS} on={(hairColour) => set({ hairColour })} /></Field>
                <Field label="Glasses"><Opts v={c.glasses ? 'Yes' : 'No'} o={['No', 'Yes']} on={(g) => set({ glasses: g === 'Yes' })} /></Field>
                <Field label="Hat"><Opts v={c.hat ?? 'None'} o={['None', 'Cap', 'Beanie', 'Hard hat']} on={(hat) => set({ hat })} /></Field>
                <Field label="Headphones"><Opts v={c.headphones ? 'Yes' : 'No'} o={['No', 'Yes']} on={(h) => set({ headphones: h === 'Yes' })} /></Field>
              </div>
            )}
            <button className="flex w-full items-center justify-between border-t border-line/70 px-6 py-4 text-[17px] font-semibold" onClick={() => setOpen({ ...open, face: !open.face })}>
              Face {open.face ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
            </button>
            {open.face && (
              <div className="space-y-4 px-6 pb-6">
                <Field label="Skin"><Swatches v={c.skin} o={SKINS} on={(skin) => set({ skin })} custom /></Field>
                <Field label="Head"><Opts v={c.head} o={['Round', 'Oval', 'Square', 'Long', 'Wide']} on={(head) => set({ head })} /></Field>
                <Field label="Eyes"><Opts v={c.eyes} o={['Dots', 'Round', 'Big', 'Sleepy', 'Lashes']} on={(eyes) => set({ eyes })} /></Field>
                <Field label="Eye colour"><Swatches v={c.eyeColour} o={EYE_COLOURS} on={(eyeColour) => set({ eyeColour })} /></Field>
                <Field label="Eyebrows"><Opts v={c.eyebrows} o={['None', 'Soft', 'Thick', 'Arched']} on={(eyebrows) => set({ eyebrows })} /></Field>
                <Field label="Nose"><Opts v={c.nose} o={['None', 'Dot', 'Button', 'Long']} on={(nose) => set({ nose })} /></Field>
                <Field label="Facial hair"><Opts v={c.facialHair ?? 'None'} o={['None', 'Stubble', 'Beard', 'Mustache']} on={(facialHair) => set({ facialHair })} /></Field>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const STYLE_BG: Record<string, string> = {
  Flat: 'bg-[#e9e6df]',
  Paper: 'bg-[#f2b632]',
  Watercolour: 'bg-[#f6f2ea]',
  Ink: 'bg-[#f3f0e8]',
  Pixel: 'bg-[#cfe8cf]',
  Riso: 'bg-[#f1ece2]',
  Chalk: 'bg-[#1f2a26]',
  Blueprint: 'bg-[#1747b8]',
  'Soft 3D': 'bg-[#e9e4f5]',
  'Cartoon History': 'bg-[#24324a]'
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 text-[15.5px] font-semibold text-ink/90">
        {label} {hint && <span className="text-[14px] font-normal text-muted">· {hint}</span>}
      </div>
      {children}
    </div>
  )
}

function Opts<T extends string>({ v, o, on }: { v: T; o: T[]; on: (v: T) => void }) {
  return (
    <div className="inline-flex flex-wrap rounded-lg border border-line bg-[#0f0f11] p-1">
      {o.map((x) => (
        <button key={x} onClick={() => on(x)} className={`rounded-md px-4 py-1.5 text-[16px] ${v === x ? 'bg-card2 font-semibold' : 'text-ink/85'}`}>
          {x}
        </button>
      ))}
    </div>
  )
}

function Swatches({ v, o, on, custom }: { v: string; o: string[]; on: (v: string) => void; custom?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      {[...new Set([...o, v])].map((x) => (
        <button
          key={x}
          onClick={() => on(x)}
          className={`h-9 w-9 rounded-lg ${v === x ? 'ring-2 ring-accent ring-offset-2 ring-offset-card' : ''}`}
          style={{ background: x }}
        />
      ))}
      {custom && (
        <label className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-line bg-card2">
          <Plus size={16} />
          <input type="color" className="hidden" value={v} onChange={(e) => on(e.target.value)} />
        </label>
      )}
    </div>
  )
}
