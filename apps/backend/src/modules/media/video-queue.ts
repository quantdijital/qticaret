import type { EntityManager } from "@medusajs/framework/mikro-orm/knex"

/**
 * The transcoding job's queue is the video records themselves (adr/0069
 * §4). Each move here is one statement that names the state it leaves, so
 * a video removed, swept back or taken by another process in between is
 * never moved twice: the caller learns it from the rows it got back.
 *
 * A job's claim is fenced by the `attempts` it saw (security review S2):
 * the sweeper counts one more when it puts a silent clip back, so a job
 * that was taken for dead can no longer beat, write `ready` or a failure
 * over the next job's work.
 */

export interface ClaimedVideo {
  id: string
  source_file_id: string
  source_format: "mp4" | "mov" | "webm" | "gif"
  source_bytes: number | null
  /** Tries made before this one; also this claim's fencing token. */
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

/** A video's files and state as stored now, removed or not. */
export interface VideoFiles {
  id: string
  status: string
  removed: boolean
  source_file_id: string | null
  output_file_ids: string[] | null
  poster_file_ids: string[] | null
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

// Still this claim's: processing, not removed, not swept back since
const HELD = "id = ? AND status = 'processing' AND deleted_at IS NULL AND attempts = ?"

/** The job's sign of life; false once the video is no longer its (removed, swept back). */
export async function beatVideo(
  manager: EntityManager,
  id: string,
  attempts: number
): Promise<boolean> {
  const rows = await manager.execute<{ id: string }[]>(
    `UPDATE media_video SET heartbeat_at = now() WHERE ${HELD} RETURNING id`,
    [id, attempts]
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
  attempts: number,
  ready: ReadyVideo
): Promise<boolean> {
  const rows = await manager.execute<{ id: string }[]>(
    `UPDATE media_video SET status = 'ready', width = ?, height = ?, duration_ms = ?,
       outputs = ?::jsonb, output_file_ids = ${TEXT_ARRAY},
       poster = ?::jsonb, poster_file_ids = ${TEXT_ARRAY},
       stored_bytes = ?, error_code = NULL, heartbeat_at = NULL, processed_at = now(),
       updated_at = now()
     WHERE ${HELD} RETURNING id`,
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
      attempts,
    ]
  )
  return rows.length > 0
}

/**
 * Undoes `markVideoReady` (a later step failed): `processing` again,
 * naming no output, counting the source. Only while its source is still
 * there (a clip without one could never be made again); true when it
 * changed the row, and only then may the caller remove the outputs.
 */
export async function unmarkVideoReady(manager: EntityManager, id: string): Promise<boolean> {
  const rows = await manager.execute<{ id: string }[]>(
    `UPDATE media_video SET status = 'processing', outputs = NULL, output_file_ids = NULL,
       poster = NULL, poster_file_ids = NULL, processed_at = NULL,
       stored_bytes = COALESCE(source_bytes, 0), heartbeat_at = now(), updated_at = now()
     WHERE id = ? AND status = 'ready' AND deleted_at IS NULL AND source_file_id IS NOT NULL
     RETURNING id`,
    [id]
  )
  return rows.length > 0
}

/** A failed try written (`afterFailure`): only while the video is still this claim's. */
export async function markVideoTried(
  manager: EntityManager,
  id: string,
  claimed: number,
  next: FailedTry
): Promise<boolean> {
  const rows = await manager.execute<{ id: string }[]>(
    `UPDATE media_video SET status = ?, attempts = ?, error_code = ?, heartbeat_at = NULL,
       updated_at = now()
     WHERE ${HELD} RETURNING id`,
    [next.status, next.attempts, next.error_code, id, claimed]
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

/** The files a video names now, removed or not (the removal reads them after its soft delete). */
export async function videoFiles(manager: EntityManager, id: string): Promise<VideoFiles | null> {
  const rows = await manager.execute<VideoFiles[]>(
    `SELECT id, status, deleted_at IS NOT NULL AS removed, source_file_id, output_file_ids,
       poster_file_ids
     FROM media_video WHERE id = ?`,
    [id]
  )
  return rows[0] ?? null
}

/**
 * A removed video's files that storage took (security review M2): only
 * those, compared with what the record names now. A list (outputs, the
 * poster's) is cleared only when every file in it was taken; the record
 * stops counting bytes once it names nothing.
 */
export async function forgetVideoFiles(
  manager: EntityManager,
  id: string,
  removed: readonly string[]
): Promise<void> {
  await manager.execute(
    `WITH taken AS (SELECT ${TEXT_ARRAY} AS ids)
     UPDATE media_video SET
       source_file_id = CASE WHEN source_file_id = ANY(taken.ids) THEN NULL ELSE source_file_id END,
       output_file_ids = CASE WHEN output_file_ids <@ taken.ids THEN NULL ELSE output_file_ids END,
       poster_file_ids = CASE WHEN poster_file_ids <@ taken.ids THEN NULL ELSE poster_file_ids END,
       updated_at = now()
     FROM taken
     WHERE media_video.id = ? AND media_video.deleted_at IS NOT NULL`,
    [JSON.stringify(removed), id]
  )
  await manager.execute(
    `UPDATE media_video SET stored_bytes = 0
     WHERE id = ? AND deleted_at IS NOT NULL AND source_file_id IS NULL
       AND output_file_ids IS NULL AND poster_file_ids IS NULL`,
    [id]
  )
}
