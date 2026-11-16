import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { SHELF_STRIPS_DEFAULTS, SHELF_STRIPS_SETTINGS, shelfStripsOf } from "@qticaret/types"
import type { ShelfStripsSettings } from "@qticaret/types"
import type { ProductsSection } from "@/features/storefront/api/layout"
import { SwitchRow } from "../theme-fields"
import { LineSketch, SlantSketch } from "./featured-sketches"
import { FIELD_IDS } from "./field-registry"
import {
  SHELF_STRIPS_LABELS,
  SHELF_STRIPS_STEPS,
  SHELF_STRIPS_SWITCHES,
  stripsStepKey,
} from "./shelf-registry"
import { StepChoice } from "./step-choice"

/** The look's steps drawn in small (`featured-sketches.tsx`); the height has none. */
const SKETCHES: Partial<Record<string, (step: string) => ReactNode>> = {
  strips_slant: (step) => <SlantSketch step={step as "soft"} />,
  strips_line: (step) => <LineSketch step={step as "none"} />,
}

/**
 * A strips rail's own look under its count in "Diziliş" (adr/0049 Ek
 * 2026-11-16): the strips' height, the seams' slant and line as steps
 * (each with its reset, the look's drawn in small), the overlap and the
 * darkening as switches; shown only while the rail is strips. The look
 * keeps the strip gallery's words, so the shop meets one set of names.
 */
export function ShelfStripsFields({
  section,
  onChange,
}: {
  section: ProductsSection
  onChange: (section: ProductsSection) => void
}) {
  const { t } = useTranslation()
  const settings = shelfStripsOf(section)
  const set = (next: Partial<ShelfStripsSettings>) => {
    onChange({ ...section, ...next })
  }
  return (
    <div className="flex flex-col gap-4 border-t pt-4">
      {SHELF_STRIPS_STEPS.map((name) => (
        <StepChoice<string>
          key={name}
          id={FIELD_IDS.shelf(section.id, name)}
          label={t(`${SHELF_STRIPS_LABELS[name]}.label`)}
          term={t(`${SHELF_STRIPS_LABELS[name]}.term`)}
          hint={t(`${SHELF_STRIPS_LABELS[name]}.hint`)}
          steps={SHELF_STRIPS_SETTINGS[name]}
          value={settings[name]}
          fallback={SHELF_STRIPS_DEFAULTS[name]}
          nameOf={(step) => t(stripsStepKey(name, step))}
          drawOf={SKETCHES[name]}
          onChange={(step) => {
            set({ [name]: step })
          }}
        />
      ))}
      {SHELF_STRIPS_SWITCHES.map((name) => (
        <SwitchRow
          key={name}
          id={FIELD_IDS.shelf(section.id, name)}
          label={t(`${SHELF_STRIPS_LABELS[name]}.label`)}
          term={t(`${SHELF_STRIPS_LABELS[name]}.term`)}
          hint={t(`${SHELF_STRIPS_LABELS[name]}.hint`)}
          checked={settings[name] === "on"}
          onChange={(on) => {
            set({ [name]: on ? "on" : "off" })
          }}
        />
      ))}
    </div>
  )
}
