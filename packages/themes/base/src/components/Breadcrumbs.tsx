import { Fragment } from "react"
import type { BreadcrumbView, Translate } from "@qticaret/ui"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@qticaret/ui/components/breadcrumb"

/** The trail above a page; its structured data comes from the backend, not from here. */
export function Breadcrumbs({ items, t }: { items: BreadcrumbView[]; t: Translate }) {
  if (items.length === 0) {
    return null
  }
  return (
    <Breadcrumb aria-label={t("nav.breadcrumbs")}>
      <BreadcrumbList>
        {items.map((item, index) => (
          <Fragment key={`${String(index)}:${item.label}`}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {item.path ? (
                <BreadcrumbLink href={item.path}>{item.label}</BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
