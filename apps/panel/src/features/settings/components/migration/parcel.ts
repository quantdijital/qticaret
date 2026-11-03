import type { Parcel } from "@/features/settings/api/migration"

/** The owner's parcel as typed in its four inputs: grams and cm. */

export const PARCEL_FIELDS = ["weight", "length", "width", "height"] as const
export type ParcelField = (typeof PARCEL_FIELDS)[number]
export type ParcelText = Record<ParcelField, string>
export const NO_PARCEL: ParcelText = { weight: "", length: "", width: "", height: "" }

/** The four numbers as typed: none (null), all of them positive (the parcel), or neither. */
export function readParcel(values: ParcelText): Parcel | null | "invalid" {
  const texts = PARCEL_FIELDS.map((field) => values[field].trim())
  if (texts.every((text) => text === "")) {
    return null
  }
  const numbers = texts.map((text) => Number(text.replace(",", ".")))
  if (!numbers.every((value) => Number.isFinite(value) && value > 0)) {
    return "invalid"
  }
  return {
    weight: numbers[0] ?? 0,
    length: numbers[1] ?? 0,
    width: numbers[2] ?? 0,
    height: numbers[3] ?? 0,
  }
}
