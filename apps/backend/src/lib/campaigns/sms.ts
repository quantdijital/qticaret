/**
 * A bulk text's length in parts (adr/0050 §4). Netgsm sends with
 * `encoding=TR`: the GSM 7-bit alphabet with the Turkish single shift
 * table, whose header leaves 155 characters for one part and 149 for each
 * part of a longer text; ş Ş ğ Ğ ı İ ç and the GSM extension characters
 * take two. A character outside both goes as UCS-2: 70, and 67 a part.
 * (GSM 03.38 / 3GPP TS 23.038; Netgsm's own page to be checked once the
 * account is open, adr/0050 §4.)
 */

/** At most this many parts a campaign's text may take. */
export const SMS_MAX_PARTS = 3

/**
 * The longest first name a message greets anyone with: personName()
 * (workflows/messaging/loaders/types.ts, adr/0036 Ek) gives a longer one
 * the greeting instead.
 */
export const LONGEST_FIRST_NAME = 40

/**
 * What stands in for `{ad}` when a text is counted (adr/0050 §4): the
 * longest name, every letter one the Turkish table sends in two septets,
 * so no name takes more of the text in its alphabet. A name with a letter
 * outside the table (â, î, û, …) sends the whole text as UCS-2; that the
 * count does not foresee.
 */
export const LONGEST_NAME = "ş".repeat(LONGEST_FIRST_NAME)

// GSM 03.38 default alphabet (the characters a phone shows), less the escape
const GSM_BASIC = new Set(
  [
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?",
    "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
  ].join("")
)
// The extension table, and the Turkish single shift table's own letters: two septets each
const GSM_DOUBLE = new Set(Array.from("^{}\\[~]|€şŞğĞıİç"))

export interface SmsLength {
  encoding: "gsm" | "ucs2"
  /** Septets (GSM) or UTF-16 units (UCS-2) the text takes. */
  units: number
  parts: number
}

const partsOf = (units: number, single: number, each: number): number =>
  units === 0 ? 0 : units <= single ? 1 : Math.ceil(units / each)

export function smsLength(text: string): SmsLength {
  let septets = 0
  for (const char of text) {
    if (GSM_BASIC.has(char)) {
      septets += 1
    } else if (GSM_DOUBLE.has(char)) {
      septets += 2
    } else {
      const units = text.length
      return { encoding: "ucs2", units, parts: partsOf(units, 70, 67) }
    }
  }
  return { encoding: "gsm", units: septets, parts: partsOf(septets, 155, 149) }
}

/** A line that runs into the next ends with a full stop, unless it has its own. */
const sentence = (text: string): string => {
  const trimmed = text.trim()
  return trimmed === "" || /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

/**
 * The text as it goes (adr/0050 §4): what the shop wrote, then its name
 * and the way to refuse, which every commercial text must carry (6563).
 */
export function composeSms(text: string, shopName: string, optOut: string): string {
  return [sentence(text), sentence(shopName), optOut.trim()].filter((part) => part !== "").join(" ")
}
