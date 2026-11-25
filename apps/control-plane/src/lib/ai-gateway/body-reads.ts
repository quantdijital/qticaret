import {
  AI_GATEWAY_BODY_GRACE_MS,
  AI_GATEWAY_BODY_MIN_BYTES_PER_SECOND,
  AI_GATEWAY_BODY_PACE_CHECK_MS,
  AI_GATEWAY_MAX_BODY_READS,
  AI_GATEWAY_MAX_BODY_READS_PER_ADDRESS,
} from "./limits"

/**
 * The gateway calls' bodies being read (second security review of P3b,
 * N2): the slot is taken before a byte is kept, so the bytes one process
 * holds for requests whose signature is not yet checked are bounded,
 * whoever sends them (the calls in flight, in-flight.ts, are counted per
 * shop only once a signature proves the shop). The third review's O1: one
 * client address holds at most four of them, so a sender alone cannot
 * take every slot. Counted in this process only; the slot is given back
 * on every way out of the read (the body read, too large, too slow, the
 * sender gone, an error).
 */

export interface BodyReadTuning {
  /** Bodies read at once from one client address. */
  perAddress: number
  /** The slowest pace a body may keep once its grace is over. */
  minBytesPerSecond: number
  /** How long a body may arrive at any pace before the pace counts. */
  graceMs: number
  /** How often the pace is checked. */
  paceCheckMs: number
}

const DEFAULT_TUNING: BodyReadTuning = Object.freeze({
  perAddress: AI_GATEWAY_MAX_BODY_READS_PER_ADDRESS,
  minBytesPerSecond: AI_GATEWAY_BODY_MIN_BYTES_PER_SECOND,
  graceMs: AI_GATEWAY_BODY_GRACE_MS,
  paceCheckMs: AI_GATEWAY_BODY_PACE_CHECK_MS,
})

let tuning: BodyReadTuning = DEFAULT_TUNING
let reading = 0
const byAddress = new Map<string, number>()

/** The limits in force: limits.ts's, or a test's own. */
export const bodyReadTuning = (): BodyReadTuning => tuning

/** Tests only: smaller (or larger) limits; null puts limits.ts's back. */
export function tuneBodyReads(own: Partial<BodyReadTuning> | null): void {
  tuning = own === null ? DEFAULT_TUNING : { ...DEFAULT_TUNING, ...own }
}

/**
 * A slot for one body's read from `address` (the client's address as the
 * rate limits count it), or null: the process, or that address, is
 * reading its limit.
 */
export function holdBodyRead(address: string): (() => void) | null {
  const own = byAddress.get(address) ?? 0
  if (reading >= AI_GATEWAY_MAX_BODY_READS || own >= tuning.perAddress) {
    return null
  }
  reading += 1
  byAddress.set(address, own + 1)
  let given = false
  return () => {
    if (given) {
      return
    }
    given = true
    reading = Math.max(0, reading - 1)
    const left = (byAddress.get(address) ?? 0) - 1
    if (left > 0) {
      byAddress.set(address, left)
    } else {
      byAddress.delete(address)
    }
  }
}

/** The bodies being read now: in all, or from one address. */
export const bodyReadsNow = (address?: string): number =>
  address === undefined ? reading : (byAddress.get(address) ?? 0)

/** Tests only: forget every slot. */
export function resetBodyReads(): void {
  reading = 0
  byAddress.clear()
}
