import { useTranslation } from "react-i18next"
import type { CardVariant } from "@qticaret/types"
import { CARD_VARIANTS } from "@/features/storefront/api/theme"
import { ChoiceSelect } from "../theme-fields"

// The rail without a style of its own: the theme setting's
const THEME = "theme"
const OPTIONS = [THEME, ...CARD_VARIANTS] as const

/**
 * A product rail's card style (adr/0049 Ek 2026-11-14 §3.3, owner's
 * decision 4): the theme's, or one of its own. Only the style: the framed
 * card's switches stay the theme's (Tema > Çerçeveli kart).
 */
export function CardVariantField({
  value,
  onChange,
}: {
  value: CardVariant | null
  onChange: (value: CardVariant | null) => void
}) {
  const { t } = useTranslation()
  return (
    <ChoiceSelect
      id="products-card-variant"
      label={t("storefront.editor.products.cardVariant")}
      value={value ?? THEME}
      options={OPTIONS}
      onChange={(next) => {
        onChange(next === THEME ? null : next)
      }}
      render={(option) =>
        option === THEME
          ? t("storefront.editor.products.cardVariantTheme")
          : t(`storefront.editor.theme.cardVariants.${option}`)
      }
      hint={t("storefront.editor.products.cardVariantHint")}
    />
  )
}
