import { useTranslation } from "react-i18next"
import type { HeaderBarSection } from "@/features/storefront/api/layout"
import { SwitchRow } from "../theme-fields"
import { FIELD_IDS } from "./field-registry"
import type { SectionFormProps } from "./form-props"

/**
 * The shop's header bar (adr/0049 Ek 2026-11-14 §5): whether it stays at
 * the top of a long page, the theme settings' "Sabit üst bilgi" before.
 * Its look is the variant's ("Biçim"); the logo and menus are edited on
 * their own screens.
 */
export function HeaderBarForm({ section, onChange }: SectionFormProps<HeaderBarSection>) {
  const { t } = useTranslation()
  return (
    <SwitchRow
      id={FIELD_IDS.sticky(section.id)}
      label={t("storefront.editor.headerBar.sticky")}
      hint={t("storefront.editor.headerBar.stickyHint")}
      checked={section.sticky}
      onChange={(sticky) => {
        onChange({ ...section, sticky })
      }}
    />
  )
}
