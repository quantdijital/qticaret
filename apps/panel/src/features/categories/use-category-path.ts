import { useQuery } from "@tanstack/react-query"
import { seoSettingsQuery } from "@/features/settings/api/seo"
import type { CategoryUrlStyle } from "@/features/settings/api/url-style"

/**
 * A category's storefront path (docs/13 §2.2) from its handles, root
 * first: the prefixed and nested styles carry the tree (`/kategori/a/b`,
 * `/a/b`, adr/0017 Ek 2026-11-23), the flat one its own handle (`/b`).
 */
export function categoryPathOf(handles: readonly string[], style: CategoryUrlStyle): string {
  const tree = handles.join("/")
  switch (style) {
    case "flat":
      return `/${handles.at(-1) ?? ""}`
    case "nested":
      return `/${tree}`
    case "prefixed":
      return `/kategori/${tree}`
  }
}

/** The shop's category path maker, in its URL style (prefixed until the settings load). */
export function useCategoryPath(): (handles: readonly string[]) => string {
  const { data } = useQuery(seoSettingsQuery())
  const style = data?.values.url_style.category ?? "prefixed"
  return (handles) => categoryPathOf(handles, style)
}
