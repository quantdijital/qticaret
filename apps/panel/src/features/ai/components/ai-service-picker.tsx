import { useTranslation } from "react-i18next"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"

export interface AiServicePickerProps {
  /** The services the backend says can do the task (`usable`). */
  services: readonly string[]
  value: string
  onChange: (service: string) => void
  disabled?: boolean
}

/**
 * Which service writes the suggestion (adr/0071 §4, §13): drawn only when
 * several can; with one there is nothing to pick. Picking asks again with
 * that service, and the backend remembers it for the next time.
 */
export function AiServicePicker({ services, value, onChange, disabled }: AiServicePickerProps) {
  const { t } = useTranslation()
  if (services.length < 2) {
    return null
  }
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={value}
      disabled={disabled ?? false}
      aria-label={t("ai.suggest.service")}
      onValueChange={(next) => {
        if (next && next !== value) {
          onChange(next)
        }
      }}
      className="w-full"
    >
      {services.map((id) => (
        <ToggleGroupItem key={id} value={id} className="flex-1">
          {t(`ai.services.${id}.name`, { defaultValue: id })}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
