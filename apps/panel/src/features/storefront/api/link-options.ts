import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { QueryClient } from "@tanstack/react-query"
import { brandOptions } from "@/features/brands/api/brands"
import { categoryTreeQuery } from "@/features/categories/api/categories"
import type { Category } from "@/features/categories/api/categories"
import { contentListQuery } from "@/features/content/api/content"
import { landingsQuery } from "@/features/content/api/landings"
import { collectionsQuery } from "@/features/promotions/api/scope-options"
import type { RecordKind } from "@/features/storefront/api/menus"
import { sdk } from "@/lib/sdk"

/** A record a menu link may point at, as the link picker lists it. */
export interface LinkOption {
  id: string
  name: string
  /** A second line: where it sits in the tree, or its address. */
  detail: string | null
  path: string | null
  /** Shown on the storefront now; a link to one that is not stays hidden until it is. */
  live: boolean
}

const RESULTS = 20
// The whole tree and every collection are read once and searched here
const LOCAL_RESULTS = 50
const KEEP_MS = 60_000

const folded = (text: string) => text.toLocaleLowerCase("tr")

function matches<T>(rows: readonly T[], q: string, text: (row: T) => string): T[] {
  const wanted = folded(q.trim())
  return rows.filter((row) => folded(text(row)).includes(wanted)).slice(0, LOCAL_RESULTS)
}

/** Categories by name, each with its parents' names as its place in the tree. */
function categoryOptions(categories: readonly Category[], q: string): LinkOption[] {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const trail = (category: Category): string[] => {
    const names: string[] = []
    let parent = category.parent_category_id ? byId.get(category.parent_category_id) : undefined
    // A broken tree (a parent pointing back) ends after as many steps as there are categories
    for (let step = 0; parent && step < categories.length; step++) {
      names.unshift(parent.name)
      parent = parent.parent_category_id ? byId.get(parent.parent_category_id) : undefined
    }
    return names
  }
  // In the tree's order, level by level: each category right after its parent
  const places = new Map(
    categories.map((category) => [category.id, [...trail(category), category.name]])
  )
  const byPlace = (a: Category, b: Category): number => {
    const first = places.get(a.id) ?? []
    const second = places.get(b.id) ?? []
    for (let level = 0; level < Math.min(first.length, second.length); level++) {
      const order = (first[level] ?? "").localeCompare(second[level] ?? "", "tr")
      if (order !== 0) {
        return order
      }
    }
    return first.length - second.length
  }
  const sorted = [...categories].sort(byPlace)
  return matches(sorted, q, (category) => category.name).map((category) => {
    const parents = trail(category)
    return {
      id: category.id,
      name: category.name,
      detail: parents.length > 0 ? parents.join(" › ") : null,
      path: null,
      live: category.is_active && !category.is_internal,
    }
  })
}

async function productOptions(q: string): Promise<LinkOption[]> {
  const { products } = await sdk.admin.product.list({
    fields: "id,title,status",
    limit: RESULTS,
    ...(q ? { q } : {}),
  })
  return products.map((product) => ({
    id: product.id,
    name: product.title,
    detail: null,
    path: null,
    live: product.status === "published",
  }))
}

async function optionsFor(client: QueryClient, kind: RecordKind, q: string) {
  switch (kind) {
    case "category":
      return categoryOptions(await client.query({ ...categoryTreeQuery(), staleTime: KEEP_MS }), q)
    case "product":
      return productOptions(q)
    case "collection":
      return matches(await client.query(collectionsQuery()), q, (each) => each.title).map(
        (collection): LinkOption => ({
          id: collection.id,
          name: collection.title,
          detail: null,
          path: null,
          live: true,
        })
      )
    case "brand":
      return (await brandOptions(q)).map((brand): LinkOption => ({
        id: brand.id,
        name: brand.label,
        detail: null,
        path: null,
        live: !brand.inactive,
      }))
    case "page":
    case "post":
      return (await client.query(contentListQuery({ kind, q, page: 0 }))).entries.map(
        (entry): LinkOption => ({
          id: entry.id,
          name: entry.title,
          detail: entry.path,
          path: entry.path,
          live: entry.status === "published",
        })
      )
    case "landing":
      return (await client.query(landingsQuery({ q, page: 0 }))).landings.map(
        (landing): LinkOption => ({
          id: landing.id,
          name: landing.title,
          detail: landing.path,
          path: landing.path,
          live: landing.status === "published" && landing.path !== null,
        })
      )
  }
}

/** The records of one kind whose name holds `q`, for the link picker. */
export function useLinkOptions(kind: RecordKind, q: string) {
  const client = useQueryClient()
  return useQuery({
    queryKey: ["storefront-menus", "options", kind, q],
    queryFn: () => optionsFor(client, kind, q),
  })
}
