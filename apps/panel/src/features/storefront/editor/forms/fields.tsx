import { useId } from "react"
import type { ReactNode } from "react"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { HiddenHint, InfoTip } from "@qticaret/admin-ui/patterns/info-tip"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { ShopTokenPreview, TokenSlot } from "@/features/settings/components/shop-token-menu"
import { textOrNull } from "@/features/storefront/layout/sections"
import { cn } from "@qticaret/admin-ui/lib/utils"

export const F = "storefront.editor.fields"

// The storefront shows a text as one paragraph, and the server takes no line breaks
const oneLine = (value: string) => value.replace(/\s*[\r\n\t]+\s*/g, " ")

interface TextFieldProps {
  id: string
  label: string
  /** The technical term shown small beside the label. */
  term?: string | undefined
  /** None shows as an empty field: the storefront's own words. */
  value: string | null
  onChange: (value: string | null) => void
  max: number
  /** The shop's details (`{telefon}`) may stand in the text (adr/0048). */
  tokens?: boolean
  multiline?: boolean
  placeholder?: string | undefined
  hint?: string | undefined
  error?: string | undefined
  required?: boolean
}

/**
 * One of the shop's texts: within its limit, as one line, the shop's
 * details offered from the field's edge and shown filled in under it.
 */
export function TextField({
  id,
  label,
  term,
  value,
  onChange,
  max,
  tokens = false,
  multiline = false,
  placeholder,
  hint,
  error,
  required = false,
}: TextFieldProps) {
  const text = value ?? ""
  const set = (next: string) => {
    onChange(required ? next : textOrNull(next))
  }
  const shared = {
    id,
    value: text,
    maxLength: max,
    placeholder,
    "aria-invalid": Boolean(error),
    className: cn(tokens && "pr-9"),
  }
  const control = multiline ? (
    <Textarea
      {...shared}
      rows={3}
      onChange={(event) => {
        set(oneLine(event.target.value))
      }}
    />
  ) : (
    <Input
      {...shared}
      onChange={(event) => {
        set(event.target.value)
      }}
    />
  )
  return (
    <Field label={label} term={term} htmlFor={id} hint={hint} error={error} required={required}>
      {tokens ? (
        <TokenSlot fieldId={id} multiline={multiline} onInsert={set}>
          {control}
        </TokenSlot>
      ) : (
        control
      )}
      {tokens ? <ShopTokenPreview text={text} /> : null}
    </Field>
  )
}

/**
 * A whole number within bounds; a value out of them is pulled back in:
 * past the most at once, under the least (above 1) once the field is
 * left, so "30" can be typed on the way past "3" (`error` says why meanwhile).
 */
export function CountField({
  id,
  label,
  term,
  value,
  onChange,
  max,
  min = 1,
  hint,
  error,
}: {
  id: string
  label: string
  term?: string | undefined
  value: number
  onChange: (value: number) => void
  max: number
  min?: number
  hint?: string
  error?: string | undefined
}) {
  return (
    <Field label={label} term={term} htmlFor={id} hint={hint} error={error}>
      <NumberField
        plain
        id={id}
        min={min}
        max={max}
        step={1}
        value={value}
        className="w-40"
        aria-invalid={Boolean(error)}
        onChange={(event) => {
          const next = Math.trunc(Number(event.target.value))
          if (Number.isFinite(next) && event.target.value !== "") {
            // A count on its way past a higher least ("3" towards "30") stands until the blur;
            // a field whose least is 0 takes 0
            onChange(Math.max(Math.min(min, 1), Math.min(max, next)))
          }
        }}
        onBlur={() => {
          if (value < min) {
            onChange(min)
          }
        }}
      />
    </Field>
  )
}

/**
 * A titled list inside a panel group (a section's slides, strips, bands):
 * what it holds behind a small (i) beside its title (docs/18 §7.1).
 */
export function FieldGroup({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string | undefined
  children: ReactNode
}) {
  const hintId = `${useId()}-hint`
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-1.5">
        <h3 className="text-sm font-medium">{title}</h3>
        {hint ? (
          <>
            <InfoTip name={title} hint={hint} hintId={hintId} />
            <HiddenHint id={hintId}>{hint}</HiddenHint>
          </>
        ) : null}
      </div>
      {children}
    </div>
  )
}
