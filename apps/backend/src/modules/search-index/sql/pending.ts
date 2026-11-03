import type { Executor, PendingClaim } from "../types"
import { TEXT_ARRAY, idList } from "./documents"

/**
 * Products waiting to be indexed again (adr/0056). A catalogue write only
 * adds its products here (one cheap statement, never the index's work);
 * a drain claims a batch, indexes it and clears it. A product marked
 * again while claimed keeps its row with a newer version, so the change
 * is indexed after the claim that may have read it too early. A claim
 * not cleared in five minutes (a process gone) is taken again.
 */

/** A claim older than this was left by a process that stopped. */
export const CLAIM_SECONDS = 300

export async function markPending(db: Executor, productIds: readonly string[]) {
  if (productIds.length === 0) {
    return
  }
  await db.execute(
    `INSERT INTO search_pending (product_id)
     SELECT id FROM jsonb_array_elements_text(?::jsonb) AS id ORDER BY id
     ON CONFLICT (product_id) DO UPDATE
       SET version = search_pending.version + 1, queued_at = now()`,
    [idList(productIds)]
  )
}

/** Up to `limit` products to index, the longest waiting first; none another drain holds. */
export async function claimPending(db: Executor, limit: number): Promise<PendingClaim[]> {
  const rows = (await db.execute(
    `UPDATE search_pending p SET claimed_at = now()
      WHERE p.product_id IN (
        SELECT product_id FROM search_pending
         WHERE claimed_at IS NULL OR claimed_at < now() - make_interval(secs => ?)
         ORDER BY queued_at, product_id
         LIMIT ? FOR UPDATE SKIP LOCKED)
     RETURNING p.product_id, p.version::text AS version`,
    [CLAIM_SECONDS, limit]
  )) as PendingClaim[]
  return rows
}

/**
 * Claims done: a product not marked since is cleared; one marked again
 * meanwhile is let go, to be indexed once more.
 */
export async function finishPending(db: Executor, claims: readonly PendingClaim[]) {
  if (claims.length === 0) {
    return
  }
  await db.execute(
    `DELETE FROM search_pending p
      USING jsonb_to_recordset(?::jsonb) AS c(product_id text, version bigint)
      WHERE p.product_id = c.product_id AND p.version = c.version`,
    [JSON.stringify(claims)]
  )
  await db.execute(
    `UPDATE search_pending SET claimed_at = NULL WHERE product_id = ANY(${TEXT_ARRAY})`,
    [idList(claims.map((claim) => claim.product_id))]
  )
}

export async function pendingCount(db: Executor): Promise<number> {
  const [row] = (await db.execute(`SELECT count(*)::integer AS count FROM search_pending`, [])) as {
    count: number
  }[]
  return row?.count ?? 0
}
