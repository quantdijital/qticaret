/**
 * Colour contrast as WCAG 2.2 defines it (§1.4.3, "relative luminance" and
 * "contrast ratio"): the theme settings refuse a main colour the storefront
 * could not put white text on, or show on its page (adr/0053).
 */

/** WCAG AA for large text and for user interface parts (§1.4.3, §1.4.11). */
export const AA_LARGE_TEXT = 3

/** WCAG AA for body text (§1.4.3). */
export const AA_TEXT = 4.5

const HEX = /^#([0-9a-f]{6})$/i

/** `#rrggbb` as its three channels, 0–255; null for anything else. */
export function hexChannels(hex: string): [number, number, number] | null {
  const match = HEX.exec(hex.trim())
  if (!match?.[1]) {
    return null
  }
  const value = parseInt(match[1], 16)
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

// sRGB to linear light; WCAG 2.2 corrected the threshold to 0.04045
const linear = (channel: number): number => {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** The colour's relative luminance, 0 (black) to 1 (white). Throws on a malformed colour. */
export function relativeLuminance(hex: string): number {
  const channels = hexChannels(hex)
  if (!channels) {
    throw new TypeError("color.hex_invalid")
  }
  const [r, g, b] = channels.map(linear) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** The contrast ratio of two colours, 1 to 21, whichever is lighter. */
export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ]
  return (lighter + 0.05) / (darker + 0.05)
}

/** Whether the two colours reach `minimum` (by default AA for large text, 3:1). */
export const meetsContrast = (a: string, b: string, minimum = AA_LARGE_TEXT): boolean =>
  contrastRatio(a, b) >= minimum
