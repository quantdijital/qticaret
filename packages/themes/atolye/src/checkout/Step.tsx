import { Check } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@qticaret/ui/lib/utils"
import { OpenStep } from "./OpenStep"

/**
 * One checkout step as a tinted well: its number in a round chip and its
 * title; open, its form; done, what was given and "Değiştir"; ahead, only
 * its title, quieter. The chip turns to a tick once the step is done.
 */
export function Step({
  number,
  title,
  state,
  editPath,
  editLabel,
  summary,
  children,
}: {
  number: number
  title: string
  state: "open" | "done" | "ahead"
  editPath: string
  editLabel: string
  summary?: ReactNode
  children?: ReactNode
}) {
  const id = `adim-${String(number)}`
  return (
    <section
      aria-labelledby={id}
      aria-current={state === "open" ? "step" : undefined}
      className={cn("rounded-tile bg-paper-2 p-5 sm:p-7", state === "ahead" && "text-text-2")}
    >
      <div className="flex min-h-11 items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "tabular flex size-8 shrink-0 items-center justify-center rounded-pill text-sm font-extrabold",
            state === "done" && "bg-ok text-paper",
            state === "open" && "bg-text text-paper",
            state === "ahead" && "bg-paper-3 text-text-2"
          )}
        >
          {state === "done" ? (
            <Check className="size-4" aria-hidden="true" strokeWidth={3} />
          ) : (
            number
          )}
        </span>
        <h2 id={id} className="max-w-none flex-1 text-title">
          {title}
        </h2>
        {state === "done" && (
          <a href={editPath} aria-label={`${editLabel}: ${title}`} className="gf-link text-sm">
            {editLabel}
          </a>
        )}
      </div>
      {state === "done" && summary && (
        <div className="mt-3 pl-11 text-sm text-text-2">{summary}</div>
      )}
      {state === "open" && (
        <div className="mt-6">
          <OpenStep first={number === 1} />
          {children}
        </div>
      )}
    </section>
  )
}
