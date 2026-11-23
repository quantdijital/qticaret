import { setTimeout as sleep } from "node:timers/promises"
import type { ILockingModule, Logger } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"

/** Medusa's `acquireLockStep` input, the part this platform uses. */
export interface AcquireLocksInput {
  key: string | string[]
  /** Seconds to keep trying, all keys together; 0: one try. */
  timeout?: number
  /** Seconds each key is held at most if never released. */
  ttl?: number
  /** Seconds between tries of a key that is held. */
  retryInterval?: number
  /** Also lock when run as a nested workflow's step (Medusa skips it then, as here). */
  executeOnSubWorkflow?: boolean
}

/** What the compensation gives back. */
interface Taken {
  keys: string[]
}

/** The keys in the one order every caller takes them: no two callers wait on each other. */
export const lockOrder = (key: string | string[]): string[] =>
  [...new Set(Array.isArray(key) ? key : [key])].filter((each) => each !== "").sort()

async function acquireOne(
  locking: ILockingModule,
  key: string,
  ttl: number | undefined,
  deadline: number,
  retryMs: number
): Promise<void> {
  for (;;) {
    try {
      await locking.acquire(key, ttl === undefined ? {} : { expire: ttl })
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
 * Medusa's `acquireLockStep` for several keys, all or none. Medusa's own
 * (2.21.2) hands the keys to the provider in one call, which takes them
 * one by one (in-memory) or side by side (Redis) and, when one is held,
 * throws with the others still taken: its retries then fail on those
 * (taken without an owner, they are nobody's to take again), and a step
 * that throws has no compensation, so they stay locked until their TTL.
 * Here each key is taken in a fixed order, a held one tried again until
 * the timeout, and on failure the keys already taken are given back.
 * Released as Medusa's: `releaseLockStep({ key })` or the compensation.
 */
export const acquireLocksStep = createStep(
  "qt-acquire-locks",
  async (input: AcquireLocksInput, { container, parentStepIdempotencyKey }) => {
    const keys = lockOrder(input.key)
    if (keys.length === 0) {
      return new StepResponse<undefined, Taken>(undefined, { keys: [] })
    }
    if (parentStepIdempotencyKey && !input.executeOnSubWorkflow) {
      // Medusa's own step does the same; its type leaves a skip out
      return StepResponse.skip() as unknown as StepResponse<undefined, Taken>
    }
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    const deadline = Date.now() + (input.timeout ?? 0) * 1000
    const retryMs = (input.retryInterval ?? 0.3) * 1000
    const held: string[] = []
    try {
      for (const key of keys) {
        await acquireOne(locking, key, input.ttl, deadline, retryMs)
        held.push(key)
      }
    } catch (error) {
      if (held.length > 0) {
        await locking.release(held).catch((released: unknown) => {
          container
            .resolve<Logger>(ContainerRegistrationKeys.LOGGER)
            .warn(`locks.release_failed: ${held.join(", ")} (${String(released)})`)
        })
      }
      throw error
    }
    return new StepResponse<undefined, Taken>(undefined, { keys })
  },
  async (taken, { container }) => {
    if (!taken || taken.keys.length === 0) {
      return
    }
    await container.resolve<ILockingModule>(Modules.LOCKING).release(taken.keys)
  }
)
