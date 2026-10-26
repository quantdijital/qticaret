import { randomInt } from "node:crypto"
import { CODE_ALPHABET } from "./single-use"
import type { RandomIndex } from "./single-use"

/**
 * Gift card codes (F4.8, ADR-0025): a prefix (GIFT, or the shop's own
 * word) and four groups of four, each of the sixteen characters drawn on
 * its own, about 80 bits. The loyalty plugin's generator draws ten bytes
 * and reuses them after the tenth character, so every card gets its code
 * here. A shop's word is only the prefix: whoever guesses a code spends
 * the card, so the random part is never left out.
 */
export const GIFT_CARD_CODE_LENGTH = 16
export const GIFT_CARD_PREFIX_MAX = 20
const GROUP = 4
const PREFIX = new RegExp(
  `^[A-Z0-9](?:[A-Z0-9-]{0,${String(GIFT_CARD_PREFIX_MAX - 2)}}[A-Z0-9])?$`,
  "u"
)

export function giftCardCode(prefix = "GIFT", random: RandomIndex = randomInt): string {
  const groups: string[] = []
  for (let start = 0; start < GIFT_CARD_CODE_LENGTH; start += GROUP) {
    let group = ""
    for (let index = 0; index < GROUP; index++) {
      group += CODE_ALPHABET[random(CODE_ALPHABET.length)] ?? ""
    }
    groups.push(group)
  }
  return [prefix, ...groups].join("-")
}

/** A shop's prefix in the stored form (`normalizeCode`): letters, digits and inner dashes, up to 20. */
export const isGiftCardPrefix = (prefix: string): boolean => PREFIX.test(prefix)
