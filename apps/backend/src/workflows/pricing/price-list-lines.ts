import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import type { Kurus } from "../../lib/money"
import { PRICE_ROW_FIELDS, isPlainPrice, kurusOfRow } from "./price-rows"
import type { PriceRow } from "./price-rows"

/**
 * A price list's prices as the panel shows them (F4.1): which product and
 * variant each prices, the variant's own price beside it, and other live
 * lists that price the same variants in overlapping days. Medusa gives a
 * sale list's lowest price; between overriding lists the first it finds
 * wins, so an overlap is worth a warning.
 */

export interface PriceListLine {
  price_id: string
  variant_id: string
  variant_title: string | null
  sku: string | null
  product_id: string
  product_title: string
  thumbnail: string | null
  currency_code: string
  /** The variant's own price in the currency, outside any list; null if it has none. */
  base: Kurus | null
  price: Kurus
}

export interface PriceListOverlap {
  id: string
  title: string
  type: string
  starts_at: Date | string | null
  ends_at: Date | string | null
  variant_count: number
}

interface ListRow {
  id: string
  title: string
  type: string
  status: string
  starts_at: Date | string | null
  ends_at: Date | string | null
}

interface VariantRow {
  id: string
  title?: string | null
  sku?: string | null
  product?: { id: string; title: string; thumbnail?: string | null } | null
}

const LIST_FIELDS = ["id", "title", "type", "status", "starts_at", "ends_at"]
const EVERY = { take: null } as const

const time = (when: Date | string | null, open: number) =>
  when === null ? open : new Date(when).getTime()

/** Two lists' days meet; an open end runs forever. */
export function overlaps(a: ListRow, b: ListRow): boolean {
  return (
    time(a.starts_at, -Infinity) <= time(b.ends_at, Infinity) &&
    time(b.starts_at, -Infinity) <= time(a.ends_at, Infinity)
  )
}

async function variantsBySet(container: MedusaContainer, priceSetIds: string[]) {
  if (priceSetIds.length === 0) {
    return new Map<string, string>()
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_variant_price_set",
    fields: ["variant_id", "price_set_id"],
    filters: { price_set_id: priceSetIds },
  })
  return new Map(
    (data as { variant_id: string; price_set_id: string }[]).map((link) => [
      link.price_set_id,
      link.variant_id,
    ])
  )
}

async function variantRows(container: MedusaContainer, ids: string[]): Promise<VariantRow[]> {
  if (ids.length === 0) {
    return []
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_variant",
    fields: ["id", "title", "sku", "product.id", "product.title", "product.thumbnail"],
    filters: { id: ids },
  })
  return data
}

/** The other live lists pricing the same variants on days this one also runs. */
async function overlapsOf(
  container: MedusaContainer,
  list: ListRow,
  others: readonly PriceRow[],
  variantOf: ReadonlyMap<string, string>
): Promise<PriceListOverlap[]> {
  const byList = new Map<string, Set<string>>()
  for (const price of others) {
    const variant = variantOf.get(price.price_set_id)
    if (price.price_list_id && price.price_list_id !== list.id && variant) {
      byList.set(price.price_list_id, (byList.get(price.price_list_id) ?? new Set()).add(variant))
    }
  }
  if (byList.size === 0) {
    return []
  }
  const lists = (await container
    .resolve(Modules.PRICING)
    .listPriceLists(
      { id: [...byList.keys()], status: ["active"] },
      { select: LIST_FIELDS, ...EVERY }
    )) as unknown as ListRow[]
  const now = Date.now()
  // A list already over can no longer clash with anything
  return lists
    .filter((other) => time(other.ends_at, Infinity) >= now && overlaps(list, other))
    .map((other) => ({
      id: other.id,
      title: other.title,
      type: other.type,
      starts_at: other.starts_at,
      ends_at: other.ends_at,
      variant_count: byList.get(other.id)?.size ?? 0,
    }))
}

/** The list's own prices as lines, by product and variant name; prices of unknown variants left out. */
function linesOf(
  own: readonly PriceRow[],
  related: readonly PriceRow[],
  variantOf: ReadonlyMap<string, string>,
  variants: ReadonlyMap<string, VariantRow>
): PriceListLine[] {
  const baseOf = (setId: string, currency: string) => {
    const base = related.find(
      (price) =>
        price.price_set_id === setId &&
        !price.price_list_id &&
        price.currency_code === currency &&
        isPlainPrice(price)
    )
    return base ? kurusOfRow(base) : null
  }
  const lines = own.flatMap((price): PriceListLine[] => {
    const variant = variants.get(variantOf.get(price.price_set_id) ?? "")
    if (!variant?.product) {
      return []
    }
    return [
      {
        price_id: price.id,
        variant_id: variant.id,
        variant_title: variant.title ?? null,
        sku: variant.sku ?? null,
        product_id: variant.product.id,
        product_title: variant.product.title,
        thumbnail: variant.product.thumbnail ?? null,
        currency_code: price.currency_code,
        base: baseOf(price.price_set_id, price.currency_code),
        price: kurusOfRow(price),
      },
    ]
  })
  return lines.sort(
    (a, b) =>
      a.product_title.localeCompare(b.product_title, "tr") ||
      (a.variant_title ?? "").localeCompare(b.variant_title ?? "", "tr")
  )
}

export async function priceListLines(
  container: MedusaContainer,
  listId: string
): Promise<{ lines: PriceListLine[]; overlaps: PriceListOverlap[] }> {
  const pricing = container.resolve(Modules.PRICING)
  const [list] = (await pricing.listPriceLists(
    { id: [listId] },
    { select: LIST_FIELDS, take: 1 }
  )) as unknown as ListRow[]
  if (!list) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "price_lists.unknown")
  }
  const own = (await pricing.listPrices(
    { price_list_id: [listId] },
    { select: PRICE_ROW_FIELDS, ...EVERY }
  )) as unknown as PriceRow[]
  const setIds = [...new Set(own.map((price) => price.price_set_id))]
  // Every price of those variants: their own (base) prices and other lists'
  const [variantOf, related] = await Promise.all([
    variantsBySet(container, setIds),
    setIds.length === 0
      ? Promise.resolve([] as PriceRow[])
      : (pricing.listPrices(
          { price_set_id: setIds },
          { select: PRICE_ROW_FIELDS, ...EVERY }
        ) as unknown as Promise<PriceRow[]>),
  ])
  const variants = new Map(
    (await variantRows(container, [...new Set(variantOf.values())])).map((row) => [row.id, row])
  )
  const lines = linesOf(own, related, variantOf, variants)
  return { lines, overlaps: await overlapsOf(container, list, related, variantOf) }
}
