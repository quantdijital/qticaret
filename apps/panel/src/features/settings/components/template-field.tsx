import { useRef } from "react"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Input } from "@qticaret/admin-ui/ui/input"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { renderSample } from "../seo-sample"

interface TemplateFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  tokens: readonly string[]
  /** Search engines show about this many characters. */
  limit: number
  storeName: string
  error?: string | undefined
}

/**
 * A title or description template: tokens added at the cursor from chips,
 * a filled-in preview with its length against what search results show.
 */
export function TemplateField({
  id,
  label,
  value,
  onChange,
  tokens,
  limit,
  storeName,
  error,
}: TemplateFieldProps) {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)
  const samples = t("settings.seo.samples", { returnObjects: true }) as Record<string, string>
  const preview = renderSample(value, storeName, samples)
  const insert = (token: string) => {
    const element = input.current
    const at = element?.selectionStart ?? value.length
    const end = element?.selectionEnd ?? at
    onChange(`${value.slice(0, at)}{${token}}${value.slice(end)}`)
    requestAnimationFrame(() => {
      element?.focus()
      const caret = at + token.length + 2
      element?.setSelectionRange(caret, caret)
    })
  }
  return (
    <Field label={label} htmlFor={id} error={error}>
      <Input
        ref={input}
        id={id}
        value={value}
        placeholder={tokens
          .slice(0, 2)
          .map((token) => `{${token}}`)
          .join(" | ")}
        spellCheck={false}
        className="font-mono text-[13px]"
        onChange={(event) => {
          onChange(event.target.value)
        }}
      />
      <div className="flex flex-wrap gap-1.5">
        {tokens.map((token) => (
          <button
            key={token}
            type="button"
            onClick={() => {
              insert(token)
            }}
            className="rounded-md border bg-muted/50 px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:border-input hover:text-foreground"
          >
            {`{${token}}`}
          </button>
        ))}
      </div>
      <div className="flex items-start justify-between gap-3 rounded-md bg-muted/50 px-3 py-2">
        <p className="min-w-0 text-[13px]">
          <span className="text-muted-foreground">{t("settings.seo.preview")} </span>
          {preview || "—"}
        </p>
        <span
          className={cn(
            "shrink-0 text-xs tabular-nums",
            preview.length > limit ? "text-warning-text" : "text-muted-foreground"
          )}
        >
          {preview.length}/{limit}
        </span>
      </div>
    </Field>
  )
}
