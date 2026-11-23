import { useTranslation } from "react-i18next"
import {
  PHOTO_COLLAGE_DEFAULTS,
  PHOTO_COLLAGE_SETTINGS,
  photoCollageSettingsOf,
  scrollerSettingsOf,
} from "@qticaret/types"
import type { PhotoCollageSection, ReviewsSection } from "@/features/storefront/api/layout"
import { PanelGroup } from "../panel-header"
import { COLLAGE_FIELDS } from "./content-registry"
import { FIELD_IDS } from "./field-registry"
import type { FieldGroupName } from "./field-registry"
import { ScrollerFields } from "./scroller-fields"
import { SCROLLER_MAIN } from "./scroller-groups"
import { StepChoice } from "./step-choice"

type Reveal = (group: FieldGroupName) => number | null

/**
 * The photo collage's open "Diziliş" (docs/tema/bilesen-standardi §1,
 * adr/0077 §10): how the photographs stand from 1024 px (the first large,
 * or all even) and on a phone (swiped, or one under another), each with
 * its reset and in the settings search. Corners and gaps are the style
 * kit's; ground and alignment the look's ("Görünüm").
 */
export function CollageGroups({
  section,
  reveal,
  onChange,
}: {
  section: PhotoCollageSection
  reveal: Reveal
  onChange: (section: PhotoCollageSection) => void
}) {
  const { t } = useTranslation()
  const settings = photoCollageSettingsOf(section)
  return (
    <PanelGroup name="layout" title={t("storefront.editor.panel.layout")} reveal={reveal("layout")}>
      {COLLAGE_FIELDS.map(([name, field]) => (
        <StepChoice<string>
          key={name}
          id={FIELD_IDS.content(section.id, field)}
          label={t(`storefront.editor.photoCollage.${name}.label`)}
          term={t(`storefront.editor.photoCollage.${name}.term`)}
          hint={t(`storefront.editor.photoCollage.${name}.hint`)}
          steps={PHOTO_COLLAGE_SETTINGS[name]}
          value={settings[name]}
          fallback={PHOTO_COLLAGE_DEFAULTS[name]}
          nameOf={(step) => t(`storefront.editor.photoCollage.${name}.${step}`)}
          onChange={(step) => {
            onChange({ ...section, [name]: step })
          }}
        />
      ))}
    </PanelGroup>
  )
}

/**
 * The reviews' carousel's open "Kaydırma" (adr/0077 §10), as a product
 * rail's: the cards in view and the arrows; the kit's rarer settings sit in
 * "Diğer ayarlar". The grid has none (it is today's drawing).
 */
export function ReviewsGroups({
  section,
  reveal,
  onChange,
}: {
  section: ReviewsSection
  reveal: Reveal
  onChange: (section: ReviewsSection) => void
}) {
  const { t } = useTranslation()
  if (section.variant !== "carousel") {
    return null
  }
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
