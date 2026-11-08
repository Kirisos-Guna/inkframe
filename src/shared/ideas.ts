import type { TrendIdea } from './types'

/** What the script writer gets from a picked idea: the topic, and the angle with the facts and sources to use. */
export function ideaBrief(i: TrendIdea) {
  return {
    topic: i.title,
    angle: [
      i.angle,
      i.concept && `The concept underneath: ${i.concept}`,
      i.hook && `Opening idea: ${i.hook}`,
      i.facts.length > 0 && `Facts to use (checked): ${i.facts.join('; ')}`,
      i.evidence.length > 0 && `Where it is trending: ${i.evidence.map((e) => `${e.source}${e.metric ? ` (${e.metric})` : ''} ${e.url}`).join('; ')}`
    ]
      .filter(Boolean)
      .join('\n')
  }
}
