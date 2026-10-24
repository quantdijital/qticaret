/**
 * Pixel width of a title or description as Google's result page shows it
 * (docs/13 §3, docs/14 P-TITLE-01), so a length check accounts for wide
 * Turkish letters instead of counting characters.
 *
 * Advance widths per 1000 em from the Helvetica metrics Adobe publishes with
 * its Core 14 AFM files; Arial and Liberation Sans are built to the same
 * widths (checked against Arial; `·` is Arial's own value, `₺` takes the
 * figure width).
 */

// Characters by advance width. Turkish letters take their base letter's
// width, except dotless ı (278), which is wider than i (222)
const WIDTH_GROUPS: readonly (readonly [number, string])[] = [
  [191, "'"],
  [222, "ijl‘’"],
  [260, "|"],
  [278, " !,./:;I[\\]ftıİîÎ"],
  [333, "()-`r“”·"],
  [334, "{}"],
  [350, "•"],
  [355, '"'],
  [389, "*"],
  [469, "^"],
  [500, "Jcksvxyzçş"],
  [556, "#$0123456789?L_abdeghnopquğöüâû–₺€«»"],
  [584, "+<=>~"],
  [611, "FTZ"],
  [667, "&ABEKPSVXYŞÂ"],
  [722, "CDHNRUwÇÜÛ"],
  [778, "GOQĞÖ"],
  [833, "Mm"],
  [889, "%"],
  [944, "W"],
  [1000, "—…"],
  [1015, "@"],
]

const WIDTHS: ReadonlyMap<string, number> = new Map(
  WIDTH_GROUPS.flatMap(([width, chars]) => Array.from(chars, (char) => [char, width] as const))
)

// Unknown Latin-like characters count as an average lowercase letter; CJK
// and emoji as a full em, so estimates err towards "too long"
const AVERAGE_WIDTH = 556
const WIDE_WIDTH = 1000
const WIDE = new RegExp(
  String.raw`[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6\p{Extended_Pictographic}]`,
  "u"
)

// Marks, format characters (ZWJ, soft hyphen) and variation selectors add no width
const ZERO_WIDTH = new RegExp(String.raw`[\p{Mn}\p{Me}\p{Cf}\uFE00-\uFE0F]`, "u")
// No-break spaces are as wide as a space
const SPACES = new Set(["\u00A0", "\u202F"])

function widthOf(char: string): number {
  if (ZERO_WIDTH.test(char)) {
    return 0
  }
  if (SPACES.has(char)) {
    return 278
  }
  const known = WIDTHS.get(char)
  if (known !== undefined) {
    return known
  }
  // é is measured as e
  const base = char.normalize("NFD").replace(/\p{M}/gu, "")
  return WIDTHS.get(base) ?? (WIDE.test(char) ? WIDE_WIDTH : AVERAGE_WIDTH)
}

/** Estimated width in pixels of `text` set at `fontSizePx`. */
export function estimatePixelWidth(text: string, fontSizePx: number): number {
  let units = 0
  for (const char of text.normalize("NFC")) {
    units += widthOf(char)
  }
  return (units * fontSizePx) / 1000
}

/**
 * Common estimates for Google's desktop result page: titles at 20 px cut
 * near 600 px, descriptions at 14 px near 920 px. Google publishes no fixed
 * limit; these drive warnings, never refusals.
 */
export const SERP_LIMITS = {
  title: { fontSizePx: 20, maxPx: 600 },
  description: { fontSizePx: 14, maxPx: 920 },
} as const

export type SerpField = keyof typeof SERP_LIMITS

/** Character targets of P-TITLE-01 and P-META-01 (docs/14); the pixel estimate refines the upper bound. */
export const SERP_TEXT_LENGTH = {
  title: { min: 30, max: 60 },
  description: { min: 70, max: 155 },
} as const

export function fitsSerp(field: SerpField, text: string): boolean {
  const { fontSizePx, maxPx } = SERP_LIMITS[field]
  return estimatePixelWidth(text, fontSizePx) <= maxPx
}
