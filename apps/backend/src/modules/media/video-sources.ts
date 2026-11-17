import type { EntityManager } from "@medusajs/framework/mikro-orm/knex"

/**
 * The nightly sweep letting go of a video's source (adr/0069 §1, §11;
 * security review S1). The sweep reads every record up front, so what it
 * read may be stale by the time it acts: a failed clip may have been
 * retried, a ready one taken back. Each release is therefore one
 * statement that checks the state again and stops naming the file (and
 * counting it) first; only when it returned the row is the file removed.
 * A refused removal then leaves an unnamed file in storage: the lesser
 * harm, as in review M2 (it is logged with its key).
 */

const released = (rows: { id: string }[]) => rows.length > 0

/** A failed clip's source, while it is still failed with this source since before `failedBefore`. */
export async function releaseFailedSource(
  manager: EntityManager,
  id: string,
  sourceFileId: string,
  failedBefore: Date
): Promise<boolean> {
  return released(
    await manager.execute<{ id: string }[]>(
      `UPDATE media_video SET source_file_id = NULL,
         stored_bytes = GREATEST(0, stored_bytes - COALESCE(source_bytes, 0)), updated_at = now()
       WHERE id = ? AND status = 'failed' AND deleted_at IS NULL AND source_file_id = ?
         AND failed_at < ?
       RETURNING id`,
      [id, sourceFileId, failedBefore]
    )
  )
}

/**
 * A ready clip's left-over source (the job could not remove it), while it
 * is still ready with this source since before `readyBefore`: a clip the
 * job has just made is left to the job's own last step.
 */
export async function releaseReadySource(
  manager: EntityManager,
  id: string,
  sourceFileId: string,
  readyBefore: Date
): Promise<boolean> {
  return released(
    await manager.execute<{ id: string }[]>(
      `UPDATE media_video SET source_file_id = NULL,
         stored_bytes = GREATEST(0, stored_bytes - COALESCE(source_bytes, 0)), updated_at = now()
       WHERE id = ? AND status = 'ready' AND deleted_at IS NULL AND source_file_id = ?
         AND COALESCE(processed_at, created_at) < ?
       RETURNING id`,
      [id, sourceFileId, readyBefore]
    )
  )
}
