/**
 * Colour arithmetic for specs that measure a theme's tokens: CSS Color 4's
 * OKLCH and sRGB both ways, and WCAG 2.2's contrast ratio.
 */

const gamma = (value: number): number => {
  const clipped = Math.min(1, Math.max(0, value))
  return clipped <= 0.0031308 ? 12.92 * clipped : 1.055 * clipped ** (1 / 2.4) - 0.055
}

const linear = (channel: number): number =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4

/** `#rrggbb` as linear-light sRGB channels, 0 to 1. */
function linearChannels(hex: string): [number, number, number] {
  const found = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(hex)
  if (!found) {
    throw new Error(`not a #rrggbb colour: ${hex}`)
  }
  const [r = 0, g = 0, b = 0] = found
    .slice(1)
    .map((part) => linear(Number.parseInt(part, 16) / 255))
  return [r, g, b]
}

/** `oklch(L% C H)` as `#rrggbb` (OKLCH → OKLab → linear sRGB → gamma, 8-bit). */
export function oklchToHex(lightness: number, chroma: number, hue: number): string {
  const L = lightness / 100
  const a = chroma * Math.cos((hue * Math.PI) / 180)
  const b = chroma * Math.sin((hue * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const channels = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((value) =>
    Math.round(gamma(value) * 255)
      .toString(16)
      .padStart(2, "0")
  )
  return `#${channels.join("")}`
}

/** `#rrggbb` as OKLCH: lightness in percent, chroma, hue in degrees (0 to 360). */
export function hexToOklch(hex: string): { lightness: number; chroma: number; hue: number } {
  const [r, g, b] = linearChannels(hex)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return {
    lightness: (0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s) * 100,
    chroma: Math.hypot(a, bb),
    hue: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360,
  }
}

/** A token's value as `#rrggbb`: a hex colour as it is, `oklch(L% C H)` converted. */
export function colourToHex(value: string): string {
  const found = /^oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)$/.exec(value.trim())
  return found ? oklchToHex(Number(found[1]), Number(found[2]), Number(found[3])) : value.trim()
}

/** WCAG 2.2 contrast ratio of two `#rrggbb` colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [lighter = 0, darker = 0] = [a, b]
    .map((hex) => {
      const [r, g, bl] = linearChannels(hex)
      return 0.2126 * r + 0.7152 * g + 0.0722 * bl
    })
    .sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}
