import { isCleanText } from "../../security/text"
import { readsAsLink } from "../../text/link-like"
import type { AddonCharset } from "./schema"

/**
 * A shopper's typed add-on text (adr/0052 §3): it is made on the product
 * and repeated in the shop's e-mails, so it is held to plain words. Read
 * as one line in NFC, its spaces collapsed; then the add-on's length and
 * characters, and never anything that reads as a link or an address
 * (adr/0036 Ek: the shop's e-mail does not carry a stranger's link).
 */

const CHARSETS: Readonly<Record<AddonCharset, RegExp>> = {
  // Letters of any script (Turkish ones are precomposed in NFC), digits, spaces
  letters_digits: /^[\p{L}\p{N} ]+$/u,
  text: /^[\p{L}\p{N} .,'&-]+$/u,
}

// Invisible and direction-changing characters
const FORMAT_CHARACTER = /\p{Cf}/u

/** The text as it is checked and kept: NFC, one line, single spaces, trimmed. */
export const plainAddonText = (text: string): string =>
  text.normalize("NFC").replace(/\s+/gu, " ").trim()

export type AddonTextProblem =
  "addons.text_required" | "addons.text_too_long" | "addons.charset" | "addons.text_link"

/** Why a plain text cannot be an add-on's, or null. */
export function addonTextProblem(
  text: string,
  rules: { max_length: number; charset: AddonCharset }
): AddonTextProblem | null {
  if (text === "") {
    return "addons.text_required"
  }
  // NFC: a Turkish letter is one unit; the character sets allow nothing outside the BMP
  if (text.length > rules.max_length) {
    return "addons.text_too_long"
  }
  if (readsAsLink(text)) {
    return "addons.text_link"
  }
  if (!isCleanText(text) || FORMAT_CHARACTER.test(text) || !CHARSETS[rules.charset].test(text)) {
    return "addons.charset"
  }
  return null
}
