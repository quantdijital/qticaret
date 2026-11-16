import { useTranslation } from "react-i18next"
import {
  BANNER_DEFAULTS,
  MARQUEE_DEFAULTS,
  SCROLLER_DEFAULTS,
  scrollerSettingsOf,
} from "@qticaret/types"
import type { AnySection, LayoutGroup } from "@/features/storefront/api/layout"
import { PanelGroup } from "../panel-header"
import { PANEL_GROUPS } from "../panel-groups"
import { BANNER_FRAME_SETTINGS } from "./banner-groups"
import { BannerSettings } from "./banner-settings"
import { cardsSetCount } from "./card-field-ids"
import { CategoryCardsOther } from "./category-cards-fields"
import { FIELD_IDS, MARQUEE_OTHER_SETTINGS, takesLook } from "./field-registry"
import { LookFields } from "./look-fields"
import { lookFieldsIn, lookSetIn } from "./field-registry"
import { MarqueeSettings } from "./marquee-settings"
import { ScrollerFields } from "./scroller-fields"
import { SCROLLER_OTHER } from "./scroller-groups"
import { SliderOther } from "./slider-groups"
import { sliderOtherCount, turnsAsSlider } from "./slider-kit"

interface GroupProps {
  section: AnySection
  group: LayoutGroup
  reveal: number | null
  onChange: (section: AnySection, field?: string) => void
}

/**
 * "Görünüm" under "Stil" (adr/0065 Ek, sekmeler): a body section's ground,
 * alignment and width, the band's own width and buttons, the linked
 * category cards' frame; its title marks how many are set. None: no group.
 */
export function FrameGroup({ section, group, reveal, onChange }: GroupProps) {
  const { t } = useTranslation()
  const looked = takesLook(section, group) ? section : null
  const band = section.type === "banner" ? section : null
  const cards = section.type === "categories" && section.variant === "linked" ? section : null
  const fields = looked ? lookFieldsIn(looked.type, "frame").length : 0
  if (fields === 0 && !band && !cards) {
    return null
  }
  const marked =
    (looked ? lookSetIn(looked, "frame") : 0) +
    (band
      ? BANNER_FRAME_SETTINGS.filter((name) => band[name] !== BANNER_DEFAULTS[name]).length
      : 0) +
    cardsSetCount(section)
  return (
    <PanelGroup
      name="frame"
      title={t(PANEL_GROUPS.frame.title)}
      marked={marked}
      hint={fields > 0 ? t("storefront.editor.look.hint") : undefined}
      reveal={reveal}
    >
      {band ? (
        <BannerSettings section={band} settings={BANNER_FRAME_SETTINGS} onChange={onChange} />
      ) : null}
      {cards ? <CategoryCardsOther section={cards} onChange={onChange} /> : null}
      {looked && fields > 0 ? (
        <LookFields section={looked} group="frame" onChange={onChange} />
      ) : null}
    </PanelGroup>
  )
}

/**
 * "Diğer ayarlar" under "Gelişmiş": the rarely changed fine settings, a
 * strip's close button, a carousel's dots, turning by itself, looping and
 * dragging, a slider's looping; its title marks how many are set.
 */
export function OtherGroup({ section, reveal, onChange }: Omit<GroupProps, "group">) {
  const { t } = useTranslation()
  const strip = section.type === "marquee" ? section : null
  const rail = section.type === "products" || section.type === "related_products" ? section : null
  const scroller = rail?.variant === "carousel" ? scrollerSettingsOf(rail.scroller) : null
  const slider = turnsAsSlider(section) ? section : null
  if (!strip && !scroller && !slider) {
    return null
  }
  const marked =
    (slider ? sliderOtherCount(slider) : 0) +
    (scroller
      ? SCROLLER_OTHER.filter((name) => scroller[name] !== SCROLLER_DEFAULTS[name]).length
      : 0) +
    (strip
      ? MARQUEE_OTHER_SETTINGS.filter((name) => strip[name] !== MARQUEE_DEFAULTS[name]).length
      : 0)
  return (
    <PanelGroup name="look" title={t(PANEL_GROUPS.look.title)} marked={marked} reveal={reveal}>
      {strip ? (
        <MarqueeSettings section={strip} settings={MARQUEE_OTHER_SETTINGS} onChange={onChange} />
      ) : null}
      {rail && scroller ? (
        <ScrollerFields
          value={scroller}
          settings={SCROLLER_OTHER}
          fieldId={(setting) => FIELD_IDS.scroller(rail.id, setting)}
          onChange={(next) => {
            onChange({ ...rail, scroller: next })
          }}
        />
      ) : null}
      {slider ? <SliderOther section={slider} onChange={onChange} /> : null}
    </PanelGroup>
  )
}
