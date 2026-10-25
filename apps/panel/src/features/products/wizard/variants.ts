import { DEFAULT_VARIANT_KEY } from "./schema"
import type { VariantValues, WizardValues } from "./schema"

type Option = WizardValues["options"][number]

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
 * code). Without options, the single default row.
 */
export function syncVariants(
  options: Option[],
  current: VariantValues[],
  hasOptions: boolean
): VariantValues[] {
  const blank = { price: "", stock: "0", sku: "", ean: "" }
  if (!hasOptions || options.length === 0 || options.some((option) => option.values.length === 0)) {
    const kept = current.find((row) => row.key === DEFAULT_VARIANT_KEY) ?? current[0]
    return [{ ...blank, ...kept, key: DEFAULT_VARIANT_KEY, title: "", options: {} }]
  }
  const byKey = new Map(current.map((row) => [row.key, row]))
  return combinations(options).map((combo) => {
    const key = keyOf(combo, options)
    const kept = byKey.get(key)
    return { ...blank, ...kept, key, title: key, options: combo }
  })
}
