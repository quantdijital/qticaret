import { BLANK_VARIANT, DEFAULT_VARIANT_KEY } from "./schema"
import type { VariantValues, WizardValues } from "./schema"

type Option = WizardValues["options"][number]

const MEASURES_BLANK = { weight: "", length: "", width: "", height: "" }

/** Every combination of the options' values, in the order they were typed. */
export function combinations(options: Option[]): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>(
    (rows, option) =>
      rows.flatMap((row) => option.values.map((value) => ({ ...row, [option.title]: value }))),
    [{}]
  )
}

const keyOf = (combo: Record<string, string>, options: Option[]) =>
  options.map((option) => combo[option.title] ?? "").join(" / ")

/**
 * The variant rows for the current options: one per combination, keeping
 * what was already typed for a combination that stays (its price, stock,
 * codes, cost, own parcel and pictures). Without options, the single
 * default row.
 */
export function syncVariants(
  options: Option[],
  current: VariantValues[],
  hasOptions: boolean
): VariantValues[] {
  const blank = { ...BLANK_VARIANT, image_urls: [] }
  if (!hasOptions || options.length === 0 || options.some((option) => option.values.length === 0)) {
    const kept = current.find((row) => row.key === DEFAULT_VARIANT_KEY) ?? current[0]
    // A single variant has the product's pictures and parcel: a combination's own ones go
    return [
      {
        ...blank,
        ...kept,
        ...MEASURES_BLANK,
        key: DEFAULT_VARIANT_KEY,
        title: "",
        options: {},
        image_urls: [],
      },
    ]
  }
  const byKey = new Map(current.map((row) => [row.key, row]))
  return combinations(options).map((combo) => {
    const key = keyOf(combo, options)
    const kept = byKey.get(key)
    return { ...blank, ...kept, key, title: key, options: combo }
  })
}
