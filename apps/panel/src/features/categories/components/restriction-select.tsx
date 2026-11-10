import { useTranslation } from "react-i18next"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { RESTRICTIONS } from "@/features/categories/api/restrictions"
import type { Restriction } from "@/features/categories/api/restrictions"

// Radix Select has no empty value; this one stands for "no age limit"
const NONE = "__none__"

/** Whether, and why, something is sold to adults only (F13.4): a product's or a category's. */
export function RestrictionSelect({
  id,
  value,
  onChange,
}: {
  id: string
  value: Restriction | null
  onChange: (next: Restriction | null) => void
}) {
  const { t } = useTranslation()
  return (
    <Select
      value={value ?? NONE}
      onValueChange={(next) => {
        onChange(next === NONE ? null : (next as Restriction))
      }}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{t("restrictions.none")}</SelectItem>
        {RESTRICTIONS.map((restriction) => (
          <SelectItem key={restriction} value={restriction}>
            {t(`restrictions.options.${restriction}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
