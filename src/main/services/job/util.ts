// Small helpers with no dependencies: text, chunks, and running things a few at a time.

/** Shortens text at a word boundary, with an ellipsis. */
export const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n)).replace(/[,;:.]?$/, '…'))

export const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))

/** Runs at most `n` of the given tasks at once, in the order they are handed in. */
export function limiter(n: number) {
  let active = 0
  const queue: (() => void)[] = []
  const next = () => {
    if (active >= n || !queue.length) return
    active++
    queue.shift()!()
  }
  return <T,>(fn: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      queue.push(() =>
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--
            next()
          })
      )
      next()
    })
}

export async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0
  let failed: Error | null = null
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length && !failed) {
        const x = items[i++]
        try {
          await fn(x)
        } catch (e) {
          failed = e as Error
        }
      }
    })
  )
  if (failed) throw failed
}
