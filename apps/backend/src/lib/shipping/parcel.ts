/**
 * The parcel a set of cart or order lines makes (F7.2, adr/0031): its
 * weight and size in kilograms and centimetres, whatever units the shop
 * keeps products in, and its desi. A carrier charges the larger of the
 * weight and the desi (volume / 3000). Until boxes are planned (F7.8), the
 * lines go in one box: one unit keeps its own shape; more are their
 * volumes added up, shaped as a cube. The desi comes from the volume
 * itself, not the rounded cube.
 *
 * Measures are optional (adr/0054): a line without a weight or a measure
 * takes that value from the shop's default parcel, per unit; the carrier
 * measures the real parcel itself. Only a value that cannot be a measure
 * (below zero, not a number) is refused.
 */

export interface ParcelUnits {
  weight_unit: "g" | "kg"
  dimension_unit: "cm" | "mm"
}

/** A parcel's four values in the shop's units (Settings > Store). */
export interface ParcelMeasures {
  weight: number
  length: number
  width: number
  height: number
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
  /** Every line carried its own weight and measures: nothing came from the default parcel. */
  measured: boolean
}

/**
 * The platform's default parcel (adr/0054), until the shop sets its own:
 * 1 kg in a 30 × 20 × 10 cm box, 2 desi, a small parcel's band.
 */
export const PLATFORM_PARCEL = { weight_g: 1000, length_cm: 30, width_cm: 20, height_cm: 10 }

/** The shop's default parcel in its units: its own (Settings > Shipping), else the platform's. */
export function defaultParcelOf(saved: ParcelMeasures | null, units: ParcelUnits): ParcelMeasures {
  if (saved) {
    return saved
  }
  const side = (cm: number) => (units.dimension_unit === "mm" ? cm * 10 : cm)
  return {
    weight: units.weight_unit === "kg" ? PLATFORM_PARCEL.weight_g / 1000 : PLATFORM_PARCEL.weight_g,
    length: side(PLATFORM_PARCEL.length_cm),
    width: side(PLATFORM_PARCEL.width_cm),
    height: side(PLATFORM_PARCEL.height_cm),
  }
}

/** Lines with a weight or measure that cannot be one (below zero, not a number). */
export class InvalidMeasures extends Error {
  constructor(readonly titles: string[]) {
    super(`parcel: ${String(titles.length)} line(s) with an invalid weight or measure`)
  }
}

const FIELDS = ["weight", "length", "width", "height"] as const

// Not entered: none, or zero (a sheet's empty cell, an old platform's "0")
const missing = (value: number | null | undefined): value is null | undefined | 0 =>
  value === null || value === undefined || value === 0

const valid = (value: number | null | undefined) =>
  missing(value) || (typeof value === "number" && Number.isFinite(value) && value > 0)

/** Rounded up to `decimals` places, without binary fractions' tails (26.7, not 26.700000000000003). */
const upTo = (value: number, decimals: number) => {
  const factor = 10 ** decimals
  return Math.ceil(value * factor - 1e-9) / factor
}

export function parcelOf(
  lines: readonly ParcelLine[],
  units: ParcelUnits,
  fallback: ParcelMeasures
): Parcel {
  const packed = lines.filter((line) => line.quantity > 0)
  const invalid = packed.filter((line) => !FIELDS.every((field) => valid(line[field])))
  if (invalid.length > 0) {
    throw new InvalidMeasures([...new Set(invalid.map((line) => line.title))])
  }
  const kg = units.weight_unit === "g" ? 1 / 1000 : 1
  const cm = units.dimension_unit === "mm" ? 1 / 10 : 1
  const own = (line: ParcelLine, field: (typeof FIELDS)[number]) => {
    const value = line[field]
    return missing(value) ? fallback[field] : value
  }
  let weight = 0
  let volume = 0
  for (const line of packed) {
    weight += own(line, "weight") * kg * line.quantity
    volume +=
      own(line, "length") * own(line, "width") * own(line, "height") * cm ** 3 * line.quantity
  }
  const [single] = packed
  const box =
    packed.length === 1 && single?.quantity === 1
      ? [own(single, "length"), own(single, "width"), own(single, "height")].map((side) =>
          upTo(side * cm, 1)
        )
      : Array.from({ length: 3 }, () => upTo(Math.cbrt(volume), 1))
  const weightKg = upTo(weight, 2)
  return {
    weight_kg: weightKg,
    length_cm: box[0] ?? 0,
    width_cm: box[1] ?? 0,
    height_cm: box[2] ?? 0,
    desi: upTo(Math.max(weightKg, volume / 3000), 1),
    measured: packed.every((line) => FIELDS.every((field) => !missing(line[field]))),
  }
}
