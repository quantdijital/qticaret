import { Check } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * One checkout step: its number and title; open, it shows its form; done,
 * a summary and a link to change it; ahead, only its title.
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
  return (
    <section
      aria-labelledby={`adim-${String(number)}`}
      className={cn(
        "rounded-3xl border bg-card p-5 sm:p-7",
        state === "ahead" && "bg-card/50 text-muted-foreground"
      )}
    >
      <header className="flex items-center gap-3.5">
        <span
          aria-hidden="true"
          className={cn(
            "tabular flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            state === "done"
              ? "bg-success/12 text-success"
              : state === "open"
                ? "bg-foreground text-background"
                : "border"
          )}
        >
          {state === "done" ? <Check className="size-4" /> : number}
        </span>
        <h2 id={`adim-${String(number)}`} className="flex-1 text-xl sm:text-2xl">
          {title}
        </h2>
        {state === "done" && (
          <a
            href={editPath}
            className="text-sm font-medium underline underline-offset-4 hover:text-primary"
          >
            {editLabel}
          </a>
        )}
      </header>
      {state === "done" && summary && (
        <div className="mt-4 pl-[2.875rem] text-sm text-muted-foreground">{summary}</div>
      )}
      {state === "open" && <div className="mt-6">{children}</div>}
    </section>
  )
}
