// Recognising "you are out of usage" messages from the AI command-line tools.

/**
 * Claude Code has said "Claude AI usage limit reached|1761600000", "You've hit your session limit · resets 3pm" and
 * "5-hour limit reached"; Codex "You've hit your usage limit". Any of them, worded any way, means: pause.
 */
const LIMIT =
  /(usage|session|weekly|daily|monthly|5-hour|five-hour|plan|rate)[ -]?limit|limit (is )?reached|hit (your|the) [\w\s-]{0,20}limit|limit\s*[·•∙|-]\s*resets|quota exceeded|too many requests|\b429\b/i

export const isLimitText = (text: string) => LIMIT.test(text)

/** The reset time a message gives as "...|<seconds since 1970>", in ms, if it is still ahead. */
export function resetFromText(text: string, now = Date.now()) {
  const at = Number(text.match(/\|(\d{10})\b/)?.[1] ?? 0) * 1000
  return at > now ? at : undefined
}
