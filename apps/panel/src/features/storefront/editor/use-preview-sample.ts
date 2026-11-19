import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { QueryClient } from "@tanstack/react-query"
import { categoryTreeQuery } from "@/features/categories/api/categories"
import { ancestorHandles } from "@/features/categories/tree"
import { seoSettingsQuery } from "@/features/settings/api/seo"
import type { BodyGroup } from "@/features/storefront/api/layout"
import { sdk } from "@/lib/sdk"

/** A live product or category whose page the preview shows the draft on. */
export interface PreviewSample {
  id: string
  name: string
  /** Its path on the storefront (docs/13 §2.2), as the shop's URL style makes it. */
  path: string
}

export type SamplePage = Exclude<BodyGroup, "home">

const RESULTS = 20
const KEEP_MS = 60_000

const folded = (text: string) => text.toLocaleLowerCase("tr")

async function samplesOf(
  client: QueryClient,
  page: SamplePage,
  q: string
): Promise<PreviewSample[]> {
  const seo = await client.query(seoSettingsQuery()).catch(() => null)
  if (page === "product") {
    const prefix = seo?.values.url_style.product === "flat" ? "/" : "/urun/"
    // Only a published product has a page to show; the newest change first
    const { products } = await sdk.admin.product.list({
      fields: "id,title,handle",
      limit: RESULTS,
      status: ["published"],
      order: "-updated_at",
      ...(q ? { q } : {}),
    })
    return products.map((product) => ({
      id: product.id,
      name: product.title,
      path: `${prefix}${product.handle}`,
    }))
  }
  const prefix = seo?.values.url_style.category === "flat" ? "/" : "/kategori/"
  const tree = await client.query({ ...categoryTreeQuery(), staleTime: KEEP_MS })
  const wanted = folded(q.trim())
  return tree
    .filter((category) => category.is_active && !category.is_internal)
    .filter((category) => folded(category.name).includes(wanted))
    .slice(0, RESULTS)
    .map((category) => ({
      id: category.id,
      name: category.name,
      path: `${prefix}${[
        ...ancestorHandles(tree, category.parent_category_id ?? null),
        category.handle,
      ].join("/")}`,
    }))
}

/**
 * The live products or categories the preview may show the draft on,
 * found by name; with nothing typed, the first is the preview's sample
 * until another is picked.
 */
export function usePreviewSamples(page: BodyGroup | "content", q = "", enabled = true) {
  const client = useQueryClient()
  return useQuery({
    queryKey: ["storefront-layout", "samples", page, q],
    queryFn: () => samplesOf(client, page as SamplePage, q),
    // A content page is its own sample (`use-content-pages.ts`)
    enabled: enabled && page !== "home" && page !== "content",
    staleTime: KEEP_MS,
  })
}
