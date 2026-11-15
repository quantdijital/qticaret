import { useTranslation } from "react-i18next"
import { STYLE_KIT } from "@/features/storefront/api/theme"
import type { ThemeSettings } from "@/features/storefront/api/theme"
import type { StyleKitField } from "@qticaret/types"
import { ChoiceSelect } from "./theme-fields"
import { THEME_FIELD } from "./forms/theme-registry"
import type { CardVariantsInUse } from "./forms/theme-registry"

const K = "storefront.editor.theme.styleKit"

interface KitChoiceProps {
  field: StyleKitField
  theme: ThemeSettings
  variants: CardVariantsInUse
  onChange: (theme: ThemeSettings) => void
}

/**
 * One style kit field (adr/0067 §1): its steps by their Turkish names, its
 * term small beside its label. Nothing until the storefront draws it
 * (`STYLE_KIT_READY`, through the registry's `shown`).
 */
export function KitChoice({ field, theme, variants, onChange }: KitChoiceProps) {
  const { t } = useTranslation()
  const meta = THEME_FIELD[field]
  if (!meta.shown(theme, variants)) {
    return null
  }
  return (
    <ChoiceSelect<string>
      id={meta.target}
      label={t(`${K}.${field}.label`)}
      term={t(`${K}.${field}.term`)}
      value={theme[field]}
      options={STYLE_KIT[field]}
      onChange={(value) => {
        onChange({ ...theme, [field]: value })
      }}
      render={(step) => t(`${K}.${field}.steps.${step}`)}
      hint={t(`${K}.${field}.hint`)}
    />
  )
}
