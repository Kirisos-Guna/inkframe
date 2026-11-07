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

THE THREAD (what makes people listen to the end; the most important rule)
- The whole script is ONE story with ONE question, set up in the opening and answered at the end. Every beat is a
  step toward that answer, and the viewer can always feel which step they are on. A beat that does not move the
  question forward is cut, however good the fact is.
- Beats are joined by BUT or SO (THEREFORE), never by "and then" or "also". The first sentence of every beat picks up
  the exact thing the last beat left open (its question, its problem, its person) in words the viewer just heard.
  Never open a beat on a new subject cold ("Now meet…", "Here's the secret…", "Look at…") without saying why it
  comes next.
- Keep the opening's person or situation alive: come back to it at least once in the middle and at the end, so the
  facts happen TO someone the viewer cares about.
- One comparison carries one idea; do not stack two analogies on the same point. A study or a number proves the line
  before it; never two studies in a row.
- Every example must be one a listener can follow by ear the first time: no code read aloud, no example that needs
  the picture to make sense.
- Never talk down to the viewer ("Fine, you don't care", "you probably didn't know"): tease the situation, not them.

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
- At most one rhetorical question per beat. Never read a bare list aloud: each item must cause the next.

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

/** Spoken words a minute in the house voice (the default local voice reads at 1.1x, about 200). */
export const WPM = 195

/**
 * The house voice of every script: a developer explaining things to a friend, quick and dry, each point handing off to
 * the next. Learned from how developer explainer channels like CodeHead build their videos, written in our own words.
 * It wins over the general rules above on tone, pace and structure.
 */
export const HOUSE_VOICE = `THE HOUSE VOICE (every script sounds like this; it wins over the rules above on tone, pace and structure)
- A developer talking to a developer friend: casual, quick, a little cynical, honest. About 200 words a minute, so
  sentences are short and the ideas keep coming.
- Open on a "you" moment the viewer has lived (the meeting where everyone nodded at a word nobody understood, the
  code review that turned into a war, the legend of the colleague who never sleeps) or on a myth you are about to
  take apart. Two or three sentences, then say plainly what the video will do ("So let's go through the ten that
  matter, and explain each one properly.").
- A list or countdown is welcome, but it is a CHAIN, not a list: the end of every item causes the next one. The last
  line of an item names the problem, the question or the person that the next item is about ("But how do four cores
  run five hundred programs at once? That's where the scheduler comes in." / "And since nobody wrote anything down,
  the new hire asks the chatbot, and that's how the AI maximalist is born."). Never "Number seven is…" cold.
- Every idea gets one tiny worked example with real numbers, walked step by step so the ear can follow it ("The
  account has a hundred. Two requests each take eighty. Both read a hundred, both pass the check, both write twenty.
  The bank just paid out one sixty.").
- A dry twist at the end of most items: the fact said straight, then one short aside that turns it ("…which is a great
  question to ask after you have ten users." / "They fixed it alone, but only because they broke it alone.").
- First-person honesty now and then ("I used to be this guy", "people much smarter than me named this"): the narrator
  is in on the joke, never above the viewer.
- Near the end, one twist that turns the whole video back on the viewer or reframes every item ("Here's the twist:
  every one of these people is a version of us."), then the practical takeaway, then stop.
- Plain words. Jargon is fine once it is explained in one sentence the first time it is said.
- No sponsor reads, no "subscribe", no channel plugs.`

export const SCRIPT_PROCESS = `Work in this order, privately, and only output the final result:
1. Find the angle: the single most surprising TRUE thing about this, and the question it makes the viewer ask.
2. Write five different openings (a moment, a number, a question, a contradiction, a "you"). Pick the strongest;
   keep the three best for "hooks".
3. Outline the beats: for each, the one idea, the concrete picture, and the turn that ends it. Place the reveals.
4. Write the spine: one line per beat, joined by "BUT" or "SO" ("You ship fast, BUT you can't explain your code, SO
   …"). Wherever the only honest join is "AND THEN", reorder, merge or cut that beat until the spine reads as one story.
5. Write the script from the spine.
6. Edit it as a viewer who is ready to scroll away: read only the first and last sentence of each beat and check they
   hand over to each other; cut every sentence that adds no new fact or tension, replace every vague word with a
   specific one, break long sentences, check every phrase on the NEVER USE list, check the length.`

/**
 * The second pass every script gets: an editor reads it as a viewer and rewrites the places where attention would
 * drop (a cold jump between beats, a lost thread, a joke that talks down, an example the ear cannot follow), plus
 * whatever the local check found. Returns the prompt.
 */
export function retentionPrompt(script: string, issues: string[], targetWords: number) {
  return `You are the script editor of a channel whose videos people watch to the end. Read this voiceover as a viewer
who will scroll away the moment they lose the thread, then rewrite it.

Find and fix, in this order:
1. Jumps: every place a beat starts on a new subject without the viewer knowing why it comes next. Add the bridge
   (a BUT or SO sentence that picks up what the last beat left open), or move or cut the beat.
2. The thread: the opening's question and its person or situation must come back in the middle and pay off at the
   end. If they vanish, bring them back.
3. Drops: any sentence that adds no new fact, tension or joke; any example a listener cannot follow by ear the first
   time; two analogies or two studies for the same point (keep the better one).
4. Tone: lines that talk down to the viewer; jokes that are explained; hedging.
5. The house voice: a chain where each item causes the next, a worked example with numbers for each idea, a dry
   twist at the end of most items, one big twist near the end.
${issues.length ? `\nAlso fix these, found by a check:\n${issues.map((i) => `- ${i}`).join('\n')}\n` : ''}
Keep the facts, the numbers, the names and everything that already works. Stay at about ${targetWords} words.

The rules it must follow:
${SCRIPT_CRAFT}

${HOUSE_VOICE}

The script:
"""
${script}
"""

Reply with JSON only: {"jumps": ["each jump you found, a few words"], "script": "the rewritten script, blank lines between beats"}`
}

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
/** The checks a program can do. */
export function lintScript(script: string, targetWords: number) {
  const issues: string[] = []
  const lower = script.toLowerCase().replace(/[’‘]/g, "'")
  const found = BANNED.filter((b) => lower.includes(b))
  if (found.length) issues.push(`Remove these tired phrases and say it plainly instead: ${found.map((f) => `"${f}"`).join(', ')}.`)
  const n = words(script).length
  if (targetWords && Math.abs(n - targetWords) / targetWords > 0.15)
    issues.push(`It is ${n} words; it must be about ${targetWords} (within 10%). ${n > targetWords ? 'Cut the weakest sentences, not the facts.' : 'Add a concrete example or a reveal where a beat is thin, not filler.'}`)
  const long = sentences(script).filter((s) => words(s).length > 24)
  if (long.length) issues.push(`Split these long sentences: ${long.slice(0, 4).map((s) => `"${s.slice(0, 80)}…"`).join(' ')}`)
  const first = sentences(script)[0] ?? ''
  if (/^(hi|hello|hey|welcome|today|so,? today|in this|what is|.{0,40}\b(is|are) (a|an|the) (term|type|kind|process|method)\b)/i.test(first.trim()))
    issues.push(`The first sentence is a greeting or a definition: "${first.slice(0, 90)}". Open on the most surprising concrete thing instead.`)
  if (/^\s*(#|\*|-|\d+\.)\s|\[[^\]]+\]|\([^)]*(music|pause|sfx|cut to)[^)]*\)/im.test(script)) issues.push('Remove headings, bullet points and stage directions: plain spoken text only.')
  // A beat (after the first) that starts on a new subject with no bridge from the one before.
  const cold = script.split(/\n\s*\n/).slice(1).map((b) => b.trim()).filter((b) => COLD.test(b))
  if (cold.length)
    issues.push(`These beats open cold, on a new subject with no bridge: ${cold.slice(0, 3).map((b) => `"${b.slice(0, 50)}…"`).join(' ')} Start each with a BUT or SO sentence that picks up what the beat before left open.`)
  if (TALKS_DOWN.test(lower)) issues.push(`A line talks down to the viewer ("${lower.match(TALKS_DOWN)![0]}"): tease the situation, not them.`)
  return issues
}

/** Beat openings that change the subject without a bridge. */
const COLD = /^(now meet|meet |here's the secret|here is the secret|look at |let's |next,|another |moving on|now,? let's|now for)/i
/** Asides that make fun of the viewer rather than the situation. */
const TALKS_DOWN = /fine, you don't care|you probably don't care|you probably didn't know|i know you don't care/

/** The JSON both writers return. `hooks` are other strong openings the creator can swap in. */
export const SCRIPT_JSON = `"title": "a curiosity-driven title, at most 60 characters, that makes the opening question irresistible (no clickbait lies)",
 "hooks": ["two other strong openings, each 1–2 sentences, different kinds from the one you used"],
 "script": "the full voiceover script, blank lines between beats"`
