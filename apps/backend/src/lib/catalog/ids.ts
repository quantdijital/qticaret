/** Ids per query: an `IN` list well below Postgres' bind limit (65,535 parameters). */
export const ID_CHUNK = 5_000

/** The ids in lists of at most `size`, in order. */
export function chunksOf<T>(ids: readonly T[], size: number = ID_CHUNK): T[][] {
  const chunks: T[][] = []
  for (let start = 0; start < ids.length; start += size) {
    chunks.push(ids.slice(start, start + size))
  }
  return chunks
}
