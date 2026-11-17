import { errorSummary, logger } from "../../../lib/logging"
import type MediaModuleService from "../../../modules/media/service"
import type { ClaimedVideo } from "../../../modules/media/service"
import { lockHeld } from "./queue-lock"

/**
 * A clip's job watched (adr/0069 §4): every 30 s its heartbeat is written
 * (fenced by the claim's `attempts`, review S2) and the shop's lock held
 * on; after 10 minutes the job is stopped. The job is stopped too when the
 * video is no longer its (removed, swept back: `gone`) or the lock went to
 * another owner (`lockLost`). Once stopped, no heartbeat is written and the
 * lock is no longer held (review S1): the record goes stale for the
 * sweeper and the lock lapses. One beat at a time; none after `stop`
 * (review S4).
 */

export interface JobWatch {
  readonly signal: AbortSignal
  readonly state: { gone: boolean; lockLost: boolean }
  /** Stops the timers and waits for a beat in flight, a few seconds at most. */
  stop(): Promise<void>
}

export interface WatchOptions {
  heartbeatMs: number
  jobTimeoutMs: number
  keepLock?: () => Promise<void>
  /** How long `stop` waits for a beat in flight (default 5 s). */
  stopWaitMs?: number
}

const STOP_WAIT_MS = 5_000

export function watchJob(
  media: MediaModuleService,
  video: ClaimedVideo,
  { heartbeatMs, jobTimeoutMs, keepLock, stopWaitMs = STOP_WAIT_MS }: WatchOptions
): JobWatch {
  const controller = new AbortController()
  const state = { gone: false, lockLost: false }
  let stopped = false
  let inFlight: Promise<void> | null = null
  const timers: { beat?: NodeJS.Timeout; deadline?: NodeJS.Timeout } = {}
  const halt = () => {
    stopped = true
    clearInterval(timers.beat)
    clearTimeout(timers.deadline)
  }
  const abort = () => {
    halt()
    controller.abort()
  }
  const once = async () => {
    try {
      if (!(await media.beatVideo(video.id, video.attempts))) {
        state.gone = true
        abort()
        return
      }
      if (!stopped) {
        await keepLock?.()
      }
    } catch (error) {
      if (lockHeld(error)) {
        state.lockLost = true
        logger.warn({ event: "media.video_queue_lock_lost", video_id: video.id })
        abort()
        return
      }
      logger.warn({ event: "media.video_heartbeat_failed", err: errorSummary(error) })
    } finally {
      inFlight = null
    }
  }
  timers.deadline = setTimeout(abort, jobTimeoutMs)
  timers.beat = setInterval(() => {
    if (!stopped && inFlight === null) {
      inFlight = once()
    }
  }, heartbeatMs)
  return {
    signal: controller.signal,
    state,
    async stop() {
      halt()
      if (inFlight === null) {
        return
      }
      // A beat whose database or lock call hangs is not waited for past a few seconds
      // (re-review 1): the job returns and the queue goes on; the claim's fence keeps
      // whatever that beat might still write harmless
      let timer: NodeJS.Timeout | undefined
      const waited = new Promise<"late">((resolve) => {
        timer = setTimeout(() => {
          resolve("late")
        }, stopWaitMs)
      })
      const outcome = await Promise.race([inFlight.then(() => "done" as const), waited])
      clearTimeout(timer)
      if (outcome === "late") {
        logger.warn({ event: "media.video_heartbeat_hung", video_id: video.id })
      }
    },
  }
}
