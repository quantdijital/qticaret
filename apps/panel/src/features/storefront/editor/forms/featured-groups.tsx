import { useTranslation } from "react-i18next"
import {
  FEATURED_PRODUCT_DEFAULTS,
  FEATURED_PRODUCT_SETTINGS,
  featuredProductSettingsOf,
} from "@qticaret/types"
import type { FeaturedProductStep } from "@qticaret/types"
import type { FeaturedProductSection } from "@/features/storefront/api/layout"
import { PanelGroup } from "../panel-header"
import { FIELD_IDS } from "./field-registry"
import type { FieldGroupName } from "./field-registry"
import { StepChoice } from "./step-choice"

const P = "storefront.editor.featured"

/** The photographs' layouts drawn in small, in the current colour: the collage, the slanted strips. */
function GallerySketch({ step }: { step: FeaturedProductStep<"gallery"> }) {
  return (
    <svg viewBox="0 0 24 16" className="h-4 w-6" aria-hidden="true">
      {step === "collage" ? (
        <>
          <rect x={1} y={1} width={15} height={14} rx={1.5} className="fill-current opacity-60" />
          <rect
            x={17.5}
            y={1}
            width={5.5}
            height={6.5}
            rx={1}
            className="fill-current opacity-30"
          />
          <rect
            x={17.5}
            y={8.5}
            width={5.5}
            height={6.5}
            rx={1}
            className="fill-current opacity-30"
          />
        </>
      ) : (
        <>
          <polygon points="1,1 9,1 7,15 1,15" className="fill-current opacity-60" />
          <polygon points="10.5,1 16.5,1 14.5,15 8.5,15" className="fill-current opacity-30" />
          <polygon points="18,1 23,1 23,15 16,15" className="fill-current opacity-30" />
        </>
      )}
    </svg>
  )
}

/**
 * The featured product's open "Diziliş" group (docs/tema/bilesen-standardi
 * §1): how its photographs stand, a basic the shop changes in its first
 * minutes, so open under the content. "Kolaj", the drawing from before the
 * setting, is the default (adr/0049 Ek 2026-11-15).
 */
export function FeaturedGroups({
  section,
  reveal,
  onChange,
}: {
  section: FeaturedProductSection
  reveal: (group: FieldGroupName) => number | null
  onChange: (section: FeaturedProductSection) => void
}) {
  const { t } = useTranslation()
  const { gallery } = featuredProductSettingsOf(section)
  return (
    <PanelGroup name="layout" title={t("storefront.editor.panel.layout")} reveal={reveal("layout")}>
      <StepChoice
        id={FIELD_IDS.content(section.id, "gallery")}
        label={t(`${P}.gallery`)}
        term={t(`${P}.galleryTerm`)}
        hint={t(`${P}.galleryHint.${gallery}`)}
        steps={FEATURED_PRODUCT_SETTINGS.gallery}
        value={gallery}
        fallback={FEATURED_PRODUCT_DEFAULTS.gallery}
        nameOf={(step) => t(`${P}.galleries.${step}`)}
        drawOf={(step) => <GallerySketch step={step} />}
        onChange={(next) => {
          onChange({ ...section, gallery: next })
        }}
      />
    </PanelGroup>
  )
}
