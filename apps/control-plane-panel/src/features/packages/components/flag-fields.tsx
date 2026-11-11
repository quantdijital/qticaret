import { useTranslation } from "react-i18next"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { Label } from "@qticaret/admin-ui/ui/label"
import type { PlatformFlag } from "@/features/packages/api"
import { flagName, flagText } from "@/features/packages/format"

/**
 * A package's platform flags (adr/0061 Ek C9), one row each: on or off,
 * the default named beside it. Which flags exist is the shared list's,
 * as the control plane serves it; with none, the section says so.
 */
export function FlagFields({
  flags,
  values,
  disabled,
  onChange,
}: {
  flags: readonly PlatformFlag[]
  values: Readonly<Record<string, boolean>>
  disabled: boolean
  onChange: (key: string, enabled: boolean) => void
}) {
  const { t } = useTranslation()
  if (flags.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("flags.none")}</p>
  }
  return (
    <div className="flex flex-col divide-y">
      {flags.map((flag) => (
        <div key={flag.key} className="flex items-center gap-3 py-3 first:pt-0">
          <Checkbox
            id={`flag-${flag.key}`}
            disabled={disabled}
            checked={values[flag.key] ?? flag.default}
            onCheckedChange={(checked) => {
              onChange(flag.key, checked === true)
            }}
          />
          <Label htmlFor={`flag-${flag.key}`} className="flex flex-col items-start gap-0.5">
            <span className="text-sm font-medium">{flagName(t, flag.key)}</span>
            <span className="text-[13px] font-normal text-muted-foreground">
              {t("flags.defaultIs", { value: flagText(t, flag.default) })}
            </span>
          </Label>
        </div>
      ))}
    </div>
  )
}
