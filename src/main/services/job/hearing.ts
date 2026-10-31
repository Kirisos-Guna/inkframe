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
      // The file name often holds the topic: a hint that helps with names and technical words.
      const hint = [p.voiceover!.name.replace(/\.[^.]+$/, '').replace(/_/g, ' '), p.direction].filter(Boolean).join('. ')
      const heard = await transcribe(
        p.voiceover!.file,
        join(p.dir, 'work'),
        (s) => {
          p.transcribeStatus = s
          if (p.job.running) p.job.detail = s
          emit(p)
        },
        hint
      )
      p.words = heard.words
      p.language = heard.language
      // A Tamil voiceover gets Tamil on screen and in the title and description, until the user says otherwise.
      if (heard.language === 'ta' && !p.settings.outputLang) p.settings.outputLang = 'Tamil'
    } catch (e) {
      p.words = []
      p.transcribeError = (e as Error).message
    } finally {
      p.transcribing = false
      p.transcribeStatus = undefined
      emit(p, true)
    }
  })()
  hearing.set(id, run)
  run.finally(() => hearing.get(id) === run && hearing.delete(id))
}
