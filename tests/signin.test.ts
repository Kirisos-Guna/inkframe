import { describe, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ app: { getPath: () => '' } }))
vi.mock('../src/main/services/store', () => ({ libDir: () => '', getSettings: () => ({}), userDir: () => '' }))

const { isSignInError, SIGN_IN_HELP } = await import('../src/main/services/agent')

describe("Claude Code's sign-in", () => {
  it('recognises an expired or missing sign-in, in the words Claude Code uses', () => {
    expect(isSignInError('Failed to authenticate: OAuth session expired and could not be refreshed')).toBe(true)
    expect(isSignInError('Not logged in · Please run /login')).toBe(true)
    expect(isSignInError('Invalid API key · Please run /login')).toBe(true)
    expect(isSignInError('Claude AI usage limit reached|1794000000')).toBe(false)
    expect(isSignInError('The model returned no JSON')).toBe(false)
  })
  it('tells the user exactly what to do', () => {
    expect(SIGN_IN_HELP).toContain('run claude')
    expect(SIGN_IN_HELP).toContain('/login')
  })
})
