import type { BreadcrumbView } from "@qticaret/ui"

/**
 * The trail above a page, small and quiet: each step a link, the page
 * itself last and plain. Its structured data comes from the backend.
 */
export function Trail({ items, label }: { items: readonly BreadcrumbView[]; label: string }) {
  if (items.length === 0) {
    return null
  }
  return (
    <nav aria-label={label}>
      <ol className="flex flex-wrap items-center gap-x-2 text-sm text-text-3">
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
