import { useTranslation } from "react-i18next"
import { programPlaceOf } from "@qticaret/types"
import type { ProgramSection } from "@/features/storefront/api/layout"
import { SwitchRow } from "../theme-fields"
import type { SectionFormProps } from "./form-props"
import { TitleField } from "./simple-forms"

/**
 * A dated product's program under its own block (adr/0078): the section
 * has only its title (and its variant, "Biçim"); the steps are each
 * product's, written in the product's "Program" card. A product without
 * steps does not show the section. "Açıklama sekmelerinde göster" puts it
 * as the last tab beside the description (`place: tab`); off, the default,
 * it stays its own section, the field left out as before the setting.
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
      <SwitchRow
        id={`${section.id}-in-tabs`}
        label={t("storefront.editor.program.inTabs")}
        hint={t("storefront.editor.program.inTabsHint")}
        checked={programPlaceOf(section.place) === "tab"}
        onChange={(on) => {
          const next: ProgramSection = { ...section, place: "tab" }
          if (!on) {
            delete next.place
          }
          onChange(next)
        }}
      />
      <p className="text-sm text-muted-foreground">{t("storefront.editor.program.note")}</p>
    </div>
  )
}
