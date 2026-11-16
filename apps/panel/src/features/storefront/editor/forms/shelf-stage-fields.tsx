import { useTranslation } from "react-i18next"
import { SHELF_STAGE_DEFAULTS, SHELF_STAGE_SETTINGS, shelfStageOf } from "@qticaret/types"
import type { ShelfStageSettings } from "@qticaret/types"
import type { ProductsSection } from "@/features/storefront/api/layout"
import { SwitchRow } from "../theme-fields"
import { FIELD_IDS } from "./field-registry"
import { SHELF_STAGE_STEPS, stageLabel, stageStepKey } from "./shelf-registry"
import { StepChoice } from "./step-choice"

/**
 * A stage list's own settings under its count in "Diziliş" (adr/0049 Ek
 * 2026-11-16): the stage's side and ground as steps (each with its reset),
 * whether it follows the list as a switch; shown only while the rail is
 * a stage list.
 */
export function ShelfStageFields({
  section,
  onChange,
}: {
  section: ProductsSection
  onChange: (section: ProductsSection) => void
}) {
  const { t } = useTranslation()
  const settings = shelfStageOf(section)
  const set = (next: Partial<ShelfStageSettings>) => {
    onChange({ ...section, ...next })
  }
  return (
    <div className="flex flex-col gap-4 border-t pt-4">
      {SHELF_STAGE_STEPS.map((name) => (
        <StepChoice<string>
          key={name}
          id={FIELD_IDS.shelf(section.id, name)}
          label={t(`${stageLabel(name)}.label`)}
          term={t(`${stageLabel(name)}.term`)}
          hint={t(`${stageLabel(name)}.hint`)}
          steps={SHELF_STAGE_SETTINGS[name]}
          value={settings[name]}
          fallback={SHELF_STAGE_DEFAULTS[name]}
          nameOf={(step) => t(stageStepKey(name, step))}
          onChange={(step) => {
            set({ [name]: step })
          }}
        />
      ))}
      <SwitchRow
        id={FIELD_IDS.shelf(section.id, "stage_follow")}
        label={t(`${stageLabel("stage_follow")}.label`)}
        term={t(`${stageLabel("stage_follow")}.term`)}
        hint={t(`${stageLabel("stage_follow")}.hint`)}
        checked={settings.stage_follow === "on"}
        onChange={(on) => {
          set({ stage_follow: on ? "on" : "off" })
        }}
      />
    </div>
  )
}
