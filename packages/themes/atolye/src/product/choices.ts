import type { ProductOptionView, VariantView } from "@qticaret/ui"

type Chosen = Record<string, string>

/** The variant the choices name; none when the shop sells no such combination. */
export const matching = (variants: VariantView[], options: ProductOptionView[], chosen: Chosen) =>
  variants.find((each) =>
    options.every((option) => each.options[option.id] === chosen[option.id])
  ) ?? null

/**
 * Whether a value is sold out with the other choices kept: no variant
 * with it (and with what else is chosen) is in stock.
 */
export const soldOutOf =
  (variants: VariantView[], options: ProductOptionView[], chosen: Chosen) =>
  (optionId: string, value: string) =>
    !variants.some(
      (each) =>
        each.available &&
        each.options[optionId] === value &&
        options.every(
          (option) => option.id === optionId || each.options[option.id] === chosen[option.id]
        )
    )

/**
 * The choices in words, as their legends say them ("Sap rengi: Kahverengi"):
 * the options with a real choice only; none when the product has none.
 */
export const choiceText = (options: ProductOptionView[], chosen: Chosen): string | null =>
  options
    .filter((option) => option.values.length > 1 && chosen[option.id])
    .map((option) => `${option.title}: ${chosen[option.id] ?? ""}`)
    .join(", ") || null
