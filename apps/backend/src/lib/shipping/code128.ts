/**
 * Code 128 (code set B) drawn as SVG, without a dependency (adr/0035): the
 * barcode a contract carrier's branch scans when the carrier gives no label
 * of its own (Yurtiçi). Printable ASCII only; our parcel codes are capital
 * letters and digits.
 */

// Bar and space widths of each symbol by its value (ISO/IEC 15417); 106 is the stop
// prettier-ignore
export const CODE128_PATTERNS: readonly string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312",
  "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222",
  "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131",
  "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321",
  "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121",
  "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224",
  "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114",
  "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112",
  "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113",
  "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412",
  "211214", "211232", "2331112",
]

const START_B = 104
const STOP = 106
// Ten modules of white each side, as the standard asks
const QUIET = 10

/** The symbols for a text: start B, a symbol per character, the check symbol, stop. */
export function code128Values(text: string): number[] {
  if (!/^[\x20-\x7E]{1,48}$/.test(text)) {
    throw new RangeError("code128: 1 to 48 printable ASCII characters")
  }
  const values = Array.from(text, (char) => char.charCodeAt(0) - 32)
  const check = values.reduce((sum, value, index) => sum + value * (index + 1), START_B) % 103
  return [START_B, ...values, check, STOP]
}

/**
 * The barcode as an SVG drawing, one unit per module; `moduleMm` sets the
 * printed width of a module (0.375 mm is three dots of a 203 dpi printer).
 */
export function code128Svg(text: string, options: { moduleMm?: number; heightMm?: number } = {}) {
  const moduleMm = options.moduleMm ?? 0.375
  const heightMm = options.heightMm ?? 18
  const height = Math.round(heightMm / moduleMm)
  let x = QUIET
  const bars: string[] = []
  for (const value of code128Values(text)) {
    Array.from(CODE128_PATTERNS[value] ?? "", Number).forEach((width, index) => {
      // Even places are bars, odd places the spaces between them
      if (index % 2 === 0) {
        bars.push(`M${String(x)} 0h${String(width)}v${String(height)}h-${String(width)}z`)
      }
      x += width
    })
  }
  const width = x + QUIET
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(width)} ${String(height)}" ` +
    `width="${(width * moduleMm).toFixed(2)}mm" height="${String(heightMm)}mm" ` +
    `shape-rendering="crispEdges" aria-hidden="true">` +
    `<path fill="#000" d="${bars.join("")}"/></svg>`
  )
}
