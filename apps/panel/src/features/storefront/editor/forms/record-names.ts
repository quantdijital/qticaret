import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { QueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { brandQuery } from "@/features/brands/api/brands"
import { categoryTreeQuery } from "@/features/categories/api/categories"
import { contentQuery } from "@/features/content/api/content"
import { landingQuery } from "@/features/content/api/landings"
import { collectionsQuery, productNamesQuery } from "@/features/promotions/api/scope-options"
import type { LayoutLink } from "@/features/storefront/api/layout"
import { RECORD_KINDS } from "@/features/storefront/api/menus"
import type { RecordKind } from "@/features/storefront/api/menus"

const KEEP_MS = 60_000

/** One record's name, or none when it is gone. */
async function oneName(read: () => Promise<{ name: string } | null>): Promise<string | null> {
  try {
    return (await read())?.name ?? null
  } catch {
    return null
  }
}

/** The names of records of one kind by id; an id not found is left out. */
async function namesOf(
  client: QueryClient,
  kind: RecordKind,
  ids: readonly string[]
): Promise<Record<string, string>> {
  const pairs = async (
    read: (id: string) => Promise<{ name: string } | null>
  ): Promise<Record<string, string>> => {
    const found = await Promise.all(ids.map((id) => oneName(() => read(id))))
    return Object.fromEntries(ids.flatMap((id, at) => (found[at] ? [[id, found[at]]] : [])))
  }
  switch (kind) {
    case "category": {
      const tree = await client.query({ ...categoryTreeQuery(), staleTime: KEEP_MS })
      return Object.fromEntries(
        tree.filter((each) => ids.includes(each.id)).map((each) => [each.id, each.name])
      )
    }
    case "collection": {
      const all = await client.query(collectionsQuery())
      return Object.fromEntries(
        all.filter((each) => ids.includes(each.id)).map((each) => [each.id, each.title])
      )
    }
    case "product": {
      const products = await client.query(productNamesQuery(ids))
      return Object.fromEntries(products.map((each) => [each.id, each.title]))
    }
    case "brand":
      return pairs(async (id) => ({ name: (await client.query(brandQuery(id))).name }))
    case "page":
    case "post":
      return pairs(async (id) => ({ name: (await client.query(contentQuery(id))).title }))
    case "landing":
      return pairs(async (id) => ({ name: (await client.query(landingQuery(id))).title }))
  }
}

/** The names of the chosen records, for the editor's lists; read once and kept a minute. */
export function useRecordNames(kind: RecordKind, ids: readonly string[]) {
  const client = useQueryClient()
  return useQuery({
    queryKey: ["storefront-layout", "names", kind, [...ids].sort()],
    queryFn: () => namesOf(client, kind, ids),
    enabled: ids.length > 0,
    staleTime: KEEP_MS,
  })
}

/** What a link shows when it has no wording of its own: the record's, the legal text's or the page's name. */
export function useLinkName(link: LayoutLink | null): string | null {
  const { t } = useTranslation()
  const kind = link && (RECORD_KINDS as readonly string[]).includes(link.kind) ? link.kind : null
  const target = link && link.kind !== "url" ? link.target : null
  const names = useRecordNames((kind ?? "category") as RecordKind, kind && target ? [target] : [])
  if (!link) {
    return null
  }
  if (link.kind === "url") {
    return link.url
  }
  if (link.kind === "legal") {
    return t(`settings.legal.kinds.${link.target}.name`)
  }
  if (link.kind === "system") {
    return t(`storefront.menus.system.${link.target}`)
  }
  return names.data?.[link.target] ?? null
}
