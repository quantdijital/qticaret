import { randomUUID } from "node:crypto"
import { setTimeout as sleep } from "node:timers/promises"
import type { ILockingModule } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { errorSummary, logger } from "../../lib/logging"

/** Medusa's `acquireLockStep` input, the part this platform uses. */
export interface AcquireLocksInput {
  key: string | string[]
  /** Seconds to keep trying, all keys together; 0: one try. */
  timeout?: number
  /** Seconds each key is held at most if never released; more than `timeout`. */
  ttl: number
  /** Seconds between tries of a key that is held. */
  retryInterval?: number
  /** Also lock when run as a nested workflow's step (Medusa skips it then, as here). */
  executeOnSubWorkflow?: boolean
}

/**
 * The keys a run holds and the owner it holds them as: the step's output,
 * handed to `releaseLocksStep`, and its compensation's input. Undefined
 * when the step was skipped (a nested run), so nothing is released then.
 */
export interface HeldLocks {
  keys: string[]
  ownerId: string
}

/** The keys in the one order every caller takes them: no two callers wait on each other. */
export const lockOrder = (key: string | string[]): string[] =>
  [...new Set(Array.isArray(key) ? key : [key])].filter((each) => each !== "").sort()

/**
 * A TTL no longer than the wait could run out on a key taken first while
 * the last is still awaited: the run would then go on with a key it lost.
 */
export function assertLockTimes(input: Pick<AcquireLocksInput, "timeout" | "ttl">): void {
  if (!(input.ttl > 0)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Lock ttl must be more than 0")
  }
  const timeout = input.timeout ?? 0
  if (!(timeout >= 0)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Lock timeout must be 0 or more")
  }
  if (!(input.ttl > timeout)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Lock ttl (${String(input.ttl)}s) must be longer than its timeout (${String(timeout)}s)`
    )
  }
}

/** Gives back `keys` held as `ownerId`, logging (not throwing) when that fails. */
export async function releaseOwned(
  locking: ILockingModule,
  keys: string[],
  ownerId: string
): Promise<void> {
  await locking.release(keys, { ownerId }).catch((error: unknown) => {
    logger.warn({ event: "locks.release_failed", keys, err: errorSummary(error) })
  })
}

async function acquireOne(
  locking: ILockingModule,
  key: string,
  args: { ownerId: string; expire?: number },
  deadline: number,
  retryMs: number
): Promise<void> {
  for (;;) {
    try {
      await locking.acquire(key, args)
      return
    } catch (error) {
      if (Date.now() >= deadline) {
        throw error
      }
    }
    await sleep(retryMs)
  }
}

/**
 * Medusa's `acquireLockStep` for several keys, all or none, each held as
 * this run's own owner. Medusa's own (2.21.2) hands the keys to the
 * provider in one call, which takes them one by one (in-memory) or side by
 * side (Redis) and, when one is held, throws with the others still taken:
 * its retries then fail on those (taken without an owner, they are
 * nobody's to take again), and a step that throws has no compensation, so
 * they stay locked until their TTL. Owner-less, its release also frees a
 * key that ran out and was taken by another run meanwhile. Here each key
 * is taken in a fixed order as a fresh owner, a held one tried again until
 * the timeout, and on failure the keys already taken are given back.
 * Released with `releaseLocksStep(<this step's output>)` or the
 * compensation, both only as that owner: never a key another run holds.
 */
export const acquireLocksStep = createStep(
  "qt-acquire-locks",
  async (input: AcquireLocksInput, { container, parentStepIdempotencyKey }) => {
    assertLockTimes(input)
    const keys = lockOrder(input.key)
    if (keys.length === 0) {
      // As withLocks: what follows would run unguarded
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "acquireLocksStep needs at least one key"
      )
    }
    const ownerId = `qt-locks:${randomUUID()}`
    if (parentStepIdempotencyKey && !input.executeOnSubWorkflow) {
      // Medusa's own step does the same; its type leaves a skip out
      return StepResponse.skip() as unknown as StepResponse<HeldLocks, HeldLocks>
    }
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    const deadline = Date.now() + (input.timeout ?? 0) * 1000
    const retryMs = (input.retryInterval ?? 0.3) * 1000
    const args = { ownerId, expire: input.ttl }
    const held: string[] = []
    try {
      for (const key of keys) {
        await acquireOne(locking, key, args, deadline, retryMs)
        held.push(key)
      }
    } catch (error) {
      if (held.length > 0) {
        await releaseOwned(locking, held, ownerId)
      }
      throw error
    }
    return new StepResponse<HeldLocks, HeldLocks>({ keys, ownerId }, { keys, ownerId })
  },
  async (held, { container }) => {
    if (!held || held.keys.length === 0) {
      return
    }
    // Logged, not thrown: a failing give-back must not stop the rest of the undo
    await releaseOwned(container.resolve<ILockingModule>(Modules.LOCKING), held.keys, held.ownerId)
  }
)
