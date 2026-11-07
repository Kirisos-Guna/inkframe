/**
 * The shots of a <Cuts> with their frames, without flashes: a shot on screen for less than `floor` frames cannot be
 * read, so it is left out and the next shot comes in at its place. The last shot is always kept. (Shared by the kit
 * and the sound cues, so both see the same shots.)
 */
export function flashFree<T>(list: T[], at: number[], end: number, floor: number) {
  const out: { c: T; from: number; to: number }[] = []
  let pending: number | null = null
  list.forEach((c, i) => {
    const from = at[i] ?? 0
    const to = at[i + 1] ?? end
    if (to - from < floor && i < list.length - 1) {
      pending ??= from
      return
    }
    out.push({ c, from: pending ?? from, to })
    pending = null
  })
  return out
}
