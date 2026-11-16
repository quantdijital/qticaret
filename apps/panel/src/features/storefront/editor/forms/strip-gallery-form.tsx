import { useTranslation } from "react-i18next"
import { STRIP_GALLERY_LIMITS } from "@qticaret/types"
import type { StripGallerySection } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import { F, TextField } from "./fields"
import { useProblemText } from "./problem-text"
import type { SectionFormProps } from "./form-props"
import { StripItemsField } from "./strip-items-field"

const G = "storefront.editor.stripGallery"

/**
 * The strip gallery's content (adr/0049 Ek 2026-11-16): an optional
 * heading and line over the strips, then the two to eight strips. How
 * they stand (width, height, words, slant, line, overlap, darkening) is
 * in the open "Diziliş" group below (`StripGalleryGroups`).
 */
export function StripGalleryForm({
  section,
  problems,
  onChange,
}: SectionFormProps<StripGallerySection>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const set = (next: Partial<StripGallerySection>, field?: string) => {
    onChange({ ...section, ...next }, field)
  }
  return (
    <div className="flex flex-col gap-5">
      <TextField
        id={`${section.id}-title`}
        label={t(`${F}.title`)}
        value={section.title}
        max={L.title}
        hint={t(`${F}.titleOptional`)}
        error={problem(problems["title"], L.title)}
        onChange={(title) => {
          set({ title }, "title")
        }}
      />
      <TextField
        id={`${section.id}-text`}
        label={t(`${F}.text`)}
        value={section.text}
        max={STRIP_GALLERY_LIMITS.text}
        tokens
        multiline
        hint={t(`${G}.textHint`)}
        error={problem(problems["text"], STRIP_GALLERY_LIMITS.text)}
        onChange={(text) => {
          set({ text }, "text")
        }}
      />
      <StripItemsField section={section} problems={problems} onChange={onChange} />
    </div>
  )
}
