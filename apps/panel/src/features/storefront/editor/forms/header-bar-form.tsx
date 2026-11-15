import { useTranslation } from "react-i18next"
import type { HeaderBarSection } from "@/features/storefront/api/layout"
import { SwitchRow } from "../theme-fields"
import { FIELD_IDS } from "./field-registry"
import type { SectionFormProps } from "./form-props"
import { HeaderCatalogFields } from "./header-catalog-fields"

/**
 * The shop's header bar (adr/0049 Ek 2026-11-14 §5): whether it stays at
 * the top of a long page, the theme settings' "Sabit üst bilgi" before.
 * Its look is the variant's ("Biçim"); the logo and menus are edited on
 * their own screens. The catalog header adds what it shows and its menu
 * bar's ground here (Ek 2026-11-15); its finer settings sit closed in
 * "Diğer ayarlar" (`SectionPanel`).
 */
export function HeaderBarForm({ section, problems, onChange }: SectionFormProps<HeaderBarSection>) {
  const { t } = useTranslation()
  const sticky = (
    <SwitchRow
      id={FIELD_IDS.sticky(section.id)}
      label={t("storefront.editor.headerBar.sticky")}
      hint={t("storefront.editor.headerBar.stickyHint")}
      checked={section.sticky}
      onChange={(next) => {
        onChange({ ...section, sticky: next })
      }}
    />
  )
  if (section.variant !== "catalog") {
    return sticky
  }
  return (
    <div className="flex flex-col gap-5">
      <HeaderCatalogFields
        section={section}
        group="content"
        problems={problems}
        onChange={onChange}
      />
      {sticky}
      <p className="text-xs text-muted-foreground">{t("storefront.editor.headerBar.phoneNote")}</p>
    </div>
  )
}
