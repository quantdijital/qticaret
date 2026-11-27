import { useTranslation } from "react-i18next"
import {
  STATS_DEFAULTS,
  STATS_SETTINGS,
  STEPS_DEFAULTS,
  STEPS_SETTINGS,
  statsSettingsOf,
  stepsSettingsOf,
} from "@qticaret/types"
import type { StatsSection, StepsSection } from "@/features/storefront/api/layout"
import { PanelGroup } from "../panel-header"
import { SwitchRow } from "../theme-fields"
import { STEPS_FIELDS } from "./content-registry"
import { FIELD_IDS } from "./field-registry"
import type { FieldGroupName } from "./field-registry"
import { StepChoice } from "./step-choice"

/**
 * The open "Diziliş" group (docs/tema/bilesen-standardi §1) of the figures
 * strip and the numbered steps (adr/0077 §10): the strip's hairlines as a
 * switch; the steps' standing (side by side, one under another) and their
 * numbers ("01", "1") as steps. Each with its reset and in the settings
 * search; the ground and alignment are the look's ("Görünüm").
 */
export function PointsGroups({
  section,
  reveal,
  onChange,
}: {
  section: StatsSection | StepsSection
  reveal: (group: FieldGroupName) => number | null
  onChange: (section: StatsSection | StepsSection) => void
}) {
  const { t } = useTranslation()
  return (
    <PanelGroup name="layout" title={t("storefront.editor.panel.layout")} reveal={reveal("layout")}>
      {section.type === "stats" ? (
        <>
          {/* A large figure, or a feature: an icon on a disc over a bold label and a line */}
          <StepChoice<string>
            id={FIELD_IDS.content(section.id, "stats_style")}
            label={t("storefront.editor.stats.item_style.label")}
            term={t("storefront.editor.stats.item_style.term")}
            hint={t("storefront.editor.stats.item_style.hint")}
            steps={STATS_SETTINGS.item_style}
            value={statsSettingsOf(section).item_style}
            fallback={STATS_DEFAULTS.item_style}
            nameOf={(step) => t(`storefront.editor.stats.item_style.${step}`)}
            onChange={(step) => {
              onChange({ ...section, item_style: step as StatsSection["item_style"] })
            }}
          />
          <SwitchRow
            id={FIELD_IDS.content(section.id, "dividers")}
            label={t("storefront.editor.stats.dividers.label")}
            term={t("storefront.editor.stats.dividers.term")}
            hint={t("storefront.editor.stats.dividers.hint")}
            checked={statsSettingsOf(section).dividers === "on"}
            onChange={(on) => {
              onChange({ ...section, dividers: on ? "on" : "off" })
            }}
          />
          {/* Each figure's icon over its value (adr/0077 §10 Ek); picked in the content */}
          <SwitchRow
            id={FIELD_IDS.content(section.id, "show_icons")}
            label={t("storefront.editor.stats.icons.label")}
            term={t("storefront.editor.stats.icons.term")}
            hint={t("storefront.editor.stats.icons.hint")}
            checked={statsSettingsOf(section).icons === "on"}
            onChange={(on) => {
              onChange({ ...section, icons: on ? "on" : "off" })
            }}
          />
          {/* One tight row, the icon at the left; the shop's profiles at its end */}
          <StepChoice<string>
            id={FIELD_IDS.content(section.id, "stats_arrangement")}
            label={t("storefront.editor.stats.arrangement.label")}
            term={t("storefront.editor.stats.arrangement.term")}
            hint={t("storefront.editor.stats.arrangement.hint")}
            steps={STATS_SETTINGS.arrangement}
            value={statsSettingsOf(section).arrangement}
            fallback={STATS_DEFAULTS.arrangement}
            nameOf={(step) => t(`storefront.editor.stats.arrangement.${step}`)}
            onChange={(step) => {
              onChange({ ...section, arrangement: step as StatsSection["arrangement"] })
            }}
          />
          {statsSettingsOf(section).arrangement === "row" && (
            <SwitchRow
              id={FIELD_IDS.content(section.id, "stats_social")}
              label={t("storefront.editor.stats.social.label")}
              term={t("storefront.editor.stats.social.term")}
              hint={t("storefront.editor.stats.social.hint")}
              checked={statsSettingsOf(section).social === "on"}
              onChange={(on) => {
                onChange({ ...section, social: on ? "on" : "off" })
              }}
            />
          )}
        </>
      ) : (
        STEPS_FIELDS.map(([name, field]) => (
          <StepChoice<string>
            key={name}
            id={FIELD_IDS.content(section.id, field)}
            label={t(`storefront.editor.steps.${name}.label`)}
            term={t(`storefront.editor.steps.${name}.term`)}
            hint={t(`storefront.editor.steps.${name}.hint`)}
            steps={STEPS_SETTINGS[name]}
            value={stepsSettingsOf(section)[name]}
            fallback={STEPS_DEFAULTS[name]}
            nameOf={(step) => t(`storefront.editor.steps.${name}.${step}`)}
            onChange={(step) => {
              onChange({ ...section, [name]: step })
            }}
          />
        ))
      )}
    </PanelGroup>
  )
}
