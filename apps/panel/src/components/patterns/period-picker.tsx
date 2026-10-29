import { useTranslation } from "react-i18next"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

interface PeriodPickerProps<T extends string> {
  periods: readonly T[]
  /** Null while none of them is chosen (a report's own range of days). */
  value: T | null
  onChange: (value: T) => void
}

/**
 * The date range every number below follows (dataviz: one filter row, presets
 * first). Control height as every page header control (docs/18 §2).
 */
export function PeriodPicker<T extends string>({ periods, value, onChange }: PeriodPickerProps<T>) {
  const { t } = useTranslation()
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
          {t(`period.${period}`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
