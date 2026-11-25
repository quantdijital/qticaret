import type { SimplePlan } from "@/features/products/api/product-simple"
import type { ProductDetail } from "@/features/products/api/products"
import { isPlaceholderOption } from "./placeholder-option"
import type { PlaceholderOption } from "./placeholder-option"

type ProductOption = NonNullable<ProductDetail["options"]>[number]

/** The options a shopper picks from: Medusa's "Default option" and the wizard's left out. */
export function realOptions(
  product: Pick<ProductDetail, "options">,
  placeholder: PlaceholderOption
): ProductOption[] {
  return (product.options ?? []).filter((option) => !isPlaceholderOption(option, placeholder))
}

/** A product of one variant and no option a shopper picks: a simple one. */
export function isSimpleProduct(
  product: Pick<ProductDetail, "variants" | "options">,
  placeholder: PlaceholderOption
): boolean {
  return (product.variants?.length ?? 0) <= 1 && realOptions(product, placeholder).length === 0
}

/**
 * What making the product simple keeping this variant does (`makeSimple`):
 * the others deleted; the wizard's placeholder option added unless the
 * product has one (Medusa's or the wizard's) already, so it never ends with
 * no option; the kept variant given a value for each option it then has
 * (its own, else the option's first); the real options taken off. A real
 * option named like the placeholder leaves the placeholder out: two
 * options of one name could not be told apart by title.
 */
export function simplePlan(
  product: ProductDetail,
  keep: string,
  placeholder: PlaceholderOption
): SimplePlan {
  const options = product.options ?? []
  const real = realOptions(product, placeholder)
  const kept = product.variants?.find((variant) => variant.id === keep)
  const clash = real.some((option) => option.title === placeholder.title)
  const hasPlaceholder = real.length < options.length
  const add = real.length > 0 && !hasPlaceholder && !clash ? placeholder : null
  const valueOf = (option: ProductOption) =>
    kept?.options?.find((value) => value.option_id === option.id)?.value ??
    option.values?.[0]?.value ??
    ""
  const values =
    real.length > 0 && !clash
      ? {
          ...Object.fromEntries(options.map((option) => [option.title, valueOf(option)])),
          ...(add ? { [add.title]: add.value } : {}),
        }
      : null
  return {
    keep,
    remove: (product.variants ?? []).flatMap((variant) =>
      variant.id === keep ? [] : [variant.id]
    ),
    add,
    values,
    options: real.map((option) => option.id),
  }
}
