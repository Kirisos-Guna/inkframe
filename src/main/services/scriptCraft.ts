// How Inkframe writes voiceover scripts, for both "From a topic" and "Recreate a YouTube video": one craft guide,
// one way of working, and a free local check of every script (with one targeted revision when it falls short).
// No Electron here, so it can be tested.

/** What makes a faceless explainer script hold people, as rules the writer follows. */
export const SCRIPT_CRAFT = `How a script that holds people is built (follow all of it):

THE OPENING (first 15 seconds decide everything)
- Sentence 1 drops the viewer into the most surprising true thing about the topic: a concrete moment, a number that
  sounds wrong, or a question they have never thought to ask. Never a greeting, never "in this video", never a
  definition, never background.
- By sentence 3 the viewer knows what is at stake for THEM (time, money, safety, curiosity they cannot drop).
- Then a promise: what they will understand by the end, without giving the answer away.

THE MIDDLE (beats)
- One idea per beat, in the order a curious person would ask about them. A beat is 20 to 40 seconds.
- Every beat ends on a turn that pulls into the next one: an open question, a "but", a problem the last idea created.
  Never end a beat on a summary.
- Every 30 to 60 seconds, a reveal: something the viewer did not expect, which reframes what came before.
- Specific beats vague, always: a real number, a named thing, a real example, a place, a year. Never "many", "various",
  "a lot of things", "in many ways".
- Each hard idea gets one everyday comparison (a kitchen, a road, a queue, a post office), set up in one sentence and
  used, not explained twice.
- Write for the ear and the eye: every sentence names something that can be drawn on screen as it is said.

THE VOICE
- Talk to one person: "you", contractions, plain words. A smart friend explaining at a table, not a narrator.
- Rhythm: mostly short sentences, some medium ones, an occasional three-word punch. No sentence over 25 words.
- Confident and exact. No hedging piles ("it's important to note", "essentially", "basically").
- At most one rhetorical question per beat. No lists read aloud: turn them into a sequence that happens.

THE ENDING
- The payoff answers the opening question in one clear line, and calls back to the opening image.
- Then one sentence the viewer will remember and repeat. Then stop: no recap of everything, no "and that's how".

NEVER USE (tired, AI-sounding)
"in this video", "in today's video", "let's dive in", "dive into", "delve", "buckle up", "without further ado",
"in today's world", "in today's fast-paced", "have you ever wondered", "imagine a world", "game-changer",
"game changer", "revolutionize", "unlock the", "unleash", "the power of", "a testament to", "it's important to note",
"it's worth noting", "at the end of the day", "in conclusion", "let's explore", "embark", "journey of",
"tapestry", "realm", "landscape of", "navigate the", "seamless", "cutting-edge", "plays a crucial role",
"smash that like button", "don't forget to subscribe".

FORMAT
Plain spoken text only: no headings, no stage directions, no brackets, no emojis, no bullet points. Blank lines between
beats. Numbers written the way they are read aloud ("about four hundred", "nineteen seventy-eight").`

/** How the writer works before it answers. Only the final result is returned. */
export const SCRIPT_PROCESS = `Work in this order, privately, and only output the final result:
1. Find the angle: the single most surprising TRUE thing about this, and the question it makes the viewer ask.
2. Write five different openings (a moment, a number, a question, a contradiction, a "you"). Pick the strongest;
   keep the three best for "hooks".
3. Outline the beats: for each, the one idea, the concrete picture, and the turn that ends it. Place the reveals.
4. Write the script.
5. Edit it as a viewer who is ready to scroll away: cut every sentence that adds no new fact or tension, replace every
   vague word with a specific one, break long sentences, check every phrase on the NEVER USE list, check the length.`

/** The words of the NEVER USE list, as patterns to look for. */
const BANNED = [
  'in this video',
  "in today's video",
  "let's dive in",
  'dive into',
  'delve',
  'buckle up',
  'without further ado',
  "in today's world",
  "in today's fast-paced",
  'have you ever wondered',
  'imagine a world',
  'game-changer',
  'game changer',
  'revolutionize',
  'unlock the',
  'unleash',
  'the power of',
  'a testament to',
  "it's important to note",
  "it's worth noting",
  'at the end of the day',
  'in conclusion',
  "let's explore",
  'embark',
  'journey of',
  'tapestry',
  'realm',
  'landscape of',
  'navigate the',
  'seamless',
  'cutting-edge',
  'plays a crucial role',
  'smash that like',
  "don't forget to subscribe"
]

const words = (s: string) => s.split(/\s+/).filter(Boolean)
const sentences = (s: string) => s.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).filter((x) => x.trim())

/**
 * Checks a script against the rules a program can check: the banned phrases, the length, long sentences, an opening
 * that starts with a greeting or a definition, and formatting. Returns what to fix (empty: it passes).
 */
export function lintScript(script: string, targetWords: number) {
  const issues: string[] = []
  const lower = script.toLowerCase().replace(/[’‘]/g, "'")
  const found = BANNED.filter((b) => lower.includes(b))
  if (found.length) issues.push(`Remove these tired phrases and say it plainly instead: ${found.map((f) => `"${f}"`).join(', ')}.`)
  const n = words(script).length
  if (targetWords && Math.abs(n - targetWords) / targetWords > 0.15)
    issues.push(`It is ${n} words; it must be about ${targetWords} (within 10%). ${n > targetWords ? 'Cut the weakest sentences, not the facts.' : 'Add a concrete example or a reveal where a beat is thin, not filler.'}`)
  const long = sentences(script).filter((s) => words(s).length > 28)
  if (long.length) issues.push(`Split these long sentences: ${long.slice(0, 4).map((s) => `"${s.slice(0, 80)}…"`).join(' ')}`)
  const first = sentences(script)[0] ?? ''
  if (/^(hi|hello|hey|welcome|today|so,? today|in this|what is|.{0,40}\b(is|are) (a|an|the) (term|type|kind|process|method)\b)/i.test(first.trim()))
    issues.push(`The first sentence is a greeting or a definition: "${first.slice(0, 90)}". Open on the most surprising concrete thing instead.`)
  if (/^\s*(#|\*|-|\d+\.)\s|\[[^\]]+\]|\([^)]*(music|pause|sfx|cut to)[^)]*\)/im.test(script)) issues.push('Remove headings, bullet points and stage directions: plain spoken text only.')
  return issues
}

/** The JSON both writers return. `hooks` are other strong openings the creator can swap in. */
export const SCRIPT_JSON = `"title": "a curiosity-driven title, at most 60 characters, that makes the opening question irresistible (no clickbait lies)",
 "hooks": ["two other strong openings, each 1–2 sentences, different kinds from the one you used"],
 "script": "the full voiceover script, blank lines between beats"`

/** The one revision, when the local check finds something. It names exactly what to change. */
export function revisePrompt(script: string, issues: string[], targetWords: number) {
  return `This voiceover script needs a revision. Fix exactly these problems and nothing else; keep everything that works
(the angle, the beats, the facts, the voice). Stay at about ${targetWords} words.

${issues.map((i) => `- ${i}`).join('\n')}

The rules it must follow:
${SCRIPT_CRAFT}

The script:
"""
${script}
"""

Reply with JSON only: {"script": "the revised script"}`
}
