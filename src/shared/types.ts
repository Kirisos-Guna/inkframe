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
  history: PartVersion[]
  checks?: { ok: boolean; notes: string[]; at: number }
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
  hair: 'Bob' | 'Short' | 'Long' | 'Bun' | 'Bald' | 'Curly'
  hairColour: string
  glasses: boolean
  outfit: 'Lab coat' | 'Hoodie' | 'Suit' | 'T-shirt' | 'Apron'
  outfitColour: string
  body: 'Slim' | 'Average' | 'Broad'
  pose: string
  expression: string
  drawnIn: string
  description?: string
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
