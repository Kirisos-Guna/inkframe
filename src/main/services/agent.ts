import { spawn, execFile, execFileSync } from 'child_process'
import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { app } from 'electron'
import { basename, join } from 'path'
import type { Effort, Provider } from '../../shared/types'
import { claudePath, codexPath, setClaudeSignedOut } from './tools'
import { fakeAgent, fakeEnabled } from './fakeAgent'
import { isLimitText, resetFromText } from './limits'
import { getSettings, libDir } from './store'
import { OPENROUTER_DEFAULT, OPENROUTER_URL } from '../../shared/openrouter'

export interface Usage {
  fiveHour: number // percent used
  resetsAt: number // ms
}
let usageListener: ((u: Usage) => void) | null = null
export const onUsage = (fn: (u: Usage) => void) => (usageListener = fn)
let lastUsage: Usage | null = null
const reportUsage = (u: Usage) => {
  lastUsage = u
  usageListener?.(u)
}

/**
 * The AI's usage limit is reached (Claude's 5-hour window, or Codex's plan limit). `resetsAt` (ms) is when it opens
 * again, when known. The pipeline waits for it instead of failing.
 */
export class LimitError extends Error {
  constructor(
    message: string,
    readonly resetsAt?: number
  ) {
    super(message)
  }
}

/** A usage-limit message from either CLI, as a LimitError; null for any other error. */
/** Claude Code's own words when its sign-in is missing, expired or refused. */
export const isSignInError = (text: string) =>
  /not logged in|please run \/login|\/login|failed to authenticate|oauth (session|token)|session expired|could not be refreshed|invalid api key|authentication_error|401 unauthorized/i.test(text)
export const SIGN_IN_HELP =
  "Claude Code's sign-in has expired. Open a terminal, run claude, type /login and sign in in your browser. Then try again."

export function asLimit(text: string): LimitError | null {
  if (!isLimitText(text)) return null
  // The reset time from the message itself, otherwise from the last reported 5-hour window.
  const resetsAt = resetFromText(text) ?? (lastUsage && lastUsage.resetsAt > Date.now() ? lastUsage.resetsAt : undefined)
  return new LimitError(text.split('|')[0].trim().slice(0, 200), resetsAt)
}

export interface AgentOpts {
  provider: Provider
  model: string
  effort: Effort
  cwd: string
  prompt: string
  /** Let the agent read and write files in cwd (and addDirs). */
  tools?: boolean
  /** Fixed instructions shared by many sessions (the method and style), sent as the cached system prompt. */
  system?: string
  addDirs?: string[]
  /** Codex only: allow web search (for research). */
  search?: boolean
  signal?: AbortSignal
  onStep?: (label: string) => void
}

const MODEL_IDS: Record<string, string> = {
  'Opus 5.5': 'claude-opus-5-5',
  'Sonnet 5.5': 'claude-sonnet-5-5',
  'Fable 5.1': 'claude-fable-5-1',
  'Haiku 5.5': 'claude-haiku-5-5'
}

function killTree(pid?: number) {
  if (pid) execFile('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }, () => {})
}

function cleanEnv() {
  const env = { ...process.env }
  // Do not let a parent Claude Code session leak into the child.
  for (const k of Object.keys(env)) if (k.startsWith('CLAUDECODE') || k === 'CLAUDE_CODE_ENTRYPOINT' || k.startsWith('ELECTRON_RUN')) delete env[k]
  return env
}

function friendly(tool: string, input: Record<string, unknown>) {
  const file = typeof input.file_path === 'string' ? basename(input.file_path) : typeof input.path === 'string' ? basename(input.path) : ''
  const nice = (f: string) => (f === 'METHOD.md' ? 'the method' : f === 'STYLE.md' ? 'the style' : f.replace(/\.tsx$/, ''))
  switch (tool) {
    case 'Read':
      return /\.(png|jpe?g)$/i.test(file) ? 'Looking at the picture' : `Reading ${nice(file)}`
    case 'Write':
      return `Drawing ${nice(file)}`
    case 'Edit':
    case 'MultiEdit':
      return `Changing ${nice(file)}`
    case 'Glob':
    case 'Grep':
      return 'Looking through the files'
    default:
      return tool
  }
}

/** Starts the CLI. A .cmd needs a shell, and then every argument with a space must be quoted by hand. */
function start(exe: string, args: string[], cwd: string, extraEnv: Record<string, string> = {}) {
  const shell = /\.(cmd|bat)$/i.test(exe)
  const q = (a: string) => (shell && /[\s&()^|<>"]/.test(a) ? `"${a.replace(/"/g, '""')}"` : a)
  const p = spawn(shell ? `"${exe}"` : exe, args.map(q), { cwd, env: { ...cleanEnv(), ...extraEnv }, windowsHide: true, shell })
  // Decode as one UTF-8 stream, so a character split between two chunks is not garbled.
  p.stdout.setEncoding('utf8')
  p.stderr.setEncoding('utf8')
  // Remembered until it ends, so quitting the app can end it too (Windows does not end child processes with their
  // parent: a Claude or Codex run would go on, and go on using tokens, after the app is gone).
  if (p.pid) {
    live.add(p.pid)
    p.on('close', () => live.delete(p.pid!))
  }
  return p
}

const live = new Set<number>()
/** Ends every AI run this app started (and anything they started). Called when the app quits. */
export function killAllAgents() {
  for (const pid of live) {
    try {
      execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    } catch {
      /* already ended */
    }
  }
  live.clear()
}

/** Runs one headless agent turn and returns its final text. */
export async function runAgent(o: AgentOpts): Promise<string> {
  // The stand-in's errors go through the same limit check as the real CLIs'.
  if (fakeEnabled())
    return fakeAgent(o).catch((e: Error) => {
      if (isSignInError(e.message)) {
        setClaudeSignedOut(true)
        return Promise.reject(new Error(SIGN_IN_HELP))
      }
      return Promise.reject(asLimit(e.message) ?? e)
    })
  return o.provider === 'Codex' ? runCodex(o) : runClaude(o)
}

/**
 * OpenRouter runs through the same Claude Code engine (its tools, its picture reading, its stream), pointed at
 * OpenRouter's Anthropic-compatible API with the user's key. Every model the app asks for by Claude name (Sonnet for a
 * quick fix, Haiku for a check) becomes the OpenRouter model chosen in Settings, and Claude Code's own background
 * calls go there too. Its own settings folder keeps the user's Claude sign-in out of it.
 */
function openRouterSetup(o: AgentOpts) {
  const s = getSettings()
  const key = s.openrouterKey?.trim()
  if (!key) throw new Error('OpenRouter is chosen, but no OpenRouter API key is set. Add your key in Settings (get one free at openrouter.ai/keys).')
  const quick = o.model in MODEL_IDS && /Haiku|Sonnet/.test(o.model)
  const model = (o.model in MODEL_IDS || !o.model ? (quick ? s.openrouterQuickModel : undefined) ?? s.openrouterModel : o.model) || OPENROUTER_DEFAULT
  const env: Record<string, string> = {
    ANTHROPIC_BASE_URL: OPENROUTER_URL,
    ANTHROPIC_AUTH_TOKEN: key,
    ANTHROPIC_API_KEY: '',
    ANTHROPIC_MODEL: model,
    ANTHROPIC_DEFAULT_OPUS_MODEL: model,
    ANTHROPIC_DEFAULT_SONNET_MODEL: model,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: model,
    ANTHROPIC_SMALL_FAST_MODEL: model,
    CLAUDE_CONFIG_DIR: libDir('openrouter'),
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1'
  }
  return { model, env }
}

async function runClaude(o: AgentOpts): Promise<string> {
  const exe = await claudePath()
  if (!exe) throw new Error('Claude Code is not installed on this computer. Install it, sign in once, or set its path in Settings.')
  const router = o.provider === 'OpenRouter' ? openRouterSetup(o) : null
  // Effort is a Claude setting: other models get their own default thinking.
  const args = router
    ? ['-p', '--output-format', 'stream-json', '--verbose', '--model', router.model]
    : ['-p', '--output-format', 'stream-json', '--verbose', '--model', MODEL_IDS[o.model] ?? o.model, '--effort', o.effort.toLowerCase()]
  // Lean sessions: only the tools this job needs, none of the user's MCP servers or skills, a short task-specific
  // system prompt instead of the general coding one, and nothing saved. Same work, far fewer tokens per call.
  args.push('--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence', '--system-prompt-file', systemPromptFile(o.system))
  if (o.tools) {
    args.push('--tools', 'Read,Write,Edit', '--permission-mode', 'acceptEdits', '--allowedTools', 'Read', 'Write', 'Edit')
    for (const d of o.addDirs ?? []) args.push('--add-dir', d)
  } else {
    // Research (the script writer's) may search and read the web. Web search is Anthropic's own server tool: through
    // OpenRouter the writer reads pages it knows instead.
    const web = o.search ? (router ? ['WebFetch'] : ['WebSearch', 'WebFetch']) : []
    args.push('--tools', ['Read', ...web].join(','), '--allowedTools', 'Read', ...web)
  }
  return new Promise((resolve, reject) => {
    const p = start(exe, args, o.cwd, router?.env)
    let buf = ''
    let result: string | null = null
    let error: string | null = null
    let stderr = ''
    const onAbort = () => {
      killTree(p.pid)
      reject(new Error('Stopped'))
    }
    o.signal?.addEventListener('abort', onAbort, { once: true })
    p.stdout.on('data', (d: string) => {
      buf += d
      let i: number
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim()
        buf = buf.slice(i + 1)
        if (!line) continue
        try {
          const ev = JSON.parse(line)
          if (ev.type === 'rate_limit_event') {
            // Claude reports how much of the 5-hour window is used; the editor's top bar shows it.
            const w = ev.rate_limit_info?.unifiedWindows?.five_hour
            if (w && typeof w.utilization === 'number') reportUsage({ fiveHour: w.utilization * 100, resetsAt: (w.resetsAt ?? 0) * 1000 })
          } else if (ev.type === 'assistant') {
            for (const c of ev.message?.content ?? []) if (c.type === 'tool_use') o.onStep?.(friendly(c.name, c.input ?? {}))
          } else if (ev.type === 'result') {
            if (ev.is_error || ev.subtype !== 'success') error = ev.result || ev.subtype || 'Claude Code failed'
            else result = ev.result ?? ''
          }
        } catch {
          /* not JSON: ignore */
        }
      }
    })
    p.stderr.on('data', (d) => (stderr += d.toString()))
    p.on('error', (e) => reject(e))
    p.on('close', (code) => {
      o.signal?.removeEventListener('abort', onAbort)
      if (o.signal?.aborted) return
      const limit = result === null ? asLimit(`${error ?? ''} ${stderr}`) : null
      if (result !== null) {
        setClaudeSignedOut(false)
        resolve(result)
      } else if (limit) reject(limit)
      else if (router && /\b401\b|authenticat|user not found|invalid api key/i.test(`${error ?? ''} ${stderr}`))
        reject(new Error('OpenRouter did not accept the API key. Check it in Settings (openrouter.ai/keys).'))
      else if (router && /\b404\b|no endpoints|not a valid model|model.*not (found|available)/i.test(`${error ?? ''} ${stderr}`))
        reject(new Error(`OpenRouter cannot run "${router.model}" right now (free models come and go). Choose another free model in Settings.`))
      else if (isSignInError(`${error ?? ''} ${stderr}`)) {
        setClaudeSignedOut(true)
        reject(new Error(SIGN_IN_HELP))
      }
      else reject(new Error(error ?? (stderr.trim().split('\n').slice(-3).join(' ') || `Claude Code exited with code ${code}`)))
    })
    p.stdin.end(o.prompt)
  })
}

async function runCodex(o: AgentOpts): Promise<string> {
  const exe = await codexPath()
  if (!exe) throw new Error('Codex is not installed on this computer. Install it or set its path in Settings.')
  const last = join(o.cwd, `.codex-last-${Date.now()}.txt`)
  const effort = o.effort.toLowerCase()
  // --search (live web search, for research) is a top-level flag, so it goes before 'exec'.
  const args = [...(o.search ? ['--search'] : []), 'exec', '--json', '--skip-git-repo-check', '-c', `model_reasoning_effort="${effort}"`, '--output-last-message', last]
  // 'Codex default' uses the model set in the Codex app.
  if (o.model && !/default/i.test(o.model)) args.push('-m', o.model)
  args.push('-s', o.tools ? 'workspace-write' : 'read-only', '-')
  return new Promise((resolve, reject) => {
    const p = start(exe, args, o.cwd)
    let stderr = ''
    let buf = ''
    let failure = ''
    const onAbort = () => {
      killTree(p.pid)
      reject(new Error('Stopped'))
    }
    o.signal?.addEventListener('abort', onAbort, { once: true })
    p.stdout.on('data', (d: string) => {
      buf += d
      let i: number
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i)
        buf = buf.slice(i + 1)
        try {
          const ev = JSON.parse(line)
          const item = ev.item ?? ev.msg ?? {}
          const t = item.type ?? ev.type
          if (t === 'file_change' || t === 'patch_apply_begin') o.onStep?.('Drawing the scene')
          else if (t === 'command_execution' || t === 'exec_command_begin') o.onStep?.('Checking the files')
          else if (t === 'error' || t === 'turn.failed' || t === 'stream_error') failure = String(ev.message ?? ev.error?.message ?? item.message ?? '')
        } catch {
          /* ignore */
        }
      }
    })
    p.stderr.on('data', (d) => (stderr += d.toString()))
    p.on('error', reject)
    p.on('close', (code) => {
      o.signal?.removeEventListener('abort', onAbort)
      if (o.signal?.aborted) return
      if (existsSync(last)) {
        const text = readFileSync(last, 'utf8')
        rmSync(last, { force: true })
        resolve(text)
      } else {
        const msg = failure || stderr.trim().split('\n').slice(-3).join(' ') || `Codex exited with code ${code}`
        reject(asLimit(`${msg} ${stderr}`) ?? new Error(msg))
      }
    })
    // Codex has no system prompt file: the shared instructions go first, so its own prefix cache can reuse them.
    p.stdin.end(o.system ? `${o.system}\n\n---\n\n${o.prompt}` : o.prompt)
  })
}

export { extractJson } from '../../shared/json'

/** The short system prompt for every Inkframe session. */
const SYSTEM_PROMPT = `You are the drawing and writing engine inside ${'Inkframe'}, a desktop app that turns a voiceover into an animated video.
You work only on files in the current folder, with the Read, Write and Edit tools.
Follow the method and the style exactly; they describe the scene kit, the look and the rules.
Never ask questions: make sensible choices yourself. Do not explain your work.
Write each file in one go with Write. Do not read or look for files you were not pointed to, except pictures you need to see.
When you are done, reply with one short sentence, or with exactly the JSON that was asked for.`

/**
 * The system prompt file for a session: the base prompt plus `extra` (a project's method and style). Every session of a
 * video gets the very same text at the very start, so after the first one Claude reads it from its prompt cache instead
 * of the agent spending a turn reading the files. One file per distinct text, in the app's data folder.
 */
function systemPromptFile(extra = '') {
  const text = extra ? `${SYSTEM_PROMPT}\n\n${extra}` : SYSTEM_PROMPT
  const dir = join(app.getPath('userData'), 'agent-prompts')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${createHash('sha1').update(text).digest('hex').slice(0, 16)}.txt`)
  if (!existsSync(file)) writeFileSync(file, text)
  return file
}
