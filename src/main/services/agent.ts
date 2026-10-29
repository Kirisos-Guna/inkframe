import { spawn, execFile, execFileSync } from 'child_process'
import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { app } from 'electron'
import { basename, join } from 'path'
import type { Effort, Provider } from '../../shared/types'
import { claudePath, codexPath } from './tools'
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
function start(exe: string, args: string[], cwd: string) {
  const shell = /\.(cmd|bat)$/i.test(exe)
  const q = (a: string) => (shell && /[\s&()^|<>"]/.test(a) ? `"${a.replace(/"/g, '""')}"` : a)
  const p = spawn(shell ? `"${exe}"` : exe, args.map(q), { cwd, env: cleanEnv(), windowsHide: true, shell })
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
  if (fakeEnabled()) return fakeAgent(o).catch((e: Error) => Promise.reject(asLimit(e.message) ?? e))
  return o.provider === 'Codex' ? runCodex(o) : runClaude(o)
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
    args.push('--tools', 'Read', '--allowedTools', 'Read')
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
      if (result !== null) resolve(result)
      else if (limit) reject(limit)
      else if (/not logged in|\/login/i.test(error ?? '')) reject(new Error('Claude Code is not signed in. Open a terminal, run claude, and sign in once. Then press Try again.'))
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
