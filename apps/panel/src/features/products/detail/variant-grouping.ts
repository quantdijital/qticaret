import type { ProductDetail } from "@/features/products/api/products"
import { valuesOf } from "./variant-options"
import type { OptionDraft } from "./variant-options"
import type { Variant } from "./variant-values"

/** Past this many variants the list is grouped by the first option's value. */
export const GROUP_FROM = 10

export interface VariantGroup {
  key: string
  /** "Renk: Kırmızı". */
  label: string
  variants: Variant[]
}

/**
 * The variants by the first option's value, in the order its values were
 * made; a variant without one last. Null while the list is short enough
 * to read at once, or the product has no option to group by.
 */
export function groupVariants(
  product: ProductDetail,
  variants: readonly Variant[],
  options: readonly OptionDraft[]
): VariantGroup[] | null {
  const first = options[0]
  if (!first || variants.length <= GROUP_FROM) {
    return null
  }
  const byValue = new Map<string, Variant[]>()
  for (const variant of variants) {
    const value = valuesOf(product, variant)[first.title] ?? ""
    byValue.set(value, [...(byValue.get(value) ?? []), variant])
  }
  const order = [...first.values, ...[...byValue.keys()].filter((v) => !first.values.includes(v))]
  return order.flatMap((value) => {
    const list = byValue.get(value)
    return list
      ? [{ key: value, label: value ? `${first.title}: ${value}` : "—", variants: list }]
      : []
  })
}
