import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import type { ShopDraft } from "./draft"

/** What every step gets: the draft, a change to it, and its problems once Next was tried. */
export interface StepProps {
  draft: ShopDraft
  change: (next: (draft: ShopDraft) => ShopDraft) => void
  /** Field path → text key; empty until the person tried to go on. */
  problems: Record<string, string>
}

/**
 * A labelled text field of the wizard: its problem under it in words (an
 * inline error, never an alert), else its help; both read with the field.
 */
export function TextField({
  id,
  label,
  value,
  onChange,
  problem,
  help,
  type = "text",
  inputMode,
  autoComplete = "off",
  maxLength,
  suffix,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  /** A text key. */
  problem?: string | undefined
  help?: ReactNode | undefined
  type?: "text" | "email" | "tel"
  inputMode?: "numeric" | "email" | "tel" | undefined
  autoComplete?: string
  maxLength?: number
  /** Right of the field, in its row (a domain's ending). */
  suffix?: ReactNode
}) {
  const { t } = useTranslation()
  const describedBy = problem || help ? `${id}-note` : undefined
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex min-w-0 items-center gap-2">
        <Input
          id={id}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          spellCheck={false}
          maxLength={maxLength}
          aria-invalid={problem ? true : undefined}
          aria-describedby={describedBy}
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
          }}
        />
        {suffix}
      </div>
      {problem ? (
        <p id={describedBy} className="text-[13px] leading-5 text-destructive-text">
          {t(problem)}
        </p>
      ) : help ? (
        <p id={describedBy} className="text-[13px] leading-5 text-muted-foreground">
          {help}
        </p>
      ) : null}
    </div>
  )
}
