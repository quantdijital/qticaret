import { AI_GATEWAY_MAX_BODY_READS } from "./limits"

/**
 * The gateway calls' bodies being read (second security review of P3b,
 * N2): the slot is taken before a byte is kept, so the bytes one process
 * holds for requests whose signature is not yet checked are bounded,
 * whoever sends them (the calls in flight, in-flight.ts, are counted per
 * shop only once a signature proves the shop). Counted in this process
 * only; the slot is given back on every way out of the read (the body
 * read, too large, too slow, the sender gone, an error).
 */

let reading = 0

/** A slot for one body's read, or null: the process is reading its limit. */
export function holdBodyRead(): (() => void) | null {
  if (reading >= AI_GATEWAY_MAX_BODY_READS) {
    return null
  }
  reading += 1
  let given = false
  return () => {
    if (given) {
      return
    }
    given = true
    reading -= 1
  }
}

/** The bodies being read now. */
export const bodyReadsNow = (): number => reading

/** Tests only: forget every slot. */
export function resetBodyReads(): void {
  reading = 0
}
