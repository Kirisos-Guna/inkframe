import type { CharacterDef } from './types'

export const newCharacter = (id: string, name = 'Ada'): CharacterDef => ({
  id,
  name,
  skin: '#d9a07a',
  head: 'Oval',
  eyes: 'Round',
  eyeColour: '#3a2418',
  eyebrows: 'Soft',
  nose: 'Dot',
  hair: 'Bob',
  hairColour: '#3b2a20',
  glasses: true,
  outfit: 'Lab coat',
  outfitColour: '#4f6fd8',
  body: 'Average',
  pose: 'Wave',
  expression: 'Happy',
  drawnIn: 'Pen'
})

type Look = Partial<Omit<CharacterDef, 'id' | 'name'>> & { name: string; role: string }

/** A ready-made cast to start from: different ages, looks and jobs, so explainers have someone to cut to. */
export const STARTER_CAST: Look[] = [
  { name: 'Ada', role: 'Scientist', hair: 'Bob', glasses: true, outfit: 'Lab coat', skin: '#d9a07a', pose: 'Wave', expression: 'Happy' },
  { name: 'Marcus', role: 'Engineer', hair: 'Short', hairColour: '#151515', skin: '#7a4628', outfit: 'Overalls', hat: 'Hard hat', facialHair: 'Beard', body: 'Broad', pose: 'Hands on hips', expression: 'Smug' },
  { name: 'Priya', role: 'Student', hair: 'Ponytail', hairColour: '#151515', skin: '#b97c55', outfit: 'Hoodie', outfitColour: '#7d56d6', headphones: true, pose: 'Think', expression: 'Thinking', body: 'Slim' },
  { name: 'Leo', role: 'Coder', hair: 'Spiky', hairColour: '#c98f4a', skin: '#f0c9a6', outfit: 'T-shirt', outfitColour: '#2f9e6b', glasses: true, facialHair: 'Stubble', pose: 'Explain', expression: 'Neutral' },
  { name: 'Grace', role: 'Teacher', hair: 'Bun', hairColour: '#9aa0a8', skin: '#e3ac85', outfit: 'Sweater', outfitColour: '#d0473b', glasses: true, age: 'Older', pose: 'Present', expression: 'Happy' },
  { name: 'Kofi', role: 'Business owner', hair: 'Afro', hairColour: '#151515', skin: '#4f2d1a', outfit: 'Suit', outfitColour: '#2b2b30', pose: 'Point', expression: 'Happy', body: 'Average' },
  { name: 'Mia', role: 'Curious kid', hair: 'Curly', hairColour: '#b3423a', skin: '#f6dcc8', outfit: 'Overalls', age: 'Kid', pose: 'Cheer', expression: 'Laughing', eyes: 'Big' },
  { name: 'Hiro', role: 'Chef', hair: 'Short', hairColour: '#151515', skin: '#e3ac85', outfit: 'Apron', outfitColour: '#f2f2f2', facialHair: 'Mustache', pose: 'Thumbs up', expression: 'Happy' },
  { name: 'Sofia', role: 'Nurse', hair: 'Long', hairColour: '#7a4a26', skin: '#d9a07a', outfit: 'T-shirt', outfitColour: '#1f9e86', pose: 'Hold', expression: 'Neutral', eyes: 'Lashes' },
  { name: 'Walter', role: 'Grandad', hair: 'Bald', skin: '#f0c9a6', outfit: 'Sweater', outfitColour: '#5b6b7a', facialHair: 'Beard', hairColour: '#e6e6e6', age: 'Older', glasses: true, pose: 'Shrug', expression: 'Worried' },
  { name: 'Zara', role: 'News anchor', hair: 'Side part', hairColour: '#3b2a20', skin: '#9a5d3a', outfit: 'Jacket', outfitColour: '#c8372d', pose: 'Present', expression: 'Neutral', eyebrows: 'Arched' },
  { name: 'Sam', role: 'Everyday viewer', hair: 'Short', hairColour: '#7a4a26', skin: '#e3ac85', outfit: 'Hoodie', outfitColour: '#4f6fd8', hat: 'Beanie', pose: 'Facepalm', expression: 'Surprised' }
]

/** A full character from a starter look. */
export const fromLook = (id: string, look: Look): CharacterDef => {
  const { role, ...rest } = look
  return { ...newCharacter(id, look.name), glasses: false, description: role, ...rest }
}
