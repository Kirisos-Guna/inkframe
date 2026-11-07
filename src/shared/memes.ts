// Where the words go on each meme template, so captions sit in the meme's own panels (Drake's white side, the Gru
// boards, the Two Buttons) instead of over the picture. Boxes are fractions of the template: [x, y, w, h].
// "panel": dark plain text on a light area of the template; "label": white meme capitals with a black outline.
// Only these templates are offered to the planner, each with what every box means, in order.

export type MemeBox = { at: [number, number, number, number]; kind: 'panel' | 'label'; role: string }
export type MemeLayout = { name: string; boxes: MemeBox[]; use: string; anime?: boolean }

const P = (x: number, y: number, w: number, h: number, role: string): MemeBox => ({ at: [x, y, w, h], kind: 'panel', role })
const L = (x: number, y: number, w: number, h: number, role: string): MemeBox => ({ at: [x, y, w, h], kind: 'label', role })
const TOP = (role = 'top line') => L(0.02, 0.01, 0.96, 0.2, role)
const BOTTOM = (role = 'bottom line') => L(0.02, 0.79, 0.96, 0.2, role)
const topBottom = (name: string, use: string, top?: string, bottom?: string): MemeLayout => ({ name, use, boxes: [TOP(top), BOTTOM(bottom)] })

export const MEME_LAYOUTS: MemeLayout[] = [
  { name: 'Drake Hotline Bling', use: 'rejecting one thing for a better one', boxes: [P(0.5, 0, 0.5, 0.5, 'what he turns down'), P(0.5, 0.5, 0.5, 0.5, 'what he prefers')] },
  { name: 'Drake Blank', use: 'rejecting one thing for a better one', boxes: [P(0.49, 0, 0.51, 0.5, 'what he turns down'), P(0.49, 0.5, 0.51, 0.5, 'what he prefers')] },
  { name: 'No - Yes', use: 'no to one thing, yes to another', boxes: [P(0.38, 0.04, 0.6, 0.44, 'the no'), P(0.38, 0.52, 0.6, 0.44, 'the yes')] },
  { name: 'Tuxedo Winnie The Pooh', use: 'the plain way vs the fancy way', boxes: [P(0.44, 0, 0.56, 0.5, 'the plain version'), P(0.44, 0.5, 0.56, 0.5, 'the fancy version')] },
  {
    name: 'Two Buttons',
    use: 'a hard choice between two options',
    boxes: [L(0.07, 0.1, 0.34, 0.12, 'left button'), L(0.44, 0.06, 0.34, 0.12, 'right button'), L(0, 0.84, 1, 0.16, 'who has to choose')]
  },
  {
    name: 'Distracted Boyfriend',
    use: 'leaving the old thing for a new shiny one',
    boxes: [L(0.06, 0.58, 0.34, 0.18, 'the new shiny thing'), L(0.42, 0.3, 0.26, 0.18, 'who is distracted'), L(0.68, 0.48, 0.31, 0.18, 'the old thing being ignored')]
  },
  {
    name: "Gru's Plan",
    use: 'a plan whose last step backfires',
    boxes: [P(0.28, 0.09, 0.2, 0.38, 'step 1'), P(0.78, 0.09, 0.2, 0.38, 'step 2'), P(0.28, 0.58, 0.2, 0.38, 'step 3, the flaw'), P(0.78, 0.58, 0.2, 0.38, 'step 3 again, read in horror')]
  },
  { name: 'Epic Handshake', use: 'two different things that agree on one', boxes: [L(0.02, 0.62, 0.38, 0.2, 'one side'), L(0.6, 0.62, 0.38, 0.2, 'other side'), L(0.25, 0.02, 0.5, 0.2, 'what they agree on')] },
  topBottom('Disaster Girl', 'smug about chaos you caused'),
  topBottom('Waiting Skeleton', 'waiting forever for something'),
  topBottom('X, X Everywhere', 'something is suddenly everywhere', 'X', 'X everywhere'),
  { name: 'Marked Safe From', use: 'relief that something did not happen', boxes: [P(0.08, 0.52, 0.84, 0.18, 'what you are safe from today')] },
  { name: 'Change My Mind', use: 'a hot take', boxes: [P(0.42, 0.57, 0.44, 0.2, 'the hot take on the sign')] },
  { name: 'Woman Yelling At Cat', use: 'an accusation and a smug reply', boxes: [P(0, 0, 0.5, 0.21, 'the accusation'), P(0.5, 0, 0.5, 0.21, "the cat's reply")] },
  { name: 'Trade Offer', use: 'a lopsided deal', boxes: [L(0.02, 0.24, 0.46, 0.2, 'i receive'), L(0.52, 0.24, 0.46, 0.2, 'you receive')] },
  { name: 'Batman Slapping Robin', use: 'shutting down a bad idea', boxes: [P(0.04, 0.03, 0.44, 0.22, 'the bad idea (Robin)'), P(0.57, 0.03, 0.4, 0.18, 'the slap back (Batman)')] },
  topBottom('Ancient Aliens', 'a ridiculous explanation', 'the question', 'the absurd answer'),
  topBottom('Mocking Spongebob', 'mocking a dumb statement'),
  { name: 'Is This A Pigeon', anime: true, use: 'confidently mislabelling something', boxes: [L(0, 0.62, 0.52, 0.18, 'who is confused'), L(0.58, 0.04, 0.4, 0.18, 'the thing'), L(0, 0.82, 1, 0.17, 'is this ...?')] },
  topBottom('One Does Not Simply', 'something harder than it looks', 'one does not simply', 'do the hard thing'),
  topBottom('Absolute Cinema', 'something perfectly done'),
  { name: "Buff Doge vs. Cheems", use: 'the strong old version vs the weak new one', boxes: [P(0, 0.76, 0.5, 0.24, 'the strong one'), P(0.5, 0.76, 0.5, 0.24, 'the weak one')] },
  { name: "They're The Same Picture", use: 'two things that are secretly identical', boxes: [P(0.07, 0.05, 0.38, 0.2, 'the first thing'), P(0.55, 0.1, 0.38, 0.2, 'the second thing')] },
  {
    name: 'Expanding Brain',
    use: 'four ideas, each more galaxy-brained',
    boxes: [P(0, 0, 0.5, 0.25, 'the basic idea'), P(0, 0.25, 0.5, 0.26, 'a smarter one'), P(0, 0.51, 0.5, 0.23, 'smarter still'), P(0, 0.74, 0.5, 0.26, 'the absurd final form')]
  },
  topBottom('This Is Fine', 'pretending everything is fine'),
  topBottom('Megamind peeking', 'a teasing question', 'the question'),
  topBottom('Hide the Pain Harold', 'smiling through pain'),
  { name: 'Bell Curve', use: 'beginners and experts agree, the middle overthinks', boxes: [P(0, 0.4, 0.33, 0.2, 'the beginner'), P(0, 0.02, 0.38, 0.26, 'the overthinker in the middle'), P(0.67, 0.3, 0.33, 0.22, 'the expert')] },
  topBottom('Roll Safe Think About It', 'a dumb idea that sounds clever'),
  { name: 'Monkey Puppet', use: 'awkwardly looking away', boxes: [P(0, 0, 1, 0.36, 'the awkward moment')] },
  {
    name: 'Clown Applying Makeup',
    use: 'four steps to making a fool of yourself',
    boxes: [P(0, 0, 0.6, 0.25, 'step 1'), P(0, 0.25, 0.6, 0.25, 'step 2'), P(0, 0.5, 0.6, 0.25, 'step 3'), P(0, 0.75, 0.6, 0.25, 'the clown')]
  },
  { name: 'Two guys on a bus', use: 'same situation, two moods', boxes: [L(0, 0.02, 0.5, 0.2, 'the sad one (rock wall)'), L(0.5, 0.02, 0.5, 0.2, 'the happy one (the view)')] },
  { name: 'Evil Kermit', use: 'your bad side tempting you', boxes: [L(0, 0.78, 0.5, 0.22, 'me'), L(0.5, 0.78, 0.5, 0.22, 'the evil me says')] },
  topBottom('Bad Luck Brian', 'the worst possible outcome'),
  {
    name: 'Scooby doo mask reveal',
    use: 'revealing what something really is',
    boxes: [L(0, 0.02, 0.48, 0.16, 'what it looks like'), L(0.5, 0.02, 0.5, 0.16, "let's see what it really is"), L(0, 0.52, 0.48, 0.16, 'what it really is')]
  },
  {
    name: 'Grim Reaper Knocking Door',
    use: 'one thing taking out several in turn',
    boxes: [L(0.03, 0.12, 0.22, 0.15, 'first victim'), L(0.33, 0.12, 0.18, 0.15, 'second victim'), L(0.7, 0.12, 0.22, 0.15, 'next victim'), L(0.45, 0.84, 0.34, 0.15, 'the reaper')]
  },
  { name: 'spiderman pointing at spiderman', use: 'two identical things blaming each other', boxes: [L(0, 0.02, 0.5, 0.2, 'one'), L(0.5, 0.02, 0.5, 0.2, 'the other')] },
  { name: 'Surprised Pikachu', use: 'shock at an obvious consequence', boxes: [P(0, 0, 1, 0.38, 'the obvious cause and effect')] },
  { name: 'Panik Kalm Panik', use: 'panic, relief, then panic again', boxes: [P(0, 0, 0.47, 0.33, 'the panic'), P(0, 0.33, 0.47, 0.34, 'the relief'), P(0, 0.67, 0.47, 0.33, 'the twist')] },
  topBottom('Futurama Fry', 'not sure if A or B', 'not sure if ...', 'or ...'),
  topBottom('Gus Fring we are not the same', 'you do X, I do Y', 'you do X, I do Y', 'we are not the same'),
  { name: 'The Scroll Of Truth', use: 'a truth nobody wants to hear', boxes: [P(0.12, 0.56, 0.23, 0.28, 'the truth on the scroll')] },
  { name: 'Sleeping Shaq', use: 'ignoring one thing, waking for another', boxes: [P(0, 0, 0.5, 0.5, 'what does not bother you'), P(0, 0.5, 0.5, 0.5, 'what wakes you up')] },
  { name: 'Domino Effect', use: 'a tiny cause, a huge effect', boxes: [L(0.4, 0.6, 0.3, 0.14, 'the tiny cause'), L(0, 0.02, 0.45, 0.16, 'the huge effect')] },
  {
    name: 'Left Exit 12 Off Ramp',
    use: 'swerving to the wrong choice',
    boxes: [L(0.24, 0.14, 0.24, 0.22, 'the sensible way'), L(0.52, 0.14, 0.22, 0.22, 'the tempting exit'), L(0.3, 0.76, 0.45, 0.16, 'who swerves')]
  },
  {
    name: 'Anakin Padme 4 Panel',
    use: 'a plan with a worrying silence',
    boxes: [L(0, 0.35, 0.5, 0.14, 'the plan'), L(0.5, 0.35, 0.5, 0.14, 'the hopeful question'), L(0, 0.85, 0.5, 0.14, 'the silence (often empty)')]
  },
  { name: 'Always Has Been', use: 'realising something was always true', boxes: [L(0, 0.02, 0.6, 0.2, "wait, it's all X?"), L(0.6, 0.02, 0.4, 0.2, 'always has been')] },
  { name: 'UNO Draw 25 Cards', use: 'rather suffer than do one simple thing', boxes: [P(0.1, 0.27, 0.36, 0.22, 'the simple thing to do'), L(0.52, 0.02, 0.46, 0.16, 'who draws 25 instead')] },
  { name: 'Sad Pablo Escobar', use: 'lonely, waiting for something', boxes: [L(0, 0.36, 1, 0.13, 'the first'), L(0, 0.86, 0.5, 0.13, 'the second'), L(0.5, 0.86, 0.5, 0.13, 'the third')] },
  { name: 'Spider Man Triple', use: 'three identical things blaming each other', boxes: [L(0, 0.02, 0.34, 0.18, 'one'), L(0.33, 0.02, 0.34, 0.18, 'two'), L(0.66, 0.02, 0.34, 0.18, 'three')] },
  { name: 'Grant Gustin over grave', use: 'gloating over something dead', boxes: [P(0.13, 0.26, 0.28, 0.24, 'what died (on the stone)'), L(0.48, 0.82, 0.52, 0.17, 'who is gloating')] },
  topBottom('Laughing Leo', 'laughing at something'),
  { name: 'Types of Headaches meme', use: 'one thing is the worst headache', boxes: [P(0.53, 0.6, 0.45, 0.1, 'the worst headache')] },
  { name: 'Anime Girl Hiding from Terminator', anime: true, use: 'hiding from something hunting you', boxes: [L(0, 0.02, 0.38, 0.16, 'the hunter'), L(0.45, 0.02, 0.55, 0.16, 'who is hiding')] },
  topBottom('Squidward window', 'watching others have fun', 'what they do', 'me watching'),
  topBottom("This Is Where I'd Put My Trophy If I Had One", 'proud of nothing'),
  { name: 'Bernie I Am Once Again Asking For Your Support', use: 'asking again for the same thing', boxes: [L(0, 0.86, 1, 0.13, '...for your X (finishes his line)')] }
]

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const byKey = new Map(MEME_LAYOUTS.map((m) => [key(m.name), m]))

/** The layout for a template name (as Imgflip names it), or none when it is not one we place words on. */
export function memeLayout(name?: string): MemeLayout | undefined {
  if (!name) return undefined
  return byKey.get(key(name))
}

/** The planner's list: each template with what its boxes mean, in order. */
export function memeMenu() {
  return MEME_LAYOUTS.map((m) => `${m.name}${m.anime ? ' (anime)' : ''} (${m.use}): ${m.boxes.map((b, i) => `${i + 1}=${b.role}`).join(', ')}`).join('\n')
}

/**
 * Text wrapped to fit a box: the biggest size (down to `min`) whose lines fit `w` x `h`, measuring each character as
 * `cw` of the size (capitals in the meme font are about 0.48 of their height wide).
 */
export function fitText(text: string, w: number, h: number, o: { max?: number; min?: number; cw?: number; lh?: number } = {}) {
  const { max = 110, min = 22, cw = 0.5, lh = 1.08 } = o
  const words = text.split(/\s+/).filter(Boolean)
  for (let size = max; size >= min; size -= 2) {
    const per = Math.floor(w / (size * cw))
    if (words.some((x) => x.length > per)) continue
    const lines: string[] = []
    for (const x of words) {
      const last = lines[lines.length - 1]
      if (last !== undefined && last.length + 1 + x.length <= per) lines[lines.length - 1] = `${last} ${x}`
      else lines.push(x)
    }
    if (lines.length * size * lh <= h) return { size, lines }
  }
  return { size: min, lines: [text] }
}
