/**
 * The storefront's main colour as its theme paints it
 * (apps/storefront `lib/views/color.ts`): the Vitrin
 * page previews with the same colours, so what the shop sees in the panel
 * is what its customers see.
 */

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/

/** Near-black: the theme's own main colour and its dark text. */
const INK = "#111113"
const WHITE = "#ffffff"

/** The colour the storefront uses when the shop has chosen none. */
export const STOREFRONT_THEME_COLOR = INK

/**
 * The page colours the storefront's theme settings offer (adr/0053,
 * backend `THEME_BACKGROUNDS`): the contrast check reads them, so they are
 * the storefront's own values. `steel` is Grafit's counter, the default
 * (adr/0062 §3).
 */
export const STOREFRONT_BACKGROUNDS = {
  steel: "#f8fafc",
  warm: "#f6f4ef",
  neutral: "#f5f5f5",
  cool: "#f3f5f8",
} as const

export type StorefrontBackground = keyof typeof STOREFRONT_BACKGROUNDS

/** WCAG AA for large text and controls (§1.4.3, §1.4.11): what the server asks of the main colour. */
const AA_LARGE_TEXT = 3

/** WCAG relative luminance of `#rrggbb` (8-bit channels: 0.03928 and 0.04045 split them alike). */
function luminance(hex: string): number {
  const parts = HEX.exec(hex)
  if (!parts) {
    return 0
  }
  const [r = 0, g = 0, b = 0] = parts.slice(1).map((part) => {
    const channel = Number.parseInt(part, 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

/** White or near-black on `hex` (lower case `#rrggbb`), whichever reads better. */
export function storefrontTextOn(hex: string): string {
  const background = luminance(hex)
  return ratio(background, luminance(WHITE)) >= ratio(background, luminance(INK)) ? WHITE : INK
}

/** The contrast ratio of two `#rrggbb` colours, 1 to 21. */
export const contrastRatio = (a: string, b: string): number => ratio(luminance(a), luminance(b))

/**
 * Whether the storefront can put white text on the main colour and show it
 * on the chosen page colour, 3:1 both (adr/0053 §B.3): the server refuses
 * anything less with `platform_settings.color_contrast`.
 */
export const primaryReadable = (primary: string, background: StorefrontBackground): boolean =>
  contrastRatio(primary, WHITE) >= AA_LARGE_TEXT &&
  contrastRatio(primary, STOREFRONT_BACKGROUNDS[background]) >= AA_LARGE_TEXT
