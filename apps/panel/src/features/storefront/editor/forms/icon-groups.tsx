import { useTranslation } from "react-i18next"
import {
  CATEGORY_ICONS_DEFAULTS,
  CATEGORY_ICONS_SETTINGS,
  categoryIconsSettingsOf,
  trustCardSettingsOf,
} from "@qticaret/types"
import type { CategoriesSection, TrustBadgesSection } from "@/features/storefront/api/layout"
import type { CategoriesIconsFields } from "@/features/storefront/api/layout-cards"
import { PanelGroup } from "../panel-header"
import { SwitchRow } from "../theme-fields"
import { FIELD_IDS } from "./field-registry"
import type { FieldGroupName } from "./field-registry"
import { StepChoice } from "./step-choice"

const E = "storefront.editor"

type IconRow = CategoriesSection & CategoriesIconsFields
type Card = TrustBadgesSection & { variant: "card" }

/** The trust card (adr/0077 §10 Ek) or the categories' icon row: the sections this group serves. */
export type IconGroupSection = Card | IconRow

/**
 * The open "Diziliş" group (docs/tema/bilesen-standardi §1) of the icon
 * variants (adr/0077 §10 Ek): the trust card's lift over the section before
 * it as a switch; the icon row's disc ground and phone row as steps, each
 * with its sketch-free names, its reset and in the settings search.
 */
export function IconGroups({
  section,
  reveal,
  onChange,
}: {
  section: IconGroupSection
  reveal: (group: FieldGroupName) => number | null
  onChange: (section: IconGroupSection) => void
}) {
  const { t } = useTranslation()
  return (
    <PanelGroup name="layout" title={t(`${E}.panel.layout`)} reveal={reveal("layout")}>
      {section.type === "trust_badges" ? (
        <SwitchRow
          id={FIELD_IDS.content(section.id, "lift")}
          label={t(`${E}.trustCard.lift.label`)}
          term={t(`${E}.trustCard.lift.term`)}
          hint={t(`${E}.trustCard.lift.hint`)}
          checked={trustCardSettingsOf(section).lift === "on"}
          onChange={(on) => {
            onChange({ ...section, lift: on ? "on" : "off" })
          }}
        />
      ) : (
        (
          [
            ["disc", "disc"],
            ["phone", "icons_phone"],
          ] as const
        ).map(([name, field]) => (
          <StepChoice<string>
            key={name}
            id={FIELD_IDS.content(section.id, field)}
            label={t(`${E}.categoryIcons.${name}.label`)}
            term={t(`${E}.categoryIcons.${name}.term`)}
            hint={t(`${E}.categoryIcons.${name}.hint`)}
            steps={CATEGORY_ICONS_SETTINGS[name]}
            value={categoryIconsSettingsOf(section)[name]}
            fallback={CATEGORY_ICONS_DEFAULTS[name]}
            nameOf={(step) => t(`${E}.categoryIcons.${name}.${step}`)}
            onChange={(step) => {
              onChange({ ...section, [name]: step })
            }}
          />
        ))
      )}
    </PanelGroup>
  )
}
