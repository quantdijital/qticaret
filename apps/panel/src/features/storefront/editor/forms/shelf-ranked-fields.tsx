import { useTranslation } from "react-i18next"
import {
  SHELF_RANKED_LAYOUTS,
  SHELF_RANKED_LAYOUT_DEFAULT,
  shelfRankedLayoutOf,
} from "@qticaret/types"
import type { ShelfRankedLayout } from "@qticaret/types"
import type { ProductsSection } from "@/features/storefront/api/layout"
import { FIELD_IDS } from "./field-registry"
import { StepChoice } from "./step-choice"

const SH = "storefront.editor.shelf"

/** The ranked rail's layouts drawn in small (24 × 16, as `featured-sketches.tsx`'s). */
function LayoutSketch({ step }: { step: ShelfRankedLayout }) {
  return (
    <svg viewBox="0 0 24 16" className="h-4 w-6" aria-hidden="true">
      {step === "lead" ? (
        <>
          <rect x={1} y={9} width={2.5} height={6} rx={0.5} className="fill-current opacity-80" />
          <rect x={4} y={1} width={8} height={14} rx={1.5} className="fill-current opacity-45" />
          {[0, 1, 2].map((at) => (
            <g key={at}>
              <rect
                x={14}
                y={1.5 + at * 5}
                width={1.2}
                height={3}
                rx={0.4}
                className="fill-current opacity-80"
              />
              <rect
                x={16.5}
                y={1 + at * 5}
                width={6.5}
                height={4}
                rx={1}
                className="fill-current opacity-30"
              />
            </g>
          ))}
        </>
      ) : (
        [0, 1, 2, 3].map((at) => (
          <g key={at}>
            <rect
              x={1 + at * 5.75}
              y={7}
              width={1.5}
              height={5}
              rx={0.4}
              className="fill-current opacity-80"
            />
            <rect
              x={2.5 + at * 5.75}
              y={3}
              width={3.5}
              height={9}
              rx={0.75}
              className="fill-current opacity-40"
            />
          </g>
        ))
      )}
    </svg>
  )
}

/**
 * A ranked rail's layout under its count in "Diziliş" (adr/0049 Ek
 * 2026-11-16): the first large beside the rest, or all in one row, each
 * drawn in small, with its reset; and why no card choice stands here.
 */
export function ShelfRankedFields({
  section,
  onChange,
}: {
  section: ProductsSection
  onChange: (section: ProductsSection) => void
}) {
  const { t } = useTranslation()
  return (
    <StepChoice<ShelfRankedLayout>
      id={FIELD_IDS.shelf(section.id, "ranked_layout")}
      label={t(`${SH}.rankedLayout.label`)}
      term={t(`${SH}.rankedLayout.term`)}
      hint={t(`${SH}.rankedLayout.hint`)}
      steps={SHELF_RANKED_LAYOUTS}
      value={shelfRankedLayoutOf(section.ranked_layout)}
      fallback={SHELF_RANKED_LAYOUT_DEFAULT}
      nameOf={(step) => t(`${SH}.rankedLayout.${step}`)}
      drawOf={(step) => <LayoutSketch step={step} />}
      onChange={(ranked_layout) => {
        onChange({ ...section, ranked_layout })
      }}
    />
  )
}
