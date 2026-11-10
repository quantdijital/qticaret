import { useTranslation } from "react-i18next"
import { Label } from "@qticaret/admin-ui/ui/label"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import type { StaffRole } from "@/features/auth/api"

/** A role to give, each with one sentence on what it may do (adr/0061 §3.5). */
export function RolePicker<R extends StaffRole>({
  id,
  roles,
  value,
  onChange,
}: {
  id: string
  roles: readonly R[]
  value: R
  onChange: (role: R) => void
}) {
  const { t } = useTranslation()
  return (
    <RadioGroup
      aria-labelledby={`${id}-label`}
      value={value}
      onValueChange={(next) => {
        const role = roles.find((each) => each === next)
        if (role) {
          onChange(role)
        }
      }}
      className="flex flex-col gap-3"
    >
      {roles.map((role) => (
        <div key={role} className="flex items-start gap-3">
          <RadioGroupItem id={`${id}-${role}`} value={role} className="mt-0.5" />
          <Label
            htmlFor={`${id}-${role}`}
            className="flex flex-col items-start gap-0.5 font-normal"
          >
            <span className="text-sm font-medium">{t(`roles.${role}`)}</span>
            <span className="text-[13px] leading-5 text-muted-foreground">
              {t(`roleText.${role}`)}
            </span>
          </Label>
        </div>
      ))}
    </RadioGroup>
  )
}
