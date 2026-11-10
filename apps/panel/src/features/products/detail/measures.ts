import { z } from "zod"
import { formatMeasureInput, parseMeasureInput } from "@qticaret/admin-ui/lib/money-input"

/** A parcel's measures (adr/0054), the product's or a variant's own, in the shop's units. */

export const MEASURES = [
  { name: "weight", unit: "weight" },
  { name: "length", unit: "dimension" },
  { name: "width", unit: "dimension" },
  { name: "height", unit: "dimension" },
] as const

export type MeasureName = (typeof MEASURES)[number]["name"]

/** A weight or a size: empty (not entered) or more than nothing, in the shop's unit. */
export const measureSchema = z
  .string()
  .trim()
  .refine((text) => text === "" || (parseMeasureInput(text) ?? 0) > 0, {
    message: "products.errors.measure",
  })
/** A stored measure as the field shows it; none (or none above zero) is empty. */
export const measureText = (value: number | null | undefined) =>
  typeof value === "number" && value > 0 ? formatMeasureInput(value) : ""

/** "30 × — × 5 cm": the three sizes in one line, a missing one as a dash; none, null. */
export function sizesLine(
  measures: Partial<Record<MeasureName, number | null | undefined>>,
  unit: string
): string | null {
  const sizes = [measures.length, measures.width, measures.height]
  return sizes.some((value) => measureText(value))
    ? `${sizes.map((value) => measureText(value) || "—").join(" × ")} ${unit}`
    : null
}
