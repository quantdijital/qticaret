import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface SectionCardProps {
  title: string
  /** One sentence under the title; none when the title says it all. */
  description?: string
  /** Right of the title: a link, a toggle. */
  action?: ReactNode
  /** Body without padding, for tables and lists that run edge to edge. */
  flush?: boolean
  className?: string | undefined
  children: ReactNode
}

/** A titled surface on a page (docs/18 §7): the panel's main building block. */
export function SectionCard({
  title,
  description,
  action,
  flush = false,
  className,
  children,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-lg border bg-card text-card-foreground shadow-card",
        className
      )}
    >
      {/* The action goes under the title when the two do not fit side by side (a phone) */}
      <header className="flex min-h-14 flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 pt-4 pb-3">
        <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-0.5">
          <h2 className="text-[15px] leading-6 font-semibold">{title}</h2>
          {description ? (
            <p className="text-[13px] leading-5 text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </header>
      <div className={cn("flex min-w-0 flex-1 flex-col", flush ? "" : "px-5 pb-5")}>{children}</div>
    </section>
  )
}
