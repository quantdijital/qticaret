import { useTranslation } from "react-i18next"
import { ADMIN_UI_NS } from "../i18n"
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group"

interface PeriodPickerProps<T extends string> {
  periods: readonly T[]
  /** Null while none of them is chosen (a report's own range of days). */
  value: T | null
  onChange: (value: T) => void
  /** A period's name ("7 gün"); the periods are the app's. */
  labelOf: (period: T) => string
}

/**
 * The date range every number below follows (dataviz: one filter row, presets
 * first). Control height as every page header control (docs/18 §2).
 */
export function PeriodPicker<T extends string>({
  periods,
  value,
  onChange,
  labelOf,
}: PeriodPickerProps<T>) {
  const { t } = useTranslation(ADMIN_UI_NS)
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={value ?? ""}
      aria-label={t("period.label")}
      onValueChange={(next) => {
        if (next) {
          onChange(next as T)
        }
      }}
      className="bg-card shadow-card"
    >
      {periods.map((period) => (
        <ToggleGroupItem
          key={period}
          value={period}
          className="px-3 text-[13px] data-[state=on]:bg-accent data-[state=on]:font-medium data-[state=on]:text-accent-foreground"
        >
          {labelOf(period)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
