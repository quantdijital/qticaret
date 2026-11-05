/** The items mapped `limit` at a time, in their order: never more requests in flight than that. */
export async function mapLimited<T, R>(
  items: readonly T[],
  limit: number,
  each: (item: T) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next++
      out[index] = await each(items[index] as T)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}
