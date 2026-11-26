import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  LINKED_COLUMNS,
  MAX_LINKED_PRODUCTS,
  mergeLinked,
  storedLinkedIds,
} from "../../lib/catalog/linked-products"
import type { LinkedKind } from "../../lib/catalog/linked-products"
import { SEARCH_INDEX_MODULE } from "../../modules/search-index"
import type SearchIndexModuleService from "../../modules/search-index/service"
import { hidesOutOfStock } from "../seo/listing-stock"

type Container = Pick<MedusaContainer, "resolve">

export interface LinkedReadInput {
  kind: LinkedKind
  /** The product whose page it is (`upsell`), or the cart's products in line order (`cross_sell`). */
  product_ids: readonly string[]
  /** The shopper's sales channels (the publishable key's). */
  sales_channel_ids: readonly string[]
}

interface ProductRow {
  id: string
  status?: string | null
  sales_channels?: ({ id: string } | null)[] | null
  product_extension?: Record<string, unknown> | null
}

const VISIBILITY = ["id", "status", "sales_channels.id"]

/** Published and in one of the shopper's sales channels. */
const visibleIn =
  (channels: ReadonlySet<string>) =>
  (row: ProductRow): boolean =>
    row.status === "published" &&
    (row.sales_channels ?? []).some((channel) => channel !== null && channels.has(channel.id))

/**
 * The products the given ones link to (S3), as a shopper may see them:
 * in the shop's order (the first product's list, then what the next
 * adds), each once, none of the given products, only published ones in
 * the shopper's sales channels; while the shop hides sold-out products
 * from its listings (T1), only ones in stock by the search index (one not
 * indexed yet counts as in stock). At most twelve.
 */
export async function linkedProductIds(
  container: Container,
  input: LinkedReadInput
): Promise<string[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const column = LINKED_COLUMNS[input.kind]
  const visible = visibleIn(new Set(input.sales_channel_ids))
  const { data: sources } = await query.graph({
    entity: "product",
    fields: [...VISIBILITY, `product_extension.${column}`],
    filters: { id: [...input.product_ids] },
  })
  // A product the shopper cannot see says nothing of its links (a draft's)
  const byId = new Map((sources as ProductRow[]).filter(visible).map((row) => [row.id, row]))
  const candidates = mergeLinked(
    input.product_ids.map((id) => storedLinkedIds(byId.get(id)?.product_extension?.[column])),
    new Set(input.product_ids)
  )
  if (candidates.length === 0) {
    return []
  }
  const [{ data: targets }, hide] = await Promise.all([
    query.graph({
      entity: "product",
      fields: VISIBILITY,
      filters: { id: candidates },
    }),
    hidesOutOfStock(container),
  ])
  const shown = new Set((targets as ProductRow[]).filter(visible).map((row) => row.id))
  let ids = candidates.filter((id) => shown.has(id))
  if (hide && ids.length > 0) {
    const index = container.resolve<SearchIndexModuleService>(SEARCH_INDEX_MODULE)
    const soldOut = new Set(
      (await index.readDocuments(ids)).flatMap((doc) => (doc.in_stock ? [] : [doc.product_id]))
    )
    ids = ids.filter((id) => !soldOut.has(id))
  }
  return ids.slice(0, MAX_LINKED_PRODUCTS)
}
