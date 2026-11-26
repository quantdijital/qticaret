import { useTranslation } from "react-i18next"
import type { ProductDetail } from "@/features/products/api/products"

type ProductOption = NonNullable<ProductDetail["options"]>[number]

/** The option the wizard gives a product of no options ("Seçenek: Standart"): nothing to pick. */
export interface PlaceholderOption {
  title: string
  value: string
}

/** The wizard's placeholder option, from the same words the wizard writes it with. */
export function usePlaceholderOption(): PlaceholderOption {
  const { t } = useTranslation()
  return {
    title: t("products.wizard.defaultOption"),
    value: t("products.wizard.defaultValue"),
  }
}

// What Medusa names the option of a product made without any
const DEFAULT_OPTION = "Default option"

/** Medusa's "Default option", or the wizard's option of its one value: not a shopper's choice. */
export function isPlaceholderOption(option: ProductOption, placeholder: PlaceholderOption) {
  if (option.title === DEFAULT_OPTION) {
    return true
  }
  const values = option.values ?? []
  return (
    option.title === placeholder.title &&
    values.length <= 1 &&
    (values[0]?.value ?? placeholder.value) === placeholder.value
  )
}
