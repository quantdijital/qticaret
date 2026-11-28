import { useTranslation } from "react-i18next"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import { PROGRAM_UNITS } from "@/features/products/api/program"
import type { ProgramUnit } from "@/features/products/api/program"

const P = "products.program"

/**
 * What the steps are called (a day or a step), as a small segmented choice
 * on the card's title line: "Gün" and "Adım" shown, each read out with its
 * numbering ("Gün (1. Gün, 2. Gün)").
 */
export function ProgramUnitChoice({
  value,
  onChange,
}: {
  value: ProgramUnit
  onChange: (next: ProgramUnit) => void
}) {
  const { t } = useTranslation()
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      aria-label={t(`${P}.unit`)}
      value={value}
      onValueChange={(next) => {
        // A segmented choice is never left empty: pressing the chosen one keeps it
        const unit = PROGRAM_UNITS.find((each) => each === next)
        if (unit) {
          onChange(unit)
        }
      }}
    >
      {PROGRAM_UNITS.map((option) => (
        <ToggleGroupItem
          key={option}
          value={option}
          aria-label={t(`${P}.units.${option}`)}
          title={t(`${P}.units.${option}`)}
          className="px-2.5 text-xs"
        >
          {t(`${P}.unitsShort.${option}`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
