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
 * The shop's main colour as theme tokens (D3, docs/19 §3): the primary
 * button, the focus ring and the announcement bar, each with readable
 * text. Null for anything but `#rrggbb`: the value goes into CSS.
 */
export function brandStyle(hex: string | null): string | null {
  if (hex === null || !HEX.test(hex)) {
    return null
  }
  const ink = readableOn(hex)
  return (
    `:root{--primary:${hex};--primary-foreground:${ink};--ring:${hex};` +
    `--announcement:${hex};--announcement-foreground:${ink}}`
  )
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
