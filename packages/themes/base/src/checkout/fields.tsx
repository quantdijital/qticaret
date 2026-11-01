import { ChevronDown } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"
import { cn } from "@qticaret/ui/lib/utils"

const CONTROL =
  "h-12 w-full rounded-xl border border-input bg-background px-3.5 text-[15px] outline-none transition-colors placeholder:text-muted-foreground hover:border-foreground/30 focus-visible:border-foreground focus-visible:ring-0 disabled:opacity-60"

/** A labelled input; the label above it, a hint under it when there is one. */
export function TextField({
  label,
  hint,
  className,
  id,
  ...props
}: ComponentProps<"input"> & { id: string; label: string; hint?: string | undefined }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input id={id} className={CONTROL} {...props} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** A labelled native select: every phone's own picker, nothing to load. */
export function SelectField({
  label,
  className,
  id,
  children,
  ...props
}: ComponentProps<"select"> & { id: string; label: string; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <select id={id} className={cn(CONTROL, "appearance-none pr-10")} {...props}>
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
    </div>
  )
}
