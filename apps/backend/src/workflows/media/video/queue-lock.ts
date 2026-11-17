import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../../lib/logging"
import { isLockBusy } from "../../pricing/price-history"

/**
 * The transcoding queue's shop-wide lock (adr/0069 §4), taken with
 * Locking's `acquire` under a run's own owner id. Checked against both
 * providers (in memory and Redis, 2026-11-17): another owner is refused at
 * once (Redis: a `conflict` MedusaError, no waiting without `awaitQueue`);
 * the same owner acquiring again extends the expiry; a release by another
 * owner returns false and leaves the lock held; an unrefreshed lock frees
 * itself after its expiry.
 */

export const VIDEO_QUEUE_LOCK = "media:video"
// Held on by the heartbeat (every 30 s); a process that died lets it go within two minutes
export const VIDEO_QUEUE_LOCK_EXPIRE_S = 120

const locking = (container: MedusaContainer) => container.resolve(Modules.LOCKING)

/** Another owner holds the lock (the providers' refusal), as opposed to the store failing. */
export const lockHeld = (error: unknown): boolean =>
  isLockBusy(error) || (error as { type?: unknown } | null)?.type === MedusaError.Types.CONFLICT

/** Takes or holds on to the lock as `owner`: the same owner extends its expiry. */
export async function holdVideoQueue(container: MedusaContainer, owner: string): Promise<void> {
  await locking(container).acquire(VIDEO_QUEUE_LOCK, {
    ownerId: owner,
    expire: VIDEO_QUEUE_LOCK_EXPIRE_S,
  })
}

/**
 * Lets the lock go; never throws (security review M1): a store that cannot
 * be reached leaves the lock to its expiry, and nothing done is undone.
 */
export async function releaseVideoQueue(container: MedusaContainer, owner: string): Promise<void> {
  try {
    await locking(container).release(VIDEO_QUEUE_LOCK, { ownerId: owner })
  } catch (error) {
    logger.warn({ event: "media.video_queue_release_failed", err: errorSummary(error) })
  }
}
