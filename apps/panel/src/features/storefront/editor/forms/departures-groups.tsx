import { useTranslation } from "react-i18next"
import { DEPARTURES_DEFAULTS, DEPARTURES_SETTINGS, departuresSettingsOf } from "@qticaret/types"
import type { DeparturesSection } from "@/features/storefront/api/layout"
import { PanelGroup } from "../panel-header"
import { FIELD_IDS } from "./field-registry"
import type { FieldGroupName } from "./field-registry"
import { StepChoice } from "./step-choice"

const D = "storefront.editor.departures.layout"

/**
 * The open "Diziliş" group (docs/tema/bilesen-standardi §1) of upcoming
 * departures (adr/0077 §10): a list (date box, name, places, price) or
 * cards with the tour's photograph, with its reset and in the settings
 * search; the ground and alignment are the look's ("Görünüm").
 */
export function DeparturesGroups({
  section,
  reveal,
  onChange,
}: {
  section: DeparturesSection
  reveal: (group: FieldGroupName) => number | null
  onChange: (section: DeparturesSection) => void
}) {
  const { t } = useTranslation()
  return (
    <PanelGroup name="layout" title={t("storefront.editor.panel.layout")} reveal={reveal("layout")}>
      <StepChoice<string>
        id={FIELD_IDS.content(section.id, "departures_layout")}
        label={t(`${D}.label`)}
        term={t(`${D}.term`)}
        hint={t(`${D}.hint`)}
        steps={DEPARTURES_SETTINGS.layout}
        value={departuresSettingsOf(section).layout}
        fallback={DEPARTURES_DEFAULTS.layout}
        nameOf={(step) => t(`${D}.${step}`)}
        onChange={(step) => {
          onChange({ ...section, layout: step as DeparturesSection["layout"] })
        }}
      />
    </PanelGroup>
  )
}
