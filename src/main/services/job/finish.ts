// Putting the video together: the parts, the voiceover, transitions, captions, sound effects and music.
import { existsSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { createRequire } from 'module'
import type { Comment, Part, Project } from '../../../shared/types'
import { getStyle } from '../store'
import { finishVideo } from '../media'
import { captionAss, captionFilters, linesFromWords, needsShaping, prepareCaptionFonts, prepareShapingFont } from '../captions'
import { buildSfxTrack } from '../sfx'

const req = createRequire(__filename)

export const finishDetail = (p: Project) =>
  [
    'Joining the parts and laying the voiceover on top',
    p.settings.transition && p.settings.transition !== 'None' ? `${p.settings.transition.toLowerCase()} between parts` : '',
    p.settings.captions && p.settings.captions !== 'Off' ? `${p.settings.captions.toLowerCase()} captions` : '',
    p.settings.music ? 'music under the voice' : '',
    p.settings.sfx && p.settings.sfx !== 'Off' ? `${p.settings.sfx.toLowerCase()} sound effects` : ''
  ]
    .filter(Boolean)
    .join(', ') + '.'

/** The finishing pass: transitions, captions and music over the rendered parts. */
export async function finish(p: Project, out: string, size: { height: number; fps: number }, signal?: AbortSignal, clips = p.parts.map((x) => x.video!)) {
  const workDir = join(p.dir, 'work')
  let captions: string[] | undefined
  let assFile: string | undefined
  if (p.settings.captions && p.settings.captions !== 'Off' && p.words.length) {
    const lines = p.captionLines?.length ? p.captionLines : linesFromWords(p.words)
    const H = size.height
    const look = { W: Math.round((H * 16) / 9 / 2) * 2, H, accent: getStyle(p.settings.styleId).palette.accent }
    if (needsShaping(lines)) {
      prepareShapingFont(workDir)
      assFile = 'captions.ass'
      writeFileSync(join(workDir, assFile), captionAss(lines, p.settings.captions, look))
    } else {
      prepareCaptionFonts(workDir, (w) => join(dirname(req.resolve('@fontsource/inter/package.json')), 'files', `inter-latin-${w}-normal.woff`))
      captions = captionFilters(lines, p.settings.captions, { ...look, workDir })
    }
  }
  // Sound effects, found from the scenes and made here (no AI): one track for the whole video.
  let sfx: { file: string; volume: number } | null = null
  if (p.settings.sfx && p.settings.sfx !== 'Off') {
    const track = await buildSfxTrack(p, p.settings.sfx, join(workDir, 'sfx.wav'))
    if (track) sfx = { file: track.file, volume: p.settings.sfxVolume ?? 0.6 }
  }
  return finishVideo({
    sfx,
    clips: p.parts.map((x, i) => ({ file: clips[i], dur: x.end - x.start })),
    voice: p.voiceover!.file,
    out,
    workDir,
    height: size.height,
    fps: size.fps,
    transition: p.settings.transition,
    captions,
    assFile,
    music: p.settings.music && existsSync(p.settings.music.file) ? p.settings.music : null,
    signal
  })
}
