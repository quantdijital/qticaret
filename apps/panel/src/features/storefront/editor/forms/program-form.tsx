import { useTranslation } from "react-i18next"
import type { ProgramSection } from "@/features/storefront/api/layout"
import type { SectionFormProps } from "./form-props"
import { TitleField } from "./simple-forms"

/**
 * A dated product's program under its own block (adr/0078): the section
 * has only its title (and its variant, "Biçim"); the steps are each
 * product's, written in the product's "Program" card. A product without
 * steps does not show the section.
 */
export function ProgramForm({ section, problems, onChange }: SectionFormProps<ProgramSection>) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-5">
      <TitleField
        id={section.id}
        title={section.title}
        placeholder={t("storefront.editor.defaults.program")}
        problem={problems["title"]}
        onChange={(title) => {
          onChange({ ...section, title }, "title")
        }}
      />
      <p className="text-sm text-muted-foreground">{t("storefront.editor.program.note")}</p>
    </div>
  )
}
