import { useTranslation } from "react-i18next"
import { HEADER_MENU_IMAGES, HEADER_SEARCH_STYLES } from "@qticaret/types"
import type { HeaderBarSection } from "@/features/storefront/api/layout"
import { SwitchRow } from "../theme-fields"
import { FIELD_IDS } from "./field-registry"
import type { SectionFormProps } from "./form-props"
import { HeaderCatalogFields } from "./header-catalog-fields"
import { StepChoice } from "./step-choice"

const H = "storefront.editor.headerBar"

/**
 * The shop's header bar (adr/0049 Ek 2026-11-14 §5): whether it stays at
 * the top of a long page, the theme settings' "Sabit üst bilgi" before,
 * how its search stands and where its menus show the categories' small
 * pictures (Ek 2026-11-15; every variant's, as the search, the dropdowns
 * and the phone's menu are): named steps, the default the drawing from
 * before.
 * Its look is the variant's ("Biçim"); the logo and menus are edited on
 * their own screens. The catalog header adds what it shows and its menu
 * bar's ground here (Ek 2026-11-15), the search's look over its other
 * search settings, the pictures beside its "Kategoriler" button; its finer
 * settings sit closed in "Diğer ayarlar" (`SectionPanel`).
 */
export function HeaderBarForm({ section, problems, onChange }: SectionFormProps<HeaderBarSection>) {
  const { t } = useTranslation()
  const sticky = (
    <SwitchRow
      id={FIELD_IDS.sticky(section.id)}
      label={t(`${H}.sticky`)}
      hint={t(`${H}.stickyHint`)}
      checked={section.sticky}
      onChange={(next) => {
        onChange({ ...section, sticky: next })
      }}
    />
  )
  const searchStyle = (
    <StepChoice
      id={FIELD_IDS.searchStyle(section.id)}
      label={t(`${H}.search_style.label`)}
      term={t(`${H}.search_style.term`)}
      hint={t(`${H}.search_style.hint`)}
      steps={HEADER_SEARCH_STYLES}
      value={section.search_style}
      fallback="field"
      nameOf={(step) => t(`${H}.search_style.${step}`)}
      onChange={(step) => {
        onChange({ ...section, search_style: step })
      }}
    />
  )
  const menuImages = (
    <StepChoice
      id={FIELD_IDS.menuImages(section.id)}
      label={t(`${H}.menu_images.label`)}
      term={t(`${H}.menu_images.term`)}
      hint={t(`${H}.menu_images.hint`)}
      steps={HEADER_MENU_IMAGES}
      value={section.menu_images}
      fallback="submenus"
      nameOf={(step) => t(`${H}.menu_images.${step}`)}
      onChange={(step) => {
        onChange({ ...section, menu_images: step })
      }}
    />
  )
  if (section.variant !== "catalog") {
    return (
      <div className="flex flex-col gap-5">
        {searchStyle}
        {menuImages}
        {sticky}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-5">
      <HeaderCatalogFields
        section={section}
        group="content"
        problems={problems}
        onChange={onChange}
        beforeSearch={searchStyle}
        afterCategories={menuImages}
      />
      {sticky}
      <p className="text-xs text-muted-foreground">{t(`${H}.phoneNote`)}</p>
    </div>
  )
}
