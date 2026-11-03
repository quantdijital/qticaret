import type { ReactNode } from "react"
import { Field } from "@/components/patterns/form-section"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ShopTokenPreview, TokenSlot } from "@/features/settings/components/shop-token-menu"
import { textOrNull } from "@/features/storefront/layout/sections"
import { cn } from "@/lib/utils"

export const F = "storefront.editor.fields"

// The storefront shows a text as one paragraph, and the server takes no line breaks
const oneLine = (value: string) => value.replace(/\s*[\r\n\t]+\s*/g, " ")

interface TextFieldProps {
  id: string
  label: string
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
    <Field label={label} htmlFor={id} hint={hint} error={error} required={required}>
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

/** A whole number within bounds; a value out of them is pulled back in. */
export function CountField({
  id,
  label,
  value,
  onChange,
  max,
  hint,
}: {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
  max: number
  hint?: string
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        step={1}
        value={value}
        className="w-40"
        onChange={(event) => {
          const next = Math.trunc(Number(event.target.value))
          if (Number.isFinite(next) && event.target.value !== "") {
            onChange(Math.max(1, Math.min(max, next)))
          }
        }}
      />
    </Field>
  )
}

/** A titled group of fields in the side panel. */
export function FieldGroup({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string | undefined
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-medium">{title}</h3>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  )
}
