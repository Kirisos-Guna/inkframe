// Hearing the voiceover (whisper.cpp), started as soon as it is dropped.
import { join } from 'path'
import { getProject } from '../store'
import { transcribe } from '../transcribe'
import { emit } from './events'

// ---------- transcription (starts as soon as the voiceover is dropped) ----------
export const hearing = new Map<string, Promise<void>>()
export function startTranscription(id: string) {
  const p = getProject(id)
  if (!p?.voiceover) return
  // A new voiceover dropped while the old one is still being heard waits for it: both write the same work files.
  const prev = hearing.get(id)
  const run = (async () => {
    await prev?.catch(() => {})
    p.transcribing = true
    p.transcribeError = undefined
    emit(p, true)
    try {
      p.words = await transcribe(p.voiceover!.file, join(p.dir, 'work'), (s) => {
        if (p.job.running) {
          p.job.detail = s
          emit(p)
        }
      })
    } catch (e) {
      p.words = []
      p.transcribeError = (e as Error).message
    } finally {
      p.transcribing = false
      emit(p, true)
    }
  })()
  hearing.set(id, run)
  run.finally(() => hearing.get(id) === run && hearing.delete(id))
}
