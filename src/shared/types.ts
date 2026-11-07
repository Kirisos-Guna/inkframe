export type VideoKind = 'Explainer' | 'Story' | 'Case study' | 'Tutorial' | 'Sales pitch'
export type Provider = 'Claude Code' | 'Codex'
export type Effort = 'Low' | 'Medium' | 'High'
export type ChecksLevel = 'Off' | 'Low' | 'Medium' | 'High'

export interface Word {
  w: string
  start: number
  end: number
}

export type PartStatus =
  | 'Not designed yet'
  | 'Designing'
  | 'Designed'
  | 'Rendering'
  | 'Rendered'
  | 'Making it again'
  | 'Up to date'
  | 'Failed'

export interface PartVersion {
  at: number
  note: string
  file: string
}

export interface Part {
  id: string
  index: number
  title: string
  start: number
  end: number
  text: string
  idea?: string
  status: PartStatus
  locked: boolean
  styleId?: string
  material: string[]
  thumb?: string
  video?: string
  /** When the clip was last rendered (so the page loads the new one). */
  renderedAt?: number
  /** The version of the drawing kit it was rendered with: a part rendered with an older kit is rendered again. */
  kit?: number
  history: PartVersion[]
  /** The last check of this part. It is valid while newer than renderedAt. afterFix: already fixed once for its notes. */
  checks?: { ok: boolean; notes: string[]; at: number; afterFix?: boolean }
  /** Which renderer draws this part. Unset = the video's default. */
  engine?: Engine
}

/** Remotion draws React/SVG (and three.js 3D) scenes; HyperFrames draws HTML + GSAP scenes. */
export type Engine = 'remotion' | 'hyperframes'
export type Transition = 'None' | 'Fade' | 'Flash' | 'Wipe' | 'Slide' | 'Zoom'
export type CaptionStyle = 'Off' | 'Clean' | 'Bold pop' | 'Karaoke'
export type SfxLevel = 'Off' | 'Subtle' | 'Lively'
export type OutputLang = 'English' | 'Tamil'

/** One planned piece of real media for a part (from the research step). */
export interface Shot {
  kind: 'page' | 'tweet' | 'photo' | 'meme' | 'stock' | 'clip' | 'code' | 'doccode' | 'chart' | 'quote'
  /** quote: who says it, the words, and what to search for */
  who?: string
  says?: string
  /** chart: where the numbers come from, and what */
  source?: 'price' | 'npm' | 'github'
  symbol?: string
  package?: string
  repo?: string
  range?: string
  label?: string
  /** page, tweet, doccode */
  url?: string
  /** page: the exact sentence on the page to highlight, a second one (yellow), and a tall capture to scroll down */
  mark?: string
  mark2?: string
  scroll?: boolean
  /** doccode: text inside the docs example to take */
  contains?: string
  /** photo, stock: what to search for */
  query?: string
  /** meme: the Imgflip template name, and the captions */
  template?: string
  top?: string
  bottom?: string
  /** clip: the user's link and the seconds wanted */
  link?: string
  from?: string
  to?: string
  /** code */
  lang?: string
  file?: string
  code?: string
  /** photo: cut the subject out (people, products, logos) for a sticker */
  cutout?: boolean
  /** what it shows, for the designer */
  why?: string
}

/** A fetched piece of real media, in the project's public folder (name is relative to it). */
export interface MediaItem {
  kind: 'page' | 'tweet' | 'photo' | 'meme' | 'clip' | 'code' | 'chart'
  name: string
  w?: number
  h?: number
  /** page: where the highlighted sentence's lines are, in the picture's pixels: [x, y, w, h] */
  marks?: [number, number, number, number][]
  /** page: the second sentence's lines, and a tight crop (headline + paragraph) */
  marks2?: [number, number, number, number][]
  focus?: [number, number, number, number]
  /** photo: the cut-out version (transparent PNG), when asked for */
  cut?: string
  /** licence credit, added to the description */
  credit?: string
  top?: string
  bottom?: string
  lang?: string
  file?: string
  code?: string
  note?: string
}

export interface Thumbnail {
  id: string
  file: string
  scene: string
  note: string
  at: number
}

export interface PublishKit {
  titles: string[]
  description: string
  tags: string[]
  hashtags: string[]
  at: number
}

export interface Comment {
  id: string
  partIds: string[]
  text: string
  mode: 'Fix just this' | 'Rethink the scene'
  attachments: string[]
  at: number
  state: 'Waiting' | 'Working' | 'Done' | 'Failed'
}

export interface Step {
  id: string
  label: string
  done: boolean
  at: number
}

export type Stage = 'Voiceover' | 'Parts' | 'Design' | 'Render' | 'Video'

export interface JobState {
  running: boolean
  title: string
  detail: string
  stage: Stage
  designDone: number
  renderDone: number
  steps: Step[]
  startedAt: number
  error?: string
  /** Paused by the user: the current step was stopped and will be done again on Resume. */
  paused?: boolean
  /** Time spent paused, when the current pause began, and when the job ended (for the elapsed clock). */
  pausedMs?: number
  pausedAt?: number
  endedAt?: number
}

export interface ProjectSettings {
  kind: VideoKind
  tone: string[]
  creativity: 'Faithful' | 'Balanced' | 'Storytelling' | 'Wild'
  styleId: string
  characterIds: string[]
  quality: { height: 720 | 1080 | 2160; fps: 30 | 60 }
  checks: ChecksLevel
  provider: Provider
  model: string
  effort: Effort
  helpers: boolean
  /** Default engine for parts. 'Auto' follows the style. */
  engine?: 'Auto' | 'Remotion' | 'HyperFrames'
  transition?: Transition
  captions?: CaptionStyle
  /** Sound effects timed to what happens on screen, and their volume (0..1). */
  sfx?: SfxLevel
  sfxVolume?: number
  /** The language of on-screen text, title, description and thumbnail. Unset: English. */
  outputLang?: OutputLang
  music?: { file: string; volume: number } | null
}

export interface Project {
  draft?: boolean
  /** The heard words were put on the pauses in the audio (and given the script's spelling): see wordTimes.ts. */
  wordsTuned?: boolean
  transcribing?: boolean
  transcribeError?: string
  /** What hearing is doing right now, with its progress. */
  transcribeStatus?: string
  /** The language heard in the voiceover (whisper's code: en, ta...). */
  language?: string
  id: string
  title: string
  dir: string
  createdAt: number
  updatedAt: number
  voiceover?: { file: string; name: string; duration: number }
  script?: string
  direction: string
  material: string[]
  words: Word[]
  parts: Part[]
  comments: Comment[]
  settings: ProjectSettings
  job: JobState
  output?: string
  /** The check of the finished video file (black frames, freezes, sound, length): empty notes when all is well. */
  finalCheck?: { at: number; notes: string[] }
  /** Real media per part id (remix styles). */
  media?: Record<string, MediaItem[]>
  /** When the final video was last written (so the page loads the new one). */
  outputAt?: number
  thumbnails?: Thumbnail[]
  publish?: PublishKit
  /** Caption lines (cleaned up by the writer), in seconds. */
  captionLines?: { start: number; end: number; text: string; words: { w: string; start: number; end: number }[] }[]
}

export interface StyleDef {
  id: string
  name: string
  tags: string[]
  description: string
  dim: '2D' | '3D'
  palette: { bg: string; ink: string; accent: string; paper?: string }
  stroke: { width: number; jitter: number; texture: 'pen' | 'chalk' | 'pencil' | 'marker' | 'brush' | 'none' }
  custom?: boolean
  source?: string
  /** 'three' styles are real 3D scenes built with three.js. */
  render?: 'svg' | 'three'
  /** Lettering: 'marker' writes labels and titles with a bold marker font (Permanent Marker). */
  font?: 'marker'
  /** The engine this style looks best in. */
  engine?: Engine
  /** Extra direction for the designer, written into STYLE.md. */
  guide?: string
  /** Built from real media (screenshots, photos, memes, clips, code) found by research, not drawn. */
  realMedia?: boolean
}

export interface CharacterDef {
  id: string
  name: string
  skin: string
  head: 'Round' | 'Oval' | 'Square' | 'Long' | 'Wide'
  eyes: 'Dots' | 'Round' | 'Big' | 'Sleepy' | 'Lashes'
  eyeColour: string
  eyebrows: 'None' | 'Soft' | 'Thick' | 'Arched'
  nose: 'None' | 'Dot' | 'Button' | 'Long'
  hair: 'Bob' | 'Short' | 'Long' | 'Bun' | 'Bald' | 'Curly' | 'Ponytail' | 'Afro' | 'Spiky' | 'Side part'
  hairColour: string
  glasses: boolean
  outfit: 'Lab coat' | 'Hoodie' | 'Suit' | 'T-shirt' | 'Apron' | 'Jacket' | 'Dress' | 'Overalls' | 'Sweater'
  outfitColour: string
  body: 'Slim' | 'Average' | 'Broad'
  pose: string
  expression: string
  drawnIn: string
  description?: string
  // Added in 1.3: optional, so characters saved earlier still load.
  facialHair?: 'None' | 'Stubble' | 'Beard' | 'Mustache'
  hat?: 'None' | 'Cap' | 'Beanie' | 'Hard hat'
  headphones?: boolean
  age?: 'Kid' | 'Adult' | 'Older'
}

export interface LearnSession {
  id: string
  name: string
  source: string
  mode: 'The look' | 'Look + pacing'
  testLine?: string
  /** Videos to learn from (several links at once), instead of `source`. */
  urls?: string[]
  /** Save the style without drawing a test clip (no tokens for it). */
  skipTest?: boolean
  provider?: Provider
  model?: string
  effort?: Effort
  step: number // 0..4
  status: 'Downloading' | 'Measuring' | 'Building' | 'Ready to check' | 'Failed'
  detail: string
  styleId?: string
  testClip?: string
  frames: string[]
  at: number
  error?: string
}

export interface AppSettings {
  saveDir: string
  claudePath: string
  codexPath: string
  whisperPath: string
  whisperModel: string
  ytDlpPath: string
  defaultProvider: Provider
  defaultModel: string
  defaultEffort: Effort
  defaultChecks: ChecksLevel
  /** Who writes scripts, titles, descriptions and captions. */
  writerProvider?: Provider
  writerModel?: string
  /** How this channel's scripts sound (persona, audience, words to use or avoid, an example line). Used for every script. */
  scriptVoice?: string
  /** Free API keys for stock clips (remix styles). */
  pexelsKey?: string
  pixabayKey?: string
  /** The local voice last used to make a voiceover (see localVoice.ts). */
  voice?: VoiceChoice
  /** Fast Tech Remix may use short clips of real people saying a line (from YouTube). Off: other channels can claim them. */
  quoteClips?: boolean
}

export interface Status {
  claude: boolean
  /** Claude Code has a sign-in on this computer (or an API key in the environment). */
  claudeSignedIn: boolean
  codex: boolean
  ffmpeg: boolean
  whisper: boolean
  ytDlp: boolean
  usage?: number
}

/** A voice of the local voice model. */
export interface LocalVoice {
  id: string
  name: string
  about: string
}

/** Which local voice speaks, how fast (1 is normal) and at what pitch (semitones, 0 is the voice's own). */
export interface VoiceChoice {
  id: string
  speed: number
  pitch: number
}
