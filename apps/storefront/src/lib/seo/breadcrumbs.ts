import type { JsonLd } from "@qticaret/types"

/**
 * A page the storefront makes itself (`/magaza`, `/blog`, `/yorumlar`) as a
 * BreadcrumbList (docs/13 §3), the backend's blocks being for the pages it
 * resolves. None without the canonical host: the items must be absolute.
 */
export function breadcrumbJsonLd(
  host: string | null,
  trail: readonly { name: string; path: string }[]
): JsonLd[] {
  if (!host) {
    return []
  }
  return [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: trail.map((step, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: step.name,
        item: `https://${host}${step.path}`,
      })),
    },
  ]
}
