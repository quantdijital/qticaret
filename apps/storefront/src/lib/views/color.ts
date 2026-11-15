const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/

const INK = "#111113"
const WHITE = "#ffffff"

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

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

/** White or ink on `hex`, whichever reads better. */
export function readableOn(hex: string): string {
  const background = luminance(hex)
  return contrast(background, luminance(WHITE)) >= contrast(background, luminance(INK))
    ? WHITE
    : INK
}

/**
 * Whether `#rrggbb` reads as a red, a theme's sale colour (Tezgâh audit
 * K-05): its hue within 15° of pure red and saturated enough (HSL
 * saturation from 0.45) to be a colour, not a brown or a grey. Orange
 * (#c2410c, 18°) and wine (340°) are not.
 */
export function readsAsRed(hex: string): boolean {
  const parts = HEX.exec(hex)
  if (!parts) {
    return false
  }
  const [r = 0, g = 0, b = 0] = parts.slice(1).map((part) => Number.parseInt(part, 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const spread = max - min
  if (max !== r || spread === 0) {
    return false
  }
  const lightness = (max + min) / 2
  const saturation = spread / (1 - Math.abs(2 * lightness - 1))
  const hue = (60 * ((g - b) / spread) + 360) % 360
  return saturation >= 0.45 && (hue <= 15 || hue >= 345)
}

/** Whether `value` is a lower-case `#rrggbb`: the only colour form that goes into CSS. */
export const isHexColor = (value: unknown): value is string =>
  typeof value === "string" && HEX.test(value)

/**
 * The shop's main colour as theme tokens (D3, docs/19 §3): the primary
 * button, the focus ring and the announcement bar, each with readable
 * text. None for anything but `#rrggbb`: the value goes into CSS.
 */
export function brandDeclarations(hex: string | null): string[] {
  if (!isHexColor(hex)) {
    return []
  }
  const ink = readableOn(hex)
  return [
    `--primary:${hex}`,
    `--primary-foreground:${ink}`,
    `--ring:${hex}`,
    `--announcement:${hex}`,
    `--announcement-foreground:${ink}`,
  ]
}

/** The shop's colour names (F18 D5) as a lookup: a value reads as one, whatever its case. */
export function swatchLookup(
  swatches: readonly { label: string; hex: string }[]
): (value: string) => string | null {
  const byName = new Map(
    swatches.map((swatch) => [swatch.label.trim().toLocaleLowerCase("tr"), swatch.hex])
  )
  return (value) => byName.get(value.trim().toLocaleLowerCase("tr")) ?? null
}
