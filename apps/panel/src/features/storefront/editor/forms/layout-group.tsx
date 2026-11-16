import { useTranslation } from "react-i18next"
import type { AnySection } from "@/features/storefront/api/layout"
import { PanelGroup } from "../panel-header"
import { BANNER_LAYOUT_SETTINGS } from "./banner-groups"
import { BannerSettings } from "./banner-settings"
import { FeaturedGroups } from "./featured-groups"
import type { FieldGroupName } from "./field-registry"
import { RelatedGroups } from "./related-groups"

/**
 * The open "Diziliş" group under a section's content, for the sections
 * whose basics are how they stand (docs/tema/bilesen-standardi §1): the
 * picture band's height, words' place and veil (denetim 1.4); the related
 * products' as a rail's (`RelatedGroups`, denetim 1.15); the featured
 * product's photographs layout (`FeaturedGroups`). A product rail
 * draws its own (`ShelfGroups`); any other section has none.
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
  if (section.type === "related_products") {
    return <RelatedGroups section={section} reveal={reveal} onChange={onChange} />
  }
  if (section.type === "featured_product") {
    return <FeaturedGroups section={section} reveal={reveal} onChange={onChange} />
  }
  if (section.type !== "banner") {
    return null
  }
  return (
    <PanelGroup name="layout" title={t("storefront.editor.panel.layout")} reveal={reveal("layout")}>
      <BannerSettings section={section} settings={BANNER_LAYOUT_SETTINGS} onChange={onChange} />
    </PanelGroup>
  )
}
