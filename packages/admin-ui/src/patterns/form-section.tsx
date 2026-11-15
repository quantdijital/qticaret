import type { ReactNode } from "react"
import { cn } from "../lib/utils"

interface FormSectionProps {
  title: string
  description?: string
  children: ReactNode
  className?: string
}

/**
 * A group of fields (docs/18 §7 FormSection): what it is about on the left
 * on wide screens, the fields on a card on the right; stacked on phones.
 */
export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <section
      className={cn("grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:gap-8", className)}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {description ? (
          <p className="text-[13px] leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-5 rounded-lg border bg-card p-5 shadow-card">
        {children}
      </div>
    </section>
  )
}

interface FieldProps {
  /** Its name; a small technical term may follow it (`<small>`). */
  label: ReactNode
  htmlFor?: string
  hint?: string | undefined
  /** An i18n'd error sentence; replaces the hint. */
  error?: string | undefined
  required?: boolean
  children: ReactNode
  className?: string
}

/** One labelled field with its hint or error underneath. */
export function Field({ label, htmlFor, hint, error, required, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required ? <span className="ml-0.5 text-destructive-text">*</span> : null}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-destructive-text">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}
