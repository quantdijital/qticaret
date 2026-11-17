import type { EntityManager } from "@medusajs/framework/mikro-orm/knex"

/**
 * "Yeniden dene" (adr/0069 §10, slice 3): a clip that failed for the
 * infrastructure's reason back in the queue, one statement that names the
 * state it leaves (as `video-queue.ts`).
 *
 * `attempts` is not lowered: it fences a job's claim (security review S2),
 * so it only ever rises. The cap of three tries counts from `retry_from`
 * instead, set here to the tries made so far: a job still alive from
 * before (its claim saw a lower `attempts`) can never write over the new
 * one's work. The window is measured from `failed_at`, which only a move
 * into `failed` writes (a title change does not move it).
 */

export interface RetriedVideo {
  attempts: number
  /** `retry_from` and `failed_at` before this retry: what undoing it puts back. */
  previous_retry_from: number
  previous_failed_at: Date | string | null
}

/**
 * The failed clip `uploaded` again, only while it failed with `failedCode`
 * (an infrastructure failure), still has its source and failed after
 * `keptSince` (the nightly sweep removes a week-old failed source: a clip
 * it may be removing now is not retried). Null when it is not so.
 */
export async function retryVideo(
  manager: EntityManager,
  id: string,
  failedCode: string,
  keptSince: Date
): Promise<RetriedVideo | null> {
  const rows = await manager.execute<RetriedVideo[]>(
    `WITH before AS (SELECT id, retry_from, failed_at FROM media_video WHERE id = ? FOR UPDATE)
     UPDATE media_video SET status = 'uploaded', error_code = NULL, retry_from = attempts,
       failed_at = NULL, heartbeat_at = NULL, updated_at = now()
     FROM before
     WHERE media_video.id = before.id AND media_video.status = 'failed'
       AND media_video.kind = 'upload' AND media_video.error_code = ?
       AND media_video.source_file_id IS NOT NULL AND media_video.deleted_at IS NULL
       AND before.failed_at > ?
     RETURNING media_video.attempts, before.retry_from AS previous_retry_from,
       before.failed_at AS previous_failed_at`,
    [id, failedCode, keptSince]
  )
  return rows[0] ?? null
}

/**
 * Undoes `retryVideo` (a later step failed): `failed` again as it was,
 * only while no job has taken it since (still `uploaded` with the tries
 * it was retried at).
 */
export async function unretryVideo(
  manager: EntityManager,
  id: string,
  failedCode: string,
  retried: RetriedVideo
): Promise<boolean> {
  const rows = await manager.execute<{ id: string }[]>(
    `UPDATE media_video SET status = 'failed', error_code = ?, retry_from = ?, failed_at = ?,
       updated_at = now()
     WHERE id = ? AND status = 'uploaded' AND deleted_at IS NULL AND attempts = ?
       AND retry_from = attempts
     RETURNING id`,
    [
      failedCode,
      retried.previous_retry_from,
      retried.previous_failed_at ?? new Date(),
      id,
      retried.attempts,
    ]
  )
  return rows.length > 0
}
