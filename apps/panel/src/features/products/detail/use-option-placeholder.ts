import { useTranslation } from "react-i18next"
import type { Placeholder } from "./variant-options"

/** The option a product of no options gets (the wizard's): left out of the editor and its lists. */
export function usePlaceholder(): Placeholder {
  const { t } = useTranslation()
  return {
    title: t("products.wizard.defaultOption"),
    value: t("products.wizard.defaultValue"),
  }
}
