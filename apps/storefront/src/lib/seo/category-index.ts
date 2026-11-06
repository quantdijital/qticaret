import type { JsonLd } from "@qticaret/types"
import type { CategoryTreeView } from "@qticaret/ui"

/**
 * `/kategoriler` as a `CollectionPage` whose `ItemList` is every category
 * the page shows, in its order: each top category, then the ones right
 * below it (docs/13 §5, the listing pages' pair). None without the
 * canonical host: the URLs must be absolute.
 */
export function categoryIndexJsonLd(
  host: string | null,
  page: { name: string; path: string },
  categories: readonly CategoryTreeView[]
): JsonLd[] {
  if (!host) {
    return []
  }
  const listed = categories.flatMap((top) => [top, ...top.children])
  if (listed.length === 0) {
    return []
  }
  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: page.name,
      url: `https://${host}${page.path}`,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: listed.length,
        itemListElement: listed.map((category, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: category.label,
          url: `https://${host}${category.path}`,
        })),
      },
    },
  ]
}
