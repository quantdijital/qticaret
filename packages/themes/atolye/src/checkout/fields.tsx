import { ChevronDown, CircleAlert } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"
import { cn } from "@qticaret/ui/lib/utils"

/** A field's message under it: the refusal in the error's colour, its icon beside it. */
export function FieldError({ id, message }: { id: string; message: string | null }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-sm font-semibold text-error empty:hidden">
      {message && (
        <>
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
          {message}
        </>
      )}
    </p>
  )
}

/** The ids a field's description points to: its error, then its hint. */
const describedBy = (id: string, hint: boolean) =>
  [`${id}-hata`, hint ? `${id}-ipucu` : null].filter(Boolean).join(" ")

/**
 * A labelled 48 px pill field: the label above, the hint under it, the
 * refusal under that in words (`aria-invalid` and the description say it
 * to a reader too).
 */
export function TextField({
  label,
  hint,
  error = null,
  className,
  id,
  ...props
}: ComponentProps<"input"> & {
  id: string
  label: string
  hint?: string | undefined
  error?: string | null
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, Boolean(hint))}
        className="gf-field"
        {...props}
      />
      {hint && (
        <p id={`${id}-ipucu`} className="text-xs text-text-3">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-hata`} message={error} />
    </div>
  )
}

/** A labelled native select in the same pill: each phone's own picker, nothing to load. */
export function SelectField({
  label,
  error = null,
  className,
  id,
  children,
  ...props
}: ComponentProps<"select"> & {
  id: string
  label: string
  error?: string | null
  children: ReactNode
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-hata`}
          className="gf-field appearance-none truncate pr-12"
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          strokeWidth={2}
          className="pointer-events-none absolute top-1/2 right-5 size-4.5 -translate-y-1/2 text-text-2"
        />
      </div>
      <FieldError id={`${id}-hata`} message={error} />
    </div>
  )
}

/** A checkbox with its sentence: the whole row is its label, 44 px or more. */
export function CheckField({
  children,
  className,
  ...props
}: ComponentProps<"input"> & { children: ReactNode }) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm leading-relaxed",
        className
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 cursor-pointer accent-(--color-signal)"
        {...props}
      />
      <span>{children}</span>
    </label>
  )
}

/**
 * A choice among options as a filled 64 px row (a carrier, a way to pay):
 * its own drawn radio, the option's words, what it costs on the right.
 * The chosen row takes an ink outline, the radio the shop's colour.
 */
export function ChoiceRow({
  children,
  aside,
  ...props
}: ComponentProps<"input"> & { children: ReactNode; aside?: ReactNode }) {
  return (
    <label className="flex min-h-16 cursor-pointer items-center gap-4 rounded-media bg-field px-4 py-3 outline-offset-0 transition-[outline-color] duration-(--dur-micro) has-[:checked]:outline-2 has-[:checked]:outline-text has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus">
      <input
        type="radio"
        className="size-5 shrink-0 cursor-pointer appearance-none rounded-pill border-2 border-edge bg-field checked:border-signal checked:bg-signal checked:shadow-[inset_0_0_0_3px_var(--color-field)] focus-visible:outline-none"
        {...props}
      />
      <span className="flex min-w-0 flex-1 items-center gap-3">{children}</span>
      {aside}
    </label>
  )
}
