import { spawn, execFile, execFileSync } from 'child_process'
import { createHash } from 'crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { app } from 'electron'
import { basename, join } from 'path'
import type { Effort, Provider } from '../../shared/types'
import { claudePath, codexPath, opencodePath, setClaudeSignedOut } from './tools'
import { getSettings } from './store'
import { freeOpenCodeModels, OPENCODE_DEFAULT, OPENCODE_QUICK_DEFAULT } from '../../shared/opencode'
import { fakeAgent, fakeEnabled } from './fakeAgent'
import { isLimitText, resetFromText } from './limits'

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
  return o.provider === 'Codex' ? runCodex(o) : o.provider === 'OpenCode' ? runOpenCode(o) : runClaude(o)
}

async function runClaude(o: AgentOpts): Promise<string> {
  const exe = await claudePath()
  if (!exe) throw new Error('Claude Code is not installed on this computer. Install it, sign in once, or set its path in Settings.')
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--model', MODEL_IDS[o.model] ?? o.model, '--effort', o.effort.toLowerCase()]
  // Lean sessions: only the tools this job needs, none of the user's MCP servers or skills, a short task-specific
  // system prompt instead of the general coding one, and nothing saved. Same work, far fewer tokens per call.
  args.push('--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence', '--system-prompt-file', systemPromptFile(o.system))
  if (o.tools) {
    args.push('--tools', 'Read,Write,Edit', '--permission-mode', 'acceptEdits', '--allowedTools', 'Read', 'Write', 'Edit')
    for (const d of o.addDirs ?? []) args.push('--add-dir', d)
  } else {
    // Research (the script writer's) may search and read the web.
    const web = o.search ? ['WebSearch', 'WebFetch'] : []
    args.push('--tools', ['Read', ...web].join(','), '--allowedTools', 'Read', ...web)
  }
  return new Promise((resolve, reject) => {
    const p = start(exe, args, o.cwd)
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

/**
 * OpenCode: one `opencode run` of the console tool that ships inside the OpenCode desktop app, on one of its free
 * models (no key, the desktop's own free access). Every Claude model the app asks for (Sonnet for a quick fix, Haiku
 * for a check) becomes the OpenCode model chosen in Settings. The prompt goes in on standard input (too long for a
 * command line), its JSON events come out: tool calls become the step shown, the last text is the answer.
 */
export function openCodeModel(asked: string) {
  const s = getSettings()
  if (!(asked in MODEL_IDS) && asked.startsWith('opencode/')) return asked
  const quick = /Haiku|Sonnet/.test(asked)
  return quick ? s.opencodeQuickModel || OPENCODE_QUICK_DEFAULT : s.opencodeModel || OPENCODE_DEFAULT
}

/**
 * The free models OpenCode offers right now, read fresh from its console tool every time (OpenCode keeps its own
 * catalogue up to date, so a newly released free model shows up here at once).
 */
export async function openCodeFreeModels() {
  const exe = await opencodePath()
  if (!exe) return []
  const out = await new Promise<string>((res) => execFile(exe, ['models'], { windowsHide: true, timeout: 60000 }, (_e, o) => res(String(o ?? ''))))
  return freeOpenCodeModels(out.split(/\r?\n/))
}

async function runOpenCode(o: AgentOpts, retried = false): Promise<string> {
  const exe = await opencodePath()
  if (!exe) throw new Error('OpenCode is not on this computer. Install the OpenCode desktop app, or set the path to opencode-cli.exe in Settings.')
  let model = openCodeModel(o.model)
  if (retried) {
    // The chosen free model is gone (OpenCode's free models change): the default if it is still free, otherwise the
    // first free model offered now.
    const free = await openCodeFreeModels()
    model = free.includes(OPENCODE_DEFAULT) ? OPENCODE_DEFAULT : free[0] ?? model
  }
  // --auto: its file tools work without asking (it only works in this job's folder); --archived: no session clutter.
  const args = ['run', '--archived', '--auto', '--format', 'json', '-m', model]
  return new Promise((resolve, reject) => {
    // OpenCode takes its folder from PWD, not from the folder it is started in: without it, files land in the app's folder.
    const p = start(exe, args, o.cwd, { PWD: o.cwd })
    let buf = ''
    let stderr = ''
    let answer = ''
    let failure = ''
    const onAbort = () => {
      killTree(p.pid)
      reject(new Error('Stopped'))
    }
    o.signal?.addEventListener('abort', onAbort, { once: true })
    // What OpenCode did, kept for when a run goes wrong (the last run in this folder, in work/opencode.log).
    const log = existsSync(join(o.cwd, 'work')) ? join(o.cwd, 'work', 'opencode.log') : null
    if (log) writeFileSync(log, `${model}\n${o.prompt.slice(0, 4000)}\n----\n`)
    p.stdout.on('data', (d: string) => {
      buf += d
      if (log) appendFileSync(log, d)
      let i: number
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim()
        buf = buf.slice(i + 1)
        if (!line) continue
        try {
          const ev = JSON.parse(line)
          const part = ev.part ?? {}
          if (ev.type === 'tool_use' && part.tool) {
            const input = part.state?.input ?? {}
            const name = String(part.tool)
            o.onStep?.(friendly(name.charAt(0).toUpperCase() + name.slice(1), { file_path: input.filePath ?? input.path ?? input.file_path }))
          } else if (ev.type === 'text' && typeof part.text === 'string' && part.text.trim()) answer = part.text
          else if (ev.type === 'error') failure = String(ev.error?.message ?? ev.error?.type ?? 'OpenCode failed')
        } catch {
          /* not JSON: ignore */
        }
      }
    })
    p.stderr.on('data', (d) => (stderr += d.toString()))
    p.on('error', reject)
    p.on('close', (code) => {
      o.signal?.removeEventListener('abort', onAbort)
      if (o.signal?.aborted) return
      if (answer && !failure) return resolve(answer)
      const msg = failure || stderr.trim().split('\n').slice(-3).join(' ') || `OpenCode exited with code ${code}`
      if (/model unavailable|no-route/i.test(msg)) {
        if (!retried) return runOpenCode(o, true).then(resolve, reject)
        return reject(new Error(`OpenCode cannot run "${model}" right now (free models come and go). Choose another free model in Settings.`))
      }
      reject(asLimit(msg) ?? new Error(msg))
    })
    // No system prompt flag: the shared instructions go first.
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
