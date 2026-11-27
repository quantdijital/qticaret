import type { TopSliderSection } from "@/features/storefront/api/layout"
import type { SectionFormProps } from "./form-props"
import { TopSlidesField } from "./top-slides-field"

/**
 * The top image slider's "İçerik" (owner 2026-11-27): its pictures in
 * order, each with its words for screen readers (required), a phone's own
 * crop and a link. How it looks and moves is the "Stil" tab's
 * (`TopSliderGroups`).
 */
export function TopSliderForm({ section, problems, onChange }: SectionFormProps<TopSliderSection>) {
  return (
    <TopSlidesField
      id={`${section.id}-top-slides`}
      slides={section.slides}
      problems={problems}
      onChange={(slides, field) => {
        onChange({ ...section, slides }, field)
      }}
    />
  )
}
