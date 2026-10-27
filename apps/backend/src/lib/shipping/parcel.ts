/**
 * The parcel a set of cart or order lines makes (F7.2, adr/0031): its
 * weight and size in kilograms and centimetres, whatever units the shop
 * keeps products in, and its desi. A carrier charges the larger of the
 * weight and the desi (volume / 3000). Until boxes are planned (F7.8), the
 * lines go in one box: their volumes added up, shaped as a cube, which
 * carries the same desi.
 */

export interface ParcelUnits {
  weight_unit: "g" | "kg"
  dimension_unit: "cm" | "mm"
}

/** A line as the parcel reads it: the variant's measures, else the product's. */
export interface ParcelLine {
  quantity: number
  title: string
  weight?: number | null
  length?: number | null
  width?: number | null
  height?: number | null
}

export interface Parcel {
  weight_kg: number
  length_cm: number
  width_cm: number
  height_cm: number
  /** The larger of the weight and the volume / 3000, to one decimal up. */
  desi: number
}

/** Lines whose weight or a measure is missing: no carrier can price them. */
export class MissingMeasures extends Error {
  constructor(readonly titles: string[]) {
    super(`parcel: ${String(titles.length)} line(s) without weight or measures`)
  }
}

const positive = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0

/** Rounded up to `decimals` places, without binary fractions' tails (26.7, not 26.700000000000003). */
const upTo = (value: number, decimals: number) => {
  const factor = 10 ** decimals
  return Math.ceil(value * factor - 1e-9) / factor
}

export function parcelOf(lines: readonly ParcelLine[], units: ParcelUnits): Parcel {
  const missing = lines.filter(
    (line) =>
      line.quantity > 0 &&
      ![line.weight, line.length, line.width, line.height].every((value) => positive(value))
  )
  if (missing.length > 0) {
    throw new MissingMeasures([...new Set(missing.map((line) => line.title))])
  }
  const kg = units.weight_unit === "g" ? 1 / 1000 : 1
  const cm = units.dimension_unit === "mm" ? 1 / 10 : 1
  let weight = 0
  let volume = 0
  for (const line of lines.filter((each) => each.quantity > 0)) {
    weight += (line.weight ?? 0) * kg * line.quantity
    volume += (line.length ?? 0) * (line.width ?? 0) * (line.height ?? 0) * cm ** 3 * line.quantity
  }
  const side = upTo(Math.cbrt(volume), 1)
  const weightKg = upTo(weight, 2)
  return {
    weight_kg: weightKg,
    length_cm: side,
    width_cm: side,
    height_cm: side,
    desi: upTo(Math.max(weightKg, (side * side * side) / 3000), 1),
  }
}
