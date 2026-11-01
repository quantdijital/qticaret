/**
 * The storefront's main colour as its base theme paints it
 * (packages/themes/base, apps/storefront `lib/views/color.ts`): the Vitrin
 * page previews with the same colours, so what the shop sees in the panel
 * is what its customers see.
 */

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/

/** Near-black: the theme's own main colour and its dark text. */
const INK = "#111113"
const WHITE = "#ffffff"

/** The colour the storefront uses when the shop has chosen none. */
export const STOREFRONT_THEME_COLOR = INK

/** WCAG relative luminance of `#rrggbb`. */
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
