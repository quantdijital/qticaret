import { randomInt } from "node:crypto"
import { normalizeCode } from "./code"

/**
 * Single-use codes (F4.6, ADR-0024): a batch's codes start with its
 * template's code, then twelve characters a shopper reads off a card or a
 * receipt without mixing them up (no 0/O, no 1/I). 32 characters, twelve
 * of them: about 2^60 codes. Eight (2^40) fell to guessing from many
 * addresses at once against a 10,000-code batch (security review, F4).
 */
export const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
export const CODE_RANDOM_LENGTH = 12
export const MAX_CODES_PER_BATCH = 10_000
// Codes are at most 40 characters (ADR-0024): the prefix, a dash, the random part
const PREFIX_MAX = 40 - 1 - CODE_RANDOM_LENGTH

export type RandomIndex = (max: number) => number

/** A batch's prefix from its template's code, in the stored form and short enough. */
export const batchPrefix = (templateCode: string): string =>
  normalizeCode(templateCode).slice(0, PREFIX_MAX).replace(/-+$/u, "")

/** One code: the prefix, a dash and the random part. */
export function singleUseCode(prefix: string, random: RandomIndex = randomInt): string {
  let tail = ""
  for (let index = 0; index < CODE_RANDOM_LENGTH; index++) {
    tail += CODE_ALPHABET[random(CODE_ALPHABET.length)] ?? ""
  }
  return `${prefix}-${tail}`
}

/**
 * `count` codes no one has: none twice, none among `taken` (the codes the
 * shop already has). Gives up rather than loop forever if the random source
 * keeps repeating itself.
 */
export function freshCodes(
  prefix: string,
  count: number,
  taken: ReadonlySet<string>,
  random: RandomIndex = randomInt
): string[] {
  const codes = new Set<string>()
  for (let attempt = 0; codes.size < count; attempt++) {
    if (attempt > count * 10 + 100) {
      throw new Error("could not draw enough unique codes")
    }
    const code = singleUseCode(prefix, random)
    if (!taken.has(code)) {
      codes.add(code)
    }
  }
  return [...codes]
}
