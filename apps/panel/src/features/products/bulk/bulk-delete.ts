/**
 * Deleting picked products one by one (WooCommerce's bulk "Move to
 * trash"), a few at a time: each goes through the same delete the product
 * page uses, so whatever the server refuses (the shop's plan, a role, a
 * rule) is skipped with its own reason and the rest still go. Pure but
 * for the delete it is handed, so it is tested on its own.
 */

/** Deletes at once: enough to be quick, few enough not to crowd the server's subscribers. */
export const DELETE_AT_ONCE = 3

export interface DeleteFailure {
  id: string
  failure: unknown
}

export interface DeleteOutcome {
  deleted: string[]
  failed: DeleteFailure[]
}

export async function deleteEach(
  ids: readonly string[],
  remove: (id: string) => Promise<unknown>,
  onProgress?: (done: number) => void
): Promise<DeleteOutcome> {
  const deleted: string[] = []
  const failed: DeleteFailure[] = []
  let next = 0
  let done = 0
  const worker = async () => {
    for (let id = ids[next]; id !== undefined; id = ids[next]) {
      next += 1
      try {
        await remove(id)
        deleted.push(id)
      } catch (failure) {
        failed.push({ id, failure })
      }
      done += 1
      onProgress?.(done)
    }
  }
  await Promise.all(Array.from({ length: Math.min(DELETE_AT_ONCE, ids.length) }, worker))
  // In the order picked, whatever order they finished in
  const order = new Map(ids.map((id, index) => [id, index]))
  const byOrder = (a: string, b: string) => (order.get(a) ?? 0) - (order.get(b) ?? 0)
  deleted.sort(byOrder)
  failed.sort((a, b) => byOrder(a.id, b.id))
  return { deleted, failed }
}

/** The reasons the skipped ones gave, each once with how many said it, most frequent first. */
export function groupReasons(
  failed: readonly DeleteFailure[],
  reasonOf: (failure: unknown) => string
): { reason: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const { failure } of failed) {
    const reason = reasonOf(failure)
    counts.set(reason, (counts.get(reason) ?? 0) + 1)
  }
  return [...counts].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count)
}
