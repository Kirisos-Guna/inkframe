import { spawn, execFile } from 'child_process'
import { existsSync, readFileSync, rmSync } from 'fs'
import { basename, join } from 'path'
import type { Effort, Provider } from '../../shared/types'
import { claudePath, codexPath } from './tools'
import { fakeAgent, fakeEnabled } from './fakeAgent'

export interface Usage {
  fiveHour: number // percent used
  resetsAt: number // ms
}
let usageListener: ((u: Usage) => void) | null = null
export const onUsage = (fn: (u: Usage) => void) => (usageListener = fn)
const reportUsage = (u: Usage) => usageListener?.(u)

export interface AgentOpts {
  provider: Provider
  model: string
  effort: Effort
  cwd: string
  prompt: string
  /** Let the agent read and write files in cwd (and addDirs). */
  tools?: boolean
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

/** Runs one headless agent turn and returns its final text. */
export async function runAgent(o: AgentOpts): Promise<string> {
  if (fakeEnabled()) return fakeAgent(o)
  return o.provider === 'Codex' ? runCodex(o) : runClaude(o)
}

async function runClaude(o: AgentOpts): Promise<string> {
  const exe = await claudePath()
  if (!exe) throw new Error('Claude Code is not installed on this computer. Install it, sign in once, or set its path in Settings.')
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--model', MODEL_IDS[o.model] ?? o.model, '--effort', o.effort.toLowerCase()]
  if (o.tools) {
    args.push('--permission-mode', 'acceptEdits', '--allowedTools', 'Read', 'Write', 'Edit', 'Glob', 'Grep')
    for (const d of o.addDirs ?? []) args.push('--add-dir', d)
  } else {
    args.push('--allowedTools', 'Read')
  }
  return new Promise((resolve, reject) => {
    const shell = /\.(cmd|bat)$/i.test(exe)
    const p = spawn(shell ? `"${exe}"` : exe, args, { cwd: o.cwd, env: cleanEnv(), windowsHide: true, shell })
    let buf = ''
    let result: string | null = null
    let error: string | null = null
    let stderr = ''
    const onAbort = () => {
      killTree(p.pid)
      reject(new Error('Stopped'))
    }
    o.signal?.addEventListener('abort', onAbort, { once: true })
    p.stdout.on('data', (d: Buffer) => {
      buf += d.toString()
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
      if (result !== null) resolve(result)
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
    const shell = /\.(cmd|bat)$/i.test(exe)
    const p = spawn(shell ? `"${exe}"` : exe, args, { cwd: o.cwd, env: cleanEnv(), windowsHide: true, shell })
    let stderr = ''
    let buf = ''
    const onAbort = () => {
      killTree(p.pid)
      reject(new Error('Stopped'))
    }
    o.signal?.addEventListener('abort', onAbort, { once: true })
    p.stdout.on('data', (d: Buffer) => {
      buf += d.toString()
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
      } else reject(new Error(stderr.trim().split('\n').slice(-3).join(' ') || `Codex exited with code ${code}`))
    })
    p.stdin.end(o.prompt)
  })
}

export { extractJson } from '../../shared/json'
