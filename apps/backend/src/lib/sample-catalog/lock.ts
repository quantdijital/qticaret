import type { ILockingModule, MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { ConflictError, ValidationError, lockTimeoutError } from "../errors"

/**
 * One load or removal of the sample catalogue at a time (security review
 * 2026-11-28, D3). The key is held as the run's own owner
 * (`acquireLocksStep`) for `SAMPLE_LOCK_TTL` seconds and renewed as the run
 * goes (after each product a load writes, after each step of a removal):
 * a long run keeps it, a process that died lets it go within the TTL.
 */
export const SAMPLE_LOCK = "sample-catalog"
export const SAMPLE_LOCK_TTL = 600

export interface HeldSampleLock {
  keys: string[]
  ownerId: string
}

/**
 * The lock held a TTL longer, as the owner that took it (the locking
 * module extends a key its owner takes again). Throws when another run
 * holds it now (it ran out meanwhile): what follows would go unguarded.
 */
export async function renewSampleLock(
  container: Pick<MedusaContainer, "resolve">,
  held: HeldSampleLock | undefined
): Promise<void> {
  if (!held || held.keys.length === 0) {
    return
  }
  await container
    .resolve<ILockingModule>(Modules.LOCKING)
    .acquire(held.keys, { ownerId: held.ownerId, expire: SAMPLE_LOCK_TTL })
}

/** A busy sample lock as the answer a person reads (409), any other error as it is. */
export const busyAsConflict = (error: unknown): unknown =>
  lockTimeoutError(error) ? new ConflictError("sample_catalog.busy", { cause: error }) : error

/** The same for a background load: its job's error code (a validation key). */
export const busyAsJobError = (error: unknown): unknown =>
  lockTimeoutError(error) ? new ValidationError("sample_catalog.busy", { cause: error }) : error
