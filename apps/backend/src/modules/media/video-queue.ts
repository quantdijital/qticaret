import type { EntityManager } from "@medusajs/framework/mikro-orm/knex"

/**
 * The transcoding job's queue is the video records themselves (adr/0069
 * §4). Each move here is one statement that names the state it leaves, so
 * a video removed, swept back or taken by another process in between is
 * never moved twice: the caller learns it from the rows it got back.
 */

export interface ClaimedVideo {
  id: string
  source_file_id: string
  source_format: "mp4" | "mov" | "webm" | "gif"
  source_bytes: number | null
  attempts: number
}

export interface ReadyVideo {
  width: number
  height: number
  duration_ms: number
  outputs: Record<string, unknown>
  output_file_ids: string[]
  poster: Record<string, unknown>
  poster_file_ids: string[]
  /** Every file it holds now: the outputs, the poster's and (until removed) the source. */
  stored_bytes: number
}

export interface FailedTry {
  status: "uploaded" | "failed"
  attempts: number
  error_code: string | null
}

// A JSON array of text as Postgres `text[]` (a JS array would be spread into a list)
const TEXT_ARRAY = "ARRAY(SELECT jsonb_array_elements_text(?::jsonb))"

/** The oldest clip waiting (none of `exclude`), now `processing`; null when none waits. */
export async function claimNextVideo(
  manager: EntityManager,
  exclude: readonly string[]
): Promise<ClaimedVideo | null> {
  const skip =
    exclude.length > 0 ? "AND NOT (id IN (SELECT jsonb_array_elements_text(?::jsonb)))" : ""
  const rows = await manager.execute<ClaimedVideo[]>(
    `UPDATE media_video SET status = 'processing', heartbeat_at = now(), error_code = NULL,
       updated_at = now()
     WHERE id = (
       SELECT id FROM media_video
       WHERE status = 'uploaded' AND kind = 'upload' AND deleted_at IS NULL
         AND source_file_id IS NOT NULL ${skip}
       ORDER BY created_at, id LIMIT 1 FOR UPDATE SKIP LOCKED)
       AND status = 'uploaded'
     RETURNING id, source_file_id, source_format, source_bytes, attempts`,
    exclude.length > 0 ? [JSON.stringify(exclude)] : []
  )
  return rows[0] ?? null
}

/** The job's sign of life; false once the video is no longer its (removed, swept back). */
export async function beatVideo(manager: EntityManager, id: string): Promise<boolean> {
  const rows = await manager.execute<{ id: string }[]>(
    `UPDATE media_video SET heartbeat_at = now()
     WHERE id = ? AND status = 'processing' AND deleted_at IS NULL RETURNING id`,
    [id]
  )
  return rows.length > 0
}

/**
 * Videos `processing` without a sign of life since `before` (a process
 * killed, a machine restarted): one try more counted, back to the queue,
 * or `failed` with `failedCode` once `maxAttempts` are made.
 */
export async function requeueStaleVideos(
  manager: EntityManager,
  before: Date,
  maxAttempts: number,
  failedCode: string
): Promise<{ id: string; status: string }[]> {
  return await manager.execute<{ id: string; status: string }[]>(
    `UPDATE media_video SET
       status = CASE WHEN attempts + 1 >= ? THEN 'failed' ELSE 'uploaded' END,
       error_code = CASE WHEN attempts + 1 >= ? THEN ? ELSE NULL END,
       attempts = attempts + 1, heartbeat_at = NULL, updated_at = now()
     WHERE status = 'processing' AND deleted_at IS NULL
       AND COALESCE(heartbeat_at, updated_at) < ?
     RETURNING id, status`,
    [maxAttempts, maxAttempts, failedCode, before]
  )
}

/** The processed video, `ready`; false when it was removed or taken back meanwhile. */
export async function markVideoReady(
  manager: EntityManager,
  id: string,
  ready: ReadyVideo
): Promise<boolean> {
  const rows = await manager.execute<{ id: string }[]>(
    `UPDATE media_video SET status = 'ready', width = ?, height = ?, duration_ms = ?,
       outputs = ?::jsonb, output_file_ids = ${TEXT_ARRAY},
       poster = ?::jsonb, poster_file_ids = ${TEXT_ARRAY},
       stored_bytes = ?, error_code = NULL, heartbeat_at = NULL, processed_at = now(),
       updated_at = now()
     WHERE id = ? AND status = 'processing' AND deleted_at IS NULL RETURNING id`,
    [
      ready.width,
      ready.height,
      ready.duration_ms,
      JSON.stringify(ready.outputs),
      JSON.stringify(ready.output_file_ids),
      JSON.stringify(ready.poster),
      JSON.stringify(ready.poster_file_ids),
      ready.stored_bytes,
      id,
    ]
  )
  return rows.length > 0
}

/**
 * Undoes `markVideoReady` (a later step failed and its outputs are being
 * removed): `processing` again, naming no output, counting the source.
 */
export async function unmarkVideoReady(manager: EntityManager, id: string): Promise<void> {
  await manager.execute(
    `UPDATE media_video SET status = 'processing', outputs = NULL, output_file_ids = NULL,
       poster = NULL, poster_file_ids = NULL, processed_at = NULL,
       stored_bytes = COALESCE(source_bytes, 0), heartbeat_at = now(), updated_at = now()
     WHERE id = ? AND status = 'ready' AND deleted_at IS NULL AND source_file_id IS NOT NULL`,
    [id]
  )
}

/** A failed try written (`afterFailure`): only while the video is still this job's. */
export async function markVideoTried(
  manager: EntityManager,
  id: string,
  next: FailedTry
): Promise<boolean> {
  const rows = await manager.execute<{ id: string }[]>(
    `UPDATE media_video SET status = ?, attempts = ?, error_code = ?, heartbeat_at = NULL,
       updated_at = now()
     WHERE id = ? AND status = 'processing' AND deleted_at IS NULL RETURNING id`,
    [next.status, next.attempts, next.error_code, id]
  )
  return rows.length > 0
}

/** A ready video's source is gone from storage: no longer named, no longer counted. */
export async function forgetVideoSource(manager: EntityManager, id: string): Promise<void> {
  await manager.execute(
    `UPDATE media_video SET source_file_id = NULL,
       stored_bytes = GREATEST(0, stored_bytes - COALESCE(source_bytes, 0)), updated_at = now()
     WHERE id = ? AND status = 'ready' AND source_file_id IS NOT NULL`,
    [id]
  )
}
