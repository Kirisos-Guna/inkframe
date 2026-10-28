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
  history: PartVersion[]
  checks?: { ok: boolean; notes: string[]; at: number }
  /** Which renderer draws this part. Unset = the video's default. */
  engine?: Engine
}

/** Remotion draws React/SVG (and three.js 3D) scenes; HyperFrames draws HTML + GSAP scenes. */
export type Engine = 'remotion' | 'hyperframes'
export type Transition = 'None' | 'Fade' | 'Flash' | 'Wipe' | 'Slide' | 'Zoom'
export type CaptionStyle = 'Off' | 'Clean' | 'Bold pop' | 'Karaoke'
export type SfxLevel = 'Off' | 'Subtle' | 'Lively'

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
  music?: { file: string; volume: number } | null
}

export interface Project {
  draft?: boolean
  transcribing?: boolean
  transcribeError?: string
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
