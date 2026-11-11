/**
 * Runs `work` over `items`, at most `limit` at a time (C9 review L7): a
 * change to a package with many shops issues and pushes in small batches,
 * never all at once.
 */
export async function eachBounded<T>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<void>
): Promise<void> {
  let next = 0
  const lane = async () => {
    while (next < items.length) {
      const item = items[next]
      next += 1
      if (item !== undefined) {
        await work(item)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane))
}
