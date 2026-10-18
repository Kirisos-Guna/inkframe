/** Pulls the first JSON object or array out of an agent's reply. */
export function extractJson<T>(text: string): T {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fence ? fence[1] : text
  const start = body.search(/[[{]/)
  if (start < 0) throw new Error('The reply had no JSON in it')
  const open = body[start]
  const close = open === '[' ? ']' : '}'
  let depth = 0
  let inStr = false
  for (let i = start; i < body.length; i++) {
    const ch = body[i]
    if (inStr) {
      if (ch === '\\') i++
      else if (ch === '"') inStr = false
    } else if (ch === '"') inStr = true
    else if (ch === open) depth++
    else if (ch === close && --depth === 0) return JSON.parse(body.slice(start, i + 1)) as T
  }
  throw new Error('The JSON in the reply was cut off')
}
