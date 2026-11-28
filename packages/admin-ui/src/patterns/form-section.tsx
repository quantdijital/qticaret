import { useId, useLayoutEffect, useRef } from "react"
import type { ReactNode, RefObject } from "react"
import { cn } from "../lib/utils"
import { useFieldHintStyle } from "../hooks/use-field-hints"
import { HiddenHint, InfoTip, TitleTip } from "./info-tip"

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
  // Under `FieldHints style="tip"` the sentence folds into an (i) beside the title
  const tip = useFieldHintStyle() === "tip" && Boolean(description)
  return (
    <section
      className={cn("grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:gap-8", className)}
    >
      <div className="flex flex-col gap-1">
        {tip ? (
          <div className="flex min-w-0 items-start gap-1.5">
            <h2 className="text-[15px] leading-6 font-semibold">{title}</h2>
            <TitleTip title={title} hint={description} />
          </div>
        ) : (
          <h2 className="text-[15px] font-semibold">{title}</h2>
        )}
        {description && !tip ? (
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
  label: string
  /** A technical term shown small beside the label ("margin"); outside it, so the name stays the label. */
  term?: string | undefined
  htmlFor?: string
  hint?: string | undefined
  /** An i18n'd error sentence; replaces the hint. */
  error?: string | undefined
  required?: boolean
  children: ReactNode
  className?: string
}

/** The controls a field's words describe when its label names none (`htmlFor`). */
const CONTROLS =
  '[role="radiogroup"], input:not([type="hidden"]), textarea, select, button[role="switch"], button[role="combobox"]'

/**
 * Ties the hidden help text to the field's control (`aria-describedby`),
 * beside whatever describes it already; after each draw, as the control
 * may set its own.
 */
function useDescribed(
  block: RefObject<HTMLDivElement | null>,
  htmlFor: string | undefined,
  hintId: string | null
) {
  useLayoutEffect(() => {
    const root = block.current
    if (!root || hintId === null) {
      return
    }
    const named = htmlFor ? root.ownerDocument.getElementById(htmlFor) : null
    const control =
      named && root.contains(named) ? named : root.querySelector<HTMLElement>(CONTROLS)
    if (!control) {
      return
    }
    const ids = (control.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean)
    if (!ids.includes(hintId)) {
      control.setAttribute("aria-describedby", [...ids, hintId].join(" "))
    }
    return () => {
      const left = (control.getAttribute("aria-describedby") ?? "")
        .split(/\s+/)
        .filter((id) => id !== "" && id !== hintId)
      if (left.length > 0) {
        control.setAttribute("aria-describedby", left.join(" "))
      } else {
        control.removeAttribute("aria-describedby")
      }
    }
  })
}

/**
 * One labelled field with its hint or error underneath. Under
 * `FieldHints style="tip"` (the theme editor) the hint folds into a small
 * (i) beside the name, its words kept hidden as the control's
 * description; an error always shows.
 */
export function Field({
  label,
  term,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: FieldProps) {
  const tip = useFieldHintStyle() === "tip" && Boolean(hint)
  const hintId = `${useId()}-hint`
  const block = useRef<HTMLDivElement>(null)
  useDescribed(block, htmlFor, tip ? hintId : null)
  const name = (
    <label htmlFor={htmlFor} className="text-sm font-medium">
      {label}
      {required ? <span className="ml-0.5 text-destructive-text">*</span> : null}
    </label>
  )
  if (tip) {
    return (
      <div ref={block} className={cn("flex flex-col gap-2", className)}>
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          {name}
          {term ? <small className="text-[11px] text-muted-foreground">{term}</small> : null}
          <InfoTip name={label} hint={hint} hintId={hintId} className="self-start" />
        </div>
        {children}
        <HiddenHint id={hintId}>{hint}</HiddenHint>
        {error ? (
          <p role="alert" className="text-xs text-destructive-text">
            {error}
          </p>
        ) : null}
      </div>
    )
  }
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {term ? (
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          {name}
          <small className="text-[11px] text-muted-foreground">{term}</small>
        </div>
      ) : (
        name
      )}
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
