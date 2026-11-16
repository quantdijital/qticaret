import { useTranslation } from "react-i18next"
import { SHELF_PHONE_DEFAULT, scrollerSettingsOf, shelfPhoneColumnsOf } from "@qticaret/types"
import type { RelatedProductsSection } from "@/features/storefront/api/layout"
import { PanelGroup } from "../panel-header"
import { CardVariantField } from "./card-variant-field"
import { ColumnsField } from "./columns-field"
import { FIELD_IDS } from "./field-registry"
import type { FieldGroupName } from "./field-registry"
import { PhoneColumnsField } from "./phone-columns-field"
import { ScrollerFields } from "./scroller-fields"
import { SCROLLER_MAIN } from "./scroller-groups"

/**
 * The related products' open groups (denetim 1.15, (b) 3, (b) 7), as a
 * product rail's: "Diziliş" with a grid's cards in a row (wide, phone) and
 * the rail's card style; a carousel's "Kaydırma" with the scroller kit's
 * basics (the rest sit with the look, closed). The variant is chosen above
 * them, in "Biçim".
 */
export function RelatedGroups({
  section,
  reveal,
  onChange,
}: {
  section: RelatedProductsSection
  reveal: (group: FieldGroupName) => number | null
  onChange: (section: RelatedProductsSection) => void
}) {
  const { t } = useTranslation()
  const id = section.id
  return (
    <>
      <PanelGroup
        name="layout"
        title={t("storefront.editor.panel.layout")}
        reveal={reveal("layout")}
      >
        <div className="flex flex-col gap-5">
          {section.variant === "carousel" ? null : (
            <>
              <div id={FIELD_IDS.content(id, "columns")}>
                <ColumnsField
                  id={`${id}-columns`}
                  value={section.columns ?? 3}
                  limit={section.limit}
                  onChange={(columns) => {
                    onChange({ ...section, columns })
                  }}
                />
              </div>
              <PhoneColumnsField
                id={FIELD_IDS.content(id, "columns_mobile")}
                value={shelfPhoneColumnsOf(section.columns_mobile)}
                fallback={SHELF_PHONE_DEFAULT}
                onChange={(columns_mobile) => {
                  onChange({ ...section, columns_mobile })
                }}
              />
            </>
          )}
          <CardVariantField
            id={FIELD_IDS.content(id, "card_variant")}
            value={section.card_variant ?? null}
            onChange={(card_variant) => {
              onChange({ ...section, card_variant })
            }}
          />
        </div>
      </PanelGroup>
      {section.variant === "carousel" ? (
        <PanelGroup
          name="scroll"
          title={t("storefront.editor.panel.scroll")}
          reveal={reveal("scroll")}
        >
          <ScrollerFields
            value={scrollerSettingsOf(section.scroller)}
            settings={SCROLLER_MAIN}
            fieldId={(setting) => FIELD_IDS.scroller(id, setting)}
            onChange={(scroller) => {
              onChange({ ...section, scroller })
            }}
          />
        </PanelGroup>
      ) : null}
    </>
  )
}
