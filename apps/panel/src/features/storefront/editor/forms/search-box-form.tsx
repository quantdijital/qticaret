import { useTranslation } from "react-i18next"
import { SEARCH_BOX_LIMITS } from "@qticaret/types"
import type { SearchBoxSection } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import { F, TextField } from "./fields"
import type { SectionFormProps } from "./form-props"
import { PREVIEW_IDS } from "./preview-fields"
import { useProblemText } from "./problem-text"

const S = "storefront.editor.searchBox"

/**
 * The search box section's content (adr/0077 §1): an optional title (none,
 * no heading) and a short intro. The box's fields are the shop's one
 * search form, chosen in the theme panel's "Arama kutusu"; the type's
 * description says so.
 */
export function SearchBoxForm({ section, problems, onChange }: SectionFormProps<SearchBoxSection>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  return (
    <div className="flex flex-col gap-5">
      <TextField
        id={`${section.id}-title`}
        label={t(`${F}.title`)}
        term={t(`${F}.titleTerm`)}
        value={section.title}
        max={L.title}
        hint={t(`${S}.titleHint`)}
        error={problem(problems["title"], L.title)}
        onChange={(title) => {
          onChange({ ...section, title }, "title")
        }}
      />
      <TextField
        id={PREVIEW_IDS.text(section.id, "intro")}
        label={t(`${S}.intro`)}
        value={section.intro}
        max={SEARCH_BOX_LIMITS.intro}
        tokens
        multiline
        error={problem(problems["intro"], SEARCH_BOX_LIMITS.intro)}
        onChange={(intro) => {
          onChange({ ...section, intro }, "intro")
        }}
      />
    </div>
  )
}
