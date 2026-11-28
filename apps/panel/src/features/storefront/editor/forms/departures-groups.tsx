import { useTranslation } from "react-i18next"
import { DEPARTURES_DEFAULTS, DEPARTURES_SETTINGS, departuresSettingsOf } from "@qticaret/types"
import type { DeparturesSection } from "@/features/storefront/api/layout"
import { PanelGroup } from "../panel-header"
import { FIELD_IDS } from "./field-registry"
import type { FieldGroupName } from "./field-registry"
import { StepChoice } from "./step-choice"

const D = "storefront.editor.departures.layout"
const P = "storefront.editor.departures.phone"

/**
 * The open "Diziliş" group (docs/tema/bilesen-standardi §1) of upcoming
 * departures (adr/0077 §10): a list (date box, name, places, price) or
 * cards with the tour's photograph (the cards on a phone stacked or
 * swiped), each with its reset and in the settings
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
  const settings = departuresSettingsOf(section)
  return (
    <PanelGroup name="layout" title={t("storefront.editor.panel.layout")} reveal={reveal("layout")}>
      <StepChoice<string>
        id={FIELD_IDS.content(section.id, "departures_layout")}
        label={t(`${D}.label`)}
        term={t(`${D}.term`)}
        hint={t(`${D}.hint`)}
        steps={DEPARTURES_SETTINGS.layout}
        value={settings.layout}
        fallback={DEPARTURES_DEFAULTS.layout}
        nameOf={(step) => t(`${D}.${step}`)}
        onChange={(step) => {
          onChange({ ...section, layout: step as DeparturesSection["layout"] })
        }}
      />
      {settings.layout === "cards" && (
        <StepChoice<string>
          id={FIELD_IDS.content(section.id, "departures_phone")}
          label={t(`${P}.label`)}
          term={t(`${P}.term`)}
          hint={t(`${P}.hint`)}
          steps={DEPARTURES_SETTINGS.phone}
          value={settings.phone}
          fallback={DEPARTURES_DEFAULTS.phone}
          nameOf={(step) => t(`${P}.${step}`)}
          onChange={(step) => {
            onChange({ ...section, phone: step as DeparturesSection["phone"] })
          }}
        />
      )}
    </PanelGroup>
  )
}
