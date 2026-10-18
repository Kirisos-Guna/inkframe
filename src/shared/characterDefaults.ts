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
