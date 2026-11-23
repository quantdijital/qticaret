import type { ILockingModule } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { lockOrder } from "./acquire-locks"

export interface WithLocksOptions {
  /** Seconds to wait for all the keys together (each key at least 1, as Medusa's). */
  timeout: number
  /** Seconds a key outlives a process that died holding it (Redis renews it meanwhile). */
  expire?: number
}

/**
 * `locking.execute` for several keys, without its leak: Medusa's Redis
 * provider (2.21.2) takes the keys side by side and, timing out on a held
 * one, never gives back the others it took (their lease runs out after
 * 60 s); the in-memory one keeps them until the held key frees. Here each
 * key is taken by its own `execute`, in one fixed order (no two callers
 * wait on each other), one inside the other: each has its own owner and
 * lease renewal, a timeout lets go of the keys already held, and every
 * key is given back once `job` ends, however it ends. No key at all is a
 * caller's mistake (the job would run unguarded): it throws.
 */
export function withLocks<T>(
  locking: ILockingModule,
  keys: string | string[],
  job: () => Promise<T>,
  options: WithLocksOptions
): Promise<T> {
  const ordered = lockOrder(keys)
  if (ordered.length === 0) {
    return Promise.reject(
      new MedusaError(MedusaError.Types.INVALID_DATA, "withLocks needs at least one key")
    )
  }
  const deadline = Date.now() + options.timeout * 1000
  const hold = (index: number): Promise<T> => {
    const key = ordered[index]
    if (key === undefined) {
      return job()
    }
    const left = Math.max((deadline - Date.now()) / 1000, 0)
    return locking.execute(key, () => hold(index + 1), {
      timeout: left,
      ...(options.expire === undefined ? {} : { expire: options.expire }),
    })
  }
  return hold(0)
}
