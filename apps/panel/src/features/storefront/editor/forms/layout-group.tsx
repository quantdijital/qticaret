import { useTranslation } from "react-i18next"
import { SHELF_PHONE_DEFAULT, shelfPhoneColumnsOf } from "@qticaret/types"
import type { AnySection } from "@/features/storefront/api/layout"
import { PanelGroup } from "../panel-header"
import { BANNER_LAYOUT_SETTINGS } from "./banner-groups"
import { BannerSettings } from "./banner-settings"
import { ColumnsField } from "./columns-field"
import { FIELD_IDS } from "./field-registry"
import type { FieldGroupName } from "./field-registry"
import { PhoneColumnsField } from "./phone-columns-field"

/**
 * The open "Diziliş" group under a section's content, for the sections
 * whose basics are how they stand (docs/tema/bilesen-standardi §1): the
 * picture band's height, words' place and veil (denetim 1.4), the related
 * products' cards in a row and on a phone (denetim 1.15, (b) 3, as a grid rail's). A product
 * rail draws its own (`ShelfGroups`); any other section has none.
 */
export function SectionLayoutGroup({
  section,
  reveal,
  onChange,
}: {
  section: AnySection
  reveal: (group: FieldGroupName) => number | null
  onChange: (section: AnySection) => void
}) {
  const { t } = useTranslation()
  if (section.type !== "banner" && section.type !== "related_products") {
    return null
  }
  return (
    <PanelGroup title={t("storefront.editor.panel.layout")} reveal={reveal("layout")}>
      {section.type === "banner" ? (
        <BannerSettings section={section} settings={BANNER_LAYOUT_SETTINGS} onChange={onChange} />
      ) : (
        <div className="flex flex-col gap-5">
          <div id={FIELD_IDS.content(section.id, "columns")}>
            <ColumnsField
              id={`${section.id}-columns`}
              value={section.columns}
              limit={section.limit}
              onChange={(columns) => {
                onChange({ ...section, columns })
              }}
            />
          </div>
          <PhoneColumnsField
            id={FIELD_IDS.content(section.id, "columns_mobile")}
            value={shelfPhoneColumnsOf(section.columns_mobile)}
            fallback={SHELF_PHONE_DEFAULT}
            onChange={(columns_mobile) => {
              onChange({ ...section, columns_mobile })
            }}
          />
        </div>
      )}
    </PanelGroup>
  )
}
