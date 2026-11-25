/**
 * The shopper's note at checkout ("Sipariş notu"): kept under a `qt_` key
 * on the cart, which storefronts cannot write (`refuseReservedMetadata`);
 * Medusa's cart completion copies the cart's metadata to the order, where
 * staff read it on the order page and the packing slip. Personal data: never
 * logged, erased with the order's other texts (KVKK).
 */
export const ORDER_NOTE_KEY = "qt_order_note"

/** At most this many characters (code points), counted after cleaning. */
export const ORDER_NOTE_MAX = 500

/** What a storefront may send before cleaning: room for the spaces and breaks cleaning drops. */
export const ORDER_NOTE_RAW_MAX = 2000

/**
 * The note as kept: one form of each letter (NFC), line breaks as `\n`,
 * a tab as a space, other control characters and lone surrogates dropped,
 * at most one empty line in a row, no spaces at either end.
 */
export function cleanOrderNote(text: string): string {
  let out = ""
  for (const char of text.normalize("NFC").replace(/\r\n?/g, "\n")) {
    const code = char.codePointAt(0) ?? 0
    if (code === 0x0a) {
      out += "\n"
    } else if (code === 0x09) {
      out += " "
    } else if (
      code < 0x20 ||
      (code >= 0x7f && code <= 0x9f) ||
      (code >= 0xd800 && code <= 0xdfff) ||
      // Bidirectional overrides can turn a note's text around on screen
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2066 && code <= 0x2069)
    ) {
      continue
    } else {
      out += char
    }
  }
  return out
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** Its length as the limit counts it: characters, not UTF-16 units. */
export const orderNoteLength = (note: string): number => Array.from(note).length

/** The note kept on a cart's or an order's metadata; anything else there is no note. */
export function orderNoteOf(metadata: unknown): string | null {
  if (metadata === null || typeof metadata !== "object") {
    return null
  }
  const value = (metadata as Record<string, unknown>)[ORDER_NOTE_KEY]
  if (typeof value !== "string") {
    return null
  }
  const note = cleanOrderNote(value)
  return note === "" ? null : Array.from(note).slice(0, ORDER_NOTE_MAX).join("")
}

/** The metadata with the note set, or taken off when it is empty. */
export function withOrderNote(
  metadata: Record<string, unknown> | null | undefined,
  note: string
): Record<string, unknown> {
  const rest = Object.fromEntries(
    Object.entries(metadata ?? {}).filter(([key]) => key !== ORDER_NOTE_KEY)
  )
  return note === "" ? rest : { ...rest, [ORDER_NOTE_KEY]: note }
}
