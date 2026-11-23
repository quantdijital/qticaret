import type { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { logger } from "../../lib/logging"
import type { HeldLocks } from "./acquire-locks"

/**
 * Gives back what `acquireLocksStep` took, as the owner it took it as:
 * a key that ran out and is now another run's stays theirs. Given the
 * acquire step's output, so it releases exactly what that step took and
 * nothing when it was skipped (a nested run, its parent holding the keys):
 * the pair skips together. Resolves to whether every key was still held.
 */
export const releaseLocksStep = createStep(
  "qt-release-locks",
  async (held: HeldLocks | undefined, { container }) => {
    // Undefined when the acquire step was skipped
    if (!held || held.keys.length === 0) {
      return new StepResponse(true)
    }
    const released = await container
      .resolve<ILockingModule>(Modules.LOCKING)
      .release(held.keys, { ownerId: held.ownerId })
    if (!released) {
      // A lease ran out mid-run: the work after it went on unguarded
      logger.warn({ event: "locks.lost", keys: held.keys })
    }
    return new StepResponse(released)
  }
)
