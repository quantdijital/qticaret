import { useTranslation } from "react-i18next"
import { scrollerSettingsOf } from "@qticaret/types"
import type { CategoriesSection } from "@/features/storefront/api/layout"
import type { CategoriesCarouselFields } from "@/features/storefront/api/layout-cards"
import { PanelGroup } from "../panel-header"
import { FIELD_IDS } from "./field-registry"
import type { FieldGroupName } from "./field-registry"
import { ScrollerFields } from "./scroller-fields"
import { SCROLLER_MAIN } from "./scroller-groups"

type SlidingCards = CategoriesSection & CategoriesCarouselFields

/**
 * The categories' sliding cards' open "Kaydırma", as a product rail's: the
 * cards in view, the focus and the arrows; the kit's rarer settings (dots,
 * turning by itself, its step, looping, dragging) sit in "Diğer ayarlar".
 */
export function CategoryCarouselGroups({
  section,
  reveal,
  onChange,
}: {
  section: SlidingCards
  reveal: (group: FieldGroupName) => number | null
  onChange: (section: CategoriesSection) => void
}) {
  const { t } = useTranslation()
  return (
    <PanelGroup name="scroll" title={t("storefront.editor.panel.scroll")} reveal={reveal("scroll")}>
      <ScrollerFields
        value={scrollerSettingsOf(section.scroller)}
        settings={SCROLLER_MAIN}
        fieldId={(setting) => FIELD_IDS.scroller(section.id, setting)}
        onChange={(scroller) => {
          onChange({ ...section, scroller })
        }}
      />
    </PanelGroup>
  )
}
