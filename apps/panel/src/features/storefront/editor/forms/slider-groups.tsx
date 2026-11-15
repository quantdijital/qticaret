import { useTranslation } from "react-i18next"
import { PanelGroup } from "../panel-header"
import type { FieldGroupName } from "./field-registry"
import { FIELD_IDS } from "./field-registry"
import { ScrollerFields } from "./scroller-fields"
import { SLIDER_MAIN, SLIDER_OTHER } from "./scroller-groups"
import type { KitSection } from "./slider-kit"
import { asKit, withSliderKit } from "./slider-kit"

/**
 * The sliding opening's open "Kaydırma" group (bilesen-denetimi (b) 4,
 * 1.3): the scroller kit's turning by itself and its speed, the arrows and
 * their shape, the dots; looping sits closed in "Diğer ayarlar"
 * (`SliderOther`). The cards in view, the arrows' place and dragging are
 * not offered: a slider shows one slide, its arrows either side. The
 * catalogue opening with two or more slides takes the same group (adr/0049
 * Ek 2026-11-15).
 */
export function SliderGroups({
  section,
  reveal,
  onChange,
}: {
  section: KitSection
  reveal: (group: FieldGroupName) => number | null
  onChange: (section: KitSection) => void
}) {
  const { t } = useTranslation()
  return (
    <PanelGroup title={t("storefront.editor.panel.scroll")} reveal={reveal("scroll")}>
      <ScrollerFields
        value={asKit(section)}
        settings={SLIDER_MAIN}
        fieldId={(setting) => FIELD_IDS.scroller(section.id, setting)}
        onChange={(next) => {
          onChange(withSliderKit(section, next))
        }}
      />
    </PanelGroup>
  )
}

/** The slider's closed kit settings, in "Diğer ayarlar". */
export function SliderOther({
  section,
  onChange,
}: {
  section: KitSection
  onChange: (section: KitSection) => void
}) {
  return (
    <ScrollerFields
      value={asKit(section)}
      settings={SLIDER_OTHER}
      fieldId={(setting) => FIELD_IDS.scroller(section.id, setting)}
      onChange={(next) => {
        onChange(withSliderKit(section, next))
      }}
    />
  )
}
