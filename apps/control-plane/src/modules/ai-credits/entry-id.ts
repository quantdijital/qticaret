import { randomBytes } from "node:crypto"

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const RANDOM_MAX = (1n << 80n) - 1n

let lastTime = 0
let lastRandom = 0n

const encode = (value: bigint, length: number): string => {
  let out = ""
  let rest = value
  for (let i = 0; i < length; i++) {
    out = `${ALPHABET.charAt(Number(rest & 31n))}${out}`
    rest >>= 5n
  }
  return out
}

/**
 * A ledger row's id (`aient_` + a ULID, like `generateEntityId`), but
 * monotonic within the process: rows one move writes share their
 * `created_at`, and the ledger reads `created_at DESC, id DESC`, so an
 * id later in the same millisecond must sort after the one before it
 * (a plain ULID's random part does not), or a month's grant and the
 * adjustment that rolled it come back in either order.
 */
export function ledgerEntryId(now: number = Date.now()): string {
  if (now > lastTime) {
    lastTime = now
    lastRandom = BigInt(`0x${randomBytes(10).toString("hex")}`) >> 1n
  } else {
    lastRandom = lastRandom < RANDOM_MAX ? lastRandom + 1n : 0n
    if (lastRandom === 0n) {
      lastTime += 1
    }
  }
  return `aient_${encode(BigInt(lastTime), 10)}${encode(lastRandom, 16)}`
}
