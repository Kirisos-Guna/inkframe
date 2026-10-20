import type { CharacterDef, Comment, Part, Project, StyleDef } from '../../shared/types'
import { APP_NAME } from '../../shared/brand'

const t = (s: number) => s.toFixed(2)

function wordsLine(p: Project, from = 0, to = Infinity, fps?: number, offset = 0) {
  return p.words
    .filter((w) => w.start >= from - 0.05 && w.start < to)
    .map((w) => (fps ? `${Math.round((w.start - offset) * fps)}:${w.w}` : `[${t(w.start)}] ${w.w}`))
    .join(' ')
}

function brief(p: Project, style: StyleDef) {
  const s = p.settings
  return `Kind of video: ${s.kind}
Tone: ${s.tone.join(', ') || 'neutral'}
Creativity: ${s.creativity} (${
    { Faithful: 'show what is said, plainly', Balanced: 'mostly literal, a little extra', Storytelling: 'visual metaphors and a through-line from part to part', Wild: 'bold, surprising visual ideas' }[s.creativity]
  })
Style: ${style.name}: ${style.description}`
}

export function splitPrompt(p: Project, style: StyleDef) {
  const dur = p.voiceover?.duration ?? 60
  // About one part per 9 seconds: a 12-minute voiceover gets ~80 parts.
  const target = Math.max(1, Math.round(dur / 9))
  return `You are the director of an explainer video made with ${APP_NAME}. Plan it by splitting the voiceover into parts.

${brief(p, style)}

Direction from the user:
"""
${p.direction || '(none, use your judgement)'}
"""
${p.script ? `\nThe script the voiceover reads (use its exact spelling for names and numbers):\n"""\n${p.script}\n"""\n` : ''}
Voiceover length: ${t(dur)} seconds.
${p.words.length ? `Words and the second each one starts:\n${wordsLine(p)}` : 'The words could not be heard, so split by time and base the ideas on the direction and script.'}

Rules:
- About ${target} parts (between ${Math.max(1, target - 3)} and ${target + 3}), each 5 to 14 seconds.
- Parts are back to back: the first starts at 0, each starts where the last ended, the last ends at ${t(dur)}.
- Cut only at the start time of a word that begins a sentence or clause.
- Each part gets: a short title (2 to 4 words, like "Into the air"), the words it covers, and an idea: one or two sentences that say what we see and how it builds, beat by beat, in sync with the words.
- Ideas follow the user's direction. Together they tell one story from the first part to the last.

Reply with JSON only:
{"title": "video title, at most 6 words", "parts": [{"start": 0, "end": 9.8, "title": "...", "text": "...", "idea": "..."}]}`
}

export function styleDoc(style: StyleDef, guide: string) {
  return `# The style: ${style.name}

${style.description}

- Background: ${style.palette.bg}
- Ink (lines and text): ${style.palette.ink}
- Accent (the one thing to look at): ${style.palette.accent}
${style.palette.paper ? `- Paper lines: ${style.palette.paper}\n` : ''}- Stroke: ${style.stroke.width}px, texture "${style.stroke.texture}", wobble ${style.stroke.jitter}
- Tags: ${style.tags.join(', ')}

The <Board> already paints the background and texture for this style.
${style.guide ? `\n## How this style looks\n\n${style.guide}\n` : ''}${
    style.render === 'three'
      ? '\n## This style is real 3D\n\nBuild Remotion parts with `@kit/three` (see "Real 3D" in METHOD.md): a <Stage3D> scene with real lighting and camera moves, not flat SVG.\n'
      : ''
  }${guide ? `\n## Notes learned from the reference video\n\n${guide}\n` : ''}`
}

/** Where a part's scene lives and how it is made. */
export interface SceneTarget {
  file: string // relative to the project folder
  engine: 'remotion' | 'hyperframes'
}
const methodOf = (t: SceneTarget) => (t.engine === 'hyperframes' ? 'HYPERFRAMES.md (how to draw an HTML part)' : 'METHOD.md (how to draw a part with the kit)')

/** What one part says and when, and its idea. */
function partSection(p: Project, part: Part, target: SceneTarget) {
  const fps = p.settings.quality.fps
  const frames = Math.round((part.end - part.start) * fps)
  return `Part ${part.index + 1} of ${p.parts.length}: "${part.title}" (${t(part.start)}s to ${t(part.end)}s of the voiceover, ${frames} frames at ${fps} fps).

What the voiceover says in this part:
"${part.text || '(not heard; follow the idea)'}"

${
    target.engine === 'hyperframes'
      ? `Words and the second each one starts at, counted from the start of this part (use these times on the GSAP timeline):
${wordsLine(p, part.start, part.end, undefined, part.start) || '(none)'}`
      : `Words and the frame each one starts at, counted from the start of this part (use at('word') in code):
${wordsLine(p, part.start, part.end, fps, part.start) || '(none)'}`
  }

The idea for this part: ${part.idea || 'your choice, following the direction'}${
    part.material.length ? `\nThe user dragged these onto this part, so show them: ${part.material.map((m) => m.split(/[\\/]/).pop()).join(', ')}` : ''
  }`
}

/** What every part of the video shares: the outline, the direction, characters and material. */
function videoContext(p: Project, chars: CharacterDef[]) {
  return `The whole video, for context:
${p.parts.map((x) => `${x.index + 1}. ${x.title}: ${x.text.slice(0, 90)}`).join('\n')}

Direction from the user: ${p.direction || '(none)'}${
    p.settings.captions && p.settings.captions !== 'Off'
      ? '\nCaptions are shown along the bottom of the video: keep everything important above y = 860 (the bottom 220 px of the 1080 frame stays clear of text and key objects).'
      : ''
  }
Characters in this video: ${chars.length ? chars.map((c) => `${c.name} (${c.outfit.toLowerCase()}, ${c.hair.toLowerCase()} hair${c.glasses ? ', glasses' : ''})`).join('; ') : 'none, do not use <Character>'}
Material files you can show with <Picture name="...">: ${[...new Set(p.material.map((m) => m.split(/[\\/]/).pop()))].join(', ') || 'none'}`
}

function partContext(p: Project, part: Part, chars: CharacterDef[], target: SceneTarget = { file: '', engine: 'remotion' }) {
  return `You are drawing ${partSection(p, part, target)}

${videoContext(p, chars)}`
}

/**
 * Several parts in one session: the method, the style and the video's context are read once instead of once per
 * part, and Claude sees the neighbouring parts, which also helps the video flow.
 */
export function designBatchPrompt(p: Project, parts: Part[], chars: CharacterDef[], targets: SceneTarget[]) {
  const usesReact = targets.some((x) => x.engine === 'remotion')
  const usesHtml = targets.some((x) => x.engine === 'hyperframes')
  const methods = [usesReact ? 'METHOD.md (React scenes, .tsx)' : '', usesHtml ? 'HYPERFRAMES.md (HTML scenes)' : ''].filter(Boolean).join(' and ')
  return `First read ${methods} and STYLE.md (the look of this video). Read each once.

You are drawing ${parts.length} parts of one video, in order. Make them feel like one continuous piece: the same scale and line
weight, recurring visual motifs, and where it helps, start a part from what the previous part left on screen.

${videoContext(p, chars)}

${parts
  .map(
    (x, i) => `---------------------------------------------------------------
${partSection(p, x, targets[i])}
Write this part ${targets[i].engine === 'hyperframes' ? `by filling in the starter at ${targets[i].file}` : `to ${targets[i].file}`}.`
  )
  .join('\n\n')}

Write every scene to its own file, one after the other. Do not create or change any other file.
When all ${parts.length} are written, reply with one short sentence.`
}

/**
 * Checks for several parts at once. Each picture is a strip of three moments (early, middle, end) of one part, so one
 * small image per part instead of three.
 */
export function checkBatchPrompt(items: { part: Part; sheet: string }[], level: string) {
  return `You are checking parts of an explainer video before it ships. Each picture is one part: three moments side by side
(early, middle, end). Read each picture.

${items.map(({ part, sheet }) => `Part ${part.index + 1} "${part.title}": ${sheet}. The voiceover says: "${part.text.slice(0, 220)}"`).join('\n')}

For each part, check: text cut off or running off the frame, drawings that leave the frame, overlapping text, text too
small to read on a phone, an empty or unbalanced frame, and whether the end frame clearly shows what the words say.
${level === 'Low' ? 'Only flag problems that are obvious at first glance.' : level === 'High' ? 'Be strict.' : ''}

Reply with JSON only: {"parts": [{"part": <number>, "ok": true or false, "notes": ["short note", ...]}]}  (notes empty when ok)`
}

export function designPrompt(p: Project, part: Part, chars: CharacterDef[], target: SceneTarget) {
  return `First read ${methodOf(target)} and STYLE.md (the look of this video).

${partContext(p, part, chars, target)}

${target.engine === 'hyperframes' ? `Fill in the starter at ${target.file}` : `Write the scene to ${target.file}`}. Do not create or change any other file.
When you are done, reply with one short sentence that says what the part shows.`
}

export function fixPrompt(p: Project, part: Part, chars: CharacterDef[], c: Comment, attachments: string[], target: SceneTarget) {
  const others = p.parts.length - 1
  return `First read ${target.engine === 'hyperframes' ? 'HYPERFRAMES.md' : 'METHOD.md'} and STYLE.md, then the current scene, ${target.file}.

${partContext(p, part, chars, target)}

The user watched this part and left a note:
"${c.text}"
${attachments.length ? `They attached: ${attachments.join(', ')} (in the public folder; Read pictures to see them, show them with <Picture name="...">).\n` : ''}
${
    c.mode === 'Fix just this'
      ? 'Fix just this: change only what the note asks for. Keep everything else in the scene exactly as it is.'
      : 'Rethink the scene: come up with a new idea for this part that answers the note, and write the scene again from scratch.'
  }
The other ${others} part${others === 1 ? '' : 's'} stay exactly as they are: change only ${target.file}.
When you are done, reply with one short sentence that says what you changed.`
}

export function repairPrompt(part: Part, error: string, target: SceneTarget) {
  return `The scene ${target.file} does not work. This is the error:

${error.slice(0, 3000)}

Read ${target.engine === 'hyperframes' ? 'HYPERFRAMES.md' : 'METHOD.md'} if you need the rules, then fix ${target.file} so it builds and renders. Keep the drawing the same.
Reply with one short sentence.`
}

export function checkPrompt(part: Part, frames: string[], level: string) {
  return `You are checking part ${part.index + 1}, "${part.title}", of an explainer video before it ships.
The voiceover says: "${part.text}"
Look at these frames from early, middle and end of the part: ${frames.join(', ')} (Read each picture).

Check for: text cut off or running off the frame, overlapping text, things outside the frame, text too small to read on a phone, an empty or unbalanced frame, and whether the end frame clearly shows what the words say.
${level === 'Low' ? 'Only flag problems that are obvious at first glance.' : level === 'High' ? 'Be strict.' : ''}

Reply with JSON only: {"ok": true or false, "notes": ["short note", ...]}  (notes empty when ok)`
}

export function characterPrompt(current: CharacterDef, text: string) {
  return `Design a cartoon character for an explainer video from this description:
"${text}"

Pick values only from these lists:
skin: any hex colour
head: Round | Oval | Square | Long | Wide
eyes: Dots | Round | Big | Sleepy | Lashes
eyeColour, hairColour, outfitColour: any hex colour
eyebrows: None | Soft | Thick | Arched
nose: None | Dot | Button | Long
hair: Bob | Short | Long | Bun | Bald | Curly | Ponytail | Afro | Spiky | Side part
glasses: true | false
outfit: Lab coat | Hoodie | Suit | T-shirt | Apron | Jacket | Dress | Overalls | Sweater
facialHair: None | Stubble | Beard | Mustache
hat: None | Cap | Beanie | Hard hat
headphones: true | false
age: Kid | Adult | Older
body: Slim | Average | Broad
pose: Stand | Wave | Point | Point up | Thumbs up | Cheer | Shrug | Think | Arms crossed | Present | Hold | Hands on hips | Facepalm | Explain | Walk
expression: Neutral | Happy | Laughing | Surprised | Sad | Angry | Thinking | Wink | Worried | Smug
name: a short first name that fits (keep "${current.name}" unless the description names someone)

The current character, for anything the description does not say: ${JSON.stringify({ ...current, id: undefined, description: undefined, drawnIn: undefined })}

Reply with JSON only, with all the fields above.`
}

export function learnPrompt(frames: string[], stats: { duration: number; cutsPerMinute: number }, mode: string, name: string) {
  return `You are learning a visual style from a reference video so ${APP_NAME} can make new videos that look like it.
Learn the look only (lines, colour, texture, composition, typography, camera${mode === 'Look + pacing' ? ', and pacing' : ''}).
Never copy its characters, logos, footage or text.

Frames from the video: ${frames.join(', ')} (Read each picture).
Video length: ${stats.duration.toFixed(0)} s. Hard cuts per minute: ${stats.cutsPerMinute.toFixed(1)}.

1. Write STYLE_GUIDE.md: a practical guide (under 400 words) for someone drawing scenes in this look with SVG:
   background, line weight and quality, colour use, how text looks and where it sits, how things appear (drawn on,
   popping, fading), camera moves${mode === 'Look + pacing' ? ', how long a picture is held and how often it changes' : ''}, and what to avoid.
2. Reply with JSON only:
{"name": "${name || 'a short evocative name, 2 words'}", "tags": ["two", "tags"], "description": "one sentence, like 'A pen draws your story on a dark board, in sync with every word.'",
 "dim": "2D" or "3D",
 "palette": {"bg": "#hex", "ink": "#hex", "accent": "#hex"},
 "stroke": {"width": 1-8, "jitter": 0-1.5, "texture": "pen" | "chalk" | "pencil" | "marker" | "brush" | "none"}}`
}
