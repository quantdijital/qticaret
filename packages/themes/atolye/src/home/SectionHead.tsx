import type { LinkView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * A section's head block (layout.md § 4): the shop's title as an h2 at
 * the section size, flush left, and the link to see more at its end on
 * the same baseline, a verb and no arrow.
 */
export function SectionHead({
  id,
  title,
  more,
  className,
}: {
  id: string
  title: string
  more?: LinkView | null
  className?: string
}) {
  return (
    <div
      className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-2", className)}
      data-section-head=""
    >
      <h2 id={id}>{title}</h2>
      {more && (
        <a href={more.path} className="at-link shrink-0">
          {more.label}
        </a>
      )}
    </div>
  )
}
