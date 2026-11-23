import { useTranslation } from "react-i18next"
import type { AnySection } from "@/features/storefront/api/layout"
import { PanelGroup } from "../panel-header"
import { BANNER_LAYOUT_SETTINGS, bannerSettingsFor } from "./banner-groups"
import { BannerSettings } from "./banner-settings"
import { BannerEdgeField } from "./banner-split-fields"
import { FeaturedGroups } from "./featured-groups"
import { IconGroups } from "./icon-groups"
import type { FieldGroupName } from "./field-registry"
import { RelatedGroups } from "./related-groups"
import { PointsGroups } from "./points-groups"
import { CollageGroups, ReviewsGroups } from "./collage-groups"
import { StripGalleryGroups } from "./strip-gallery-groups"

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
  if (section.type === "strip_gallery") {
    return <StripGalleryGroups section={section} reveal={reveal} onChange={onChange} />
  }
  if (section.type === "photo_collage") {
    return <CollageGroups section={section} reveal={reveal} onChange={onChange} />
  }
  if (section.type === "reviews") {
    return <ReviewsGroups section={section} reveal={reveal} onChange={onChange} />
  }
  if (section.type === "stats" || section.type === "steps") {
    return <PointsGroups section={section} reveal={reveal} onChange={onChange} />
  }
  // The trust card's lift, the icon row's disc and phone row (adr/0077 §10 Ek)
  if (
    (section.type === "trust_badges" && section.variant === "card") ||
    (section.type === "categories" && section.variant === "icons")
  ) {
    return <IconGroups section={section} reveal={reveal} onChange={onChange} />
  }
  if (section.type !== "banner") {
    return null
  }
  return (
    <PanelGroup name="layout" title={t("storefront.editor.panel.layout")} reveal={reveal("layout")}>
      <div className="flex flex-col gap-5">
        <BannerSettings
          section={section}
          settings={bannerSettingsFor(section.variant, BANNER_LAYOUT_SETTINGS)}
          onChange={onChange}
        />
        {/* The split's edge (adr/0077 Ek), beside its height */}
        {section.variant === "split" ? (
          <BannerEdgeField section={section} onChange={onChange} />
        ) : null}
      </div>
    </PanelGroup>
  )
}
