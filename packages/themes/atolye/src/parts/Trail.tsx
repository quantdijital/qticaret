import { ChevronLeft } from "lucide-react"
import type { BreadcrumbView } from "@qticaret/ui"

/**
 * The trail above a page, small and quiet: each step a link, the page
 * itself last and plain. `compact` (a product's long name): under 640 px
 * only the step above, as one 44 px link back. Its structured data comes
 * from the backend.
 */
export function Trail({
  items,
  label,
  compact = false,
}: {
  items: readonly BreadcrumbView[]
  label: string
  compact?: boolean
}) {
  if (items.length === 0) {
    return null
  }
  const parent = compact ? items.findLast((item) => item.path !== null) : undefined
  return (
    <nav aria-label={label}>
      {parent?.path && (
        <a
          href={parent.path}
          className="inline-flex min-h-11 items-center gap-1 text-sm text-text-2 sm:hidden"
        >
          <ChevronLeft className="size-4" aria-hidden="true" strokeWidth={2} />
          {parent.label}
        </a>
      )}
      <ol
        className={`flex-wrap items-center gap-x-2 text-sm text-text-3 ${parent ? "hidden sm:flex" : "flex"}`}
      >
        {items.map((item, index) => (
          <li key={`${String(index)}:${item.label}`} className="flex items-center gap-x-2">
            {index > 0 && <span aria-hidden="true">/</span>}
            {item.path ? (
              <a href={item.path} className="inline-flex min-h-11 items-center hover:text-text">
                {item.label}
              </a>
            ) : (
              <span aria-current="page" className="text-text-2">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
