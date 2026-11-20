import { useTranslation } from "react-i18next"
import type { RichTextSection } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import { F, TextField } from "./fields"
import { DocField } from "./doc-field"
import { useProblemText } from "./problem-text"
import type { SectionFormProps } from "./form-props"
import { PageTextSwitches } from "./page-text-fields"
import { PREVIEW_IDS } from "./preview-fields"
import { RichTextPicture } from "./rich-text-picture"

const T = "storefront.editor.richText"

/**
 * A title and a text written in the content editor (adr/0019), which may
 * hold product and category cards and the shop's details. The editor
 * opens wide in a dialog: the side panel is too narrow for its toolbar.
 * "Görselli metin" (adr/0073 §3) adds its picture and side under the
 * title; "Sayfa metni" (Ek 2026-11-19 (2) K2) its outline and questions
 * under the text.
 */
export function RichTextForm({ section, problems, onChange }: SectionFormProps<RichTextSection>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  return (
    <div className="flex flex-col gap-5">
      <TextField
        id={`${section.id}-title`}
        label={t(`${F}.title`)}
        value={section.title}
        max={L.title}
        hint={t(`${F}.titleOptional`)}
        error={problem(problems["title"], L.title)}
        onChange={(next) => {
          onChange({ ...section, title: next }, "title")
        }}
      />
      {section.variant === "with_image" ? (
        <RichTextPicture section={section} problems={problems} onChange={onChange} />
      ) : null}
      <DocField
        id={PREVIEW_IDS.text(section.id, "body")}
        label={t(`${T}.body`)}
        body={section.body}
        onChange={(body) => {
          onChange({ ...section, body }, "body")
        }}
      />
      {section.variant === "article" ? (
        <PageTextSwitches section={section} onChange={onChange} />
      ) : null}
    </div>
  )
}
