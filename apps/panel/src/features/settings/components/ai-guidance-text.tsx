import { useId } from "react"
import { useTranslation } from "react-i18next"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { textLength } from "@/features/ai/api/guidance"
import { cn } from "@qticaret/admin-ui/lib/utils"

/**
 * A text of the writing guidance with its counter under it, as the server
 * counts (characters); over the limit the counter turns red and says so,
 * and the save waits (`overLimit`). One line or several (`rows`).
 */
export function GuidanceText({
  label,
  value,
  max,
  rows,
  placeholder,
  hint,
  disabled,
  onChange,
}: {
  label: string
  value: string
  max: number
  /** Several lines; left out: one line. */
  rows?: number
  placeholder?: string
  hint?: string
  disabled: boolean
  onChange: (next: string) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const hintId = `${id}-hint`
  const count = textLength(value)
  const over = count > max
  const common = {
    id,
    value,
    placeholder,
    disabled,
    "aria-invalid": over || undefined,
    "aria-describedby": hintId,
    onChange: (event: { target: { value: string } }) => {
      onChange(event.target.value)
    },
  }
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {rows ? <Textarea rows={rows} {...common} /> : <Input {...common} />}
      <div
        id={hintId}
        className="flex items-start justify-between gap-3 text-xs text-muted-foreground"
      >
        <span className={cn(over && "text-destructive-text")}>
          {over ? t("ai.guidance.tooLong", { max }) : (hint ?? "")}
        </span>
        <span className={cn("shrink-0 tabular-nums", over && "text-destructive-text")}>
          {t("ai.guidance.count", { count, max })}
        </span>
      </div>
    </div>
  )
}
