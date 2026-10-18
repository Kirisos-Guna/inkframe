import type { CharacterDef } from '@shared/types'
import { CharacterArt } from '@shared/CharacterArt'

export function CharacterSvg({ c, mini = false }: { c: CharacterDef; mini?: boolean }) {
  if (mini) {
    // Crop to the head and shoulders.
    return (
      <div className="relative h-full w-full overflow-hidden">
        <div className="absolute left-1/2 top-[-12%] w-[220%] -translate-x-1/2">
          <CharacterArt c={c} />
        </div>
      </div>
    )
  }
  return <CharacterArt c={c} />
}
