import type { BreadcrumbView, Translate } from "@qticaret/ui"

/** The trail above a page; its structured data comes from the backend, not from here. */
export function Breadcrumbs({ items, t }: { items: BreadcrumbView[]; t: Translate }) {
  if (items.length === 0) {
    return null
  }
  return (
    <nav aria-label={t("nav.breadcrumbs")} className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => (
          <li key={`${item.label}-${String(index)}`} className="flex items-center gap-1">
            {index > 0 && <span aria-hidden="true">/</span>}
            {item.path ? (
              <a href={item.path} className="hover:text-foreground">
                {item.label}
              </a>
            ) : (
              <span aria-current="page" className="text-foreground">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
