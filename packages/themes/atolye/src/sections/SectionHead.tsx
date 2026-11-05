import type { LinkView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * A section's head: its h2 on the left, the link to the whole list on
 * the right on one baseline (a destination, never a label above the
 * head). `children` sits under the head (a tab row).
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
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <h2 id={id}>{title}</h2>
      {more && (
        <a href={more.path} className="gf-link shrink-0 text-sm lg:text-md">
          {more.label}
        </a>
      )}
    </div>
  )
}
