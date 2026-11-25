import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { PRICE_ROW_FIELDS, isPlainPrice, kurusOfRow } from "../price-rows"
import type { PriceRow } from "../price-rows"
import { isVariantSaleMeta } from "./plan"
import type { ExistingSale, SaleVariant } from "./plan"

type Resolver = Pick<MedusaContainer, "resolve">

interface ListRow {
  id: string
  starts_at?: Date | string | null
  ends_at?: Date | string | null
  metadata?: unknown
}

interface StoreRow {
  supported_currencies?: ({ currency_code: string; is_default?: boolean | null } | null)[] | null
}

const EVERY = { take: null } as const

const isoOf = (value: Date | string | null | undefined) =>
  value === null || value === undefined ? null : new Date(value).toISOString()

/** The shop's default currency: the one its own prices are entered in (as the price lists' discount). */
export async function shopCurrency(container: Resolver): Promise<string> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "store",
    fields: ["supported_currencies.currency_code", "supported_currencies.is_default"],
  })
  const currencies = ((data[0] as StoreRow | undefined)?.supported_currencies ?? []).flatMap(
    (each) => (each ? [each] : [])
  )
  const currency = (currencies.find((each) => each.is_default) ?? currencies[0])?.currency_code
  if (!currency) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "price_lists.no_currency")
  }
  return currency
}

export interface ProductSaleFacts {
  title: string
  variants: (SaleVariant & { setId: string | null })[]
  /** Every sale list of each variant (normally one), in the shop's currency. */
  existing: Map<string, ExistingSale[]>
}

/** Each price set's sale lists of ours, by variant. */
async function salesOf(
  container: Resolver,
  variants: readonly { id: string; setId: string | null }[],
  rows: readonly PriceRow[]
): Promise<Map<string, ExistingSale[]>> {
  const listed = rows.filter((row) => row.price_list_id && isPlainPrice(row))
  const sales = new Map<string, ExistingSale[]>()
  if (listed.length === 0) {
    return sales
  }
  const lists = (await container
    .resolve(Modules.PRICING)
    .listPriceLists(
      { id: [...new Set(listed.flatMap((row) => (row.price_list_id ? [row.price_list_id] : [])))] },
      { select: ["id", "starts_at", "ends_at", "metadata"], ...EVERY }
    )) as unknown as ListRow[]
  const ours = new Map(
    lists.filter((list) => isVariantSaleMeta(list.metadata)).map((l) => [l.id, l])
  )
  for (const variant of variants) {
    for (const row of listed) {
      const list = ours.get(row.price_list_id ?? "")
      // The list's own mark names the variant: a row moved elsewhere is not its sale
      if (
        !list ||
        row.price_set_id !== variant.setId ||
        !isVariantSaleMeta(list.metadata) ||
        list.metadata.variant_id !== variant.id
      ) {
        continue
      }
      sales.set(variant.id, [
        ...(sales.get(variant.id) ?? []),
        {
          price_list_id: list.id,
          variant_id: variant.id,
          amount: kurusOfRow(row),
          starts_at: isoOf(list.starts_at),
          ends_at: isoOf(list.ends_at),
        },
      ])
    }
  }
  return sales
}

/**
 * A product's variants with their own price and their sale price lists
 * (adr/0086), in the shop's currency. Unknown product: not found.
 */
export async function productSaleFacts(
  container: Resolver,
  productId: string,
  currency: string
): Promise<ProductSaleFacts> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "title", "variants.id", "variants.title", "variants.price_set.id"],
    filters: { id: productId },
  })
  const product = data[0] as
    | {
        title: string
        variants?: ({
          id: string
          title?: string | null
          price_set?: { id: string } | null
        } | null)[]
      }
    | undefined
  if (!product) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "products.unknown")
  }
  const variants = (product.variants ?? []).flatMap((row) =>
    row ? [{ id: row.id, title: row.title ?? null, setId: row.price_set?.id ?? null }] : []
  )
  const setIds = variants.flatMap((variant) => (variant.setId ? [variant.setId] : []))
  const rows =
    setIds.length === 0
      ? []
      : ((await container
          .resolve(Modules.PRICING)
          .listPrices(
            { price_set_id: setIds, currency_code: [currency] },
            { select: PRICE_ROW_FIELDS, ...EVERY }
          )) as unknown as PriceRow[])
  const baseOf = (setId: string | null) => {
    const base = rows.find(
      (row) => row.price_set_id === setId && !row.price_list_id && isPlainPrice(row)
    )
    return base ? kurusOfRow(base) : null
  }
  return {
    title: product.title,
    variants: variants.map((variant) => ({ ...variant, base: baseOf(variant.setId) })),
    existing: await salesOf(container, variants, rows),
  }
}

/** Whether one price list is a variant's sale list of ours: read by its id alone. */
export async function isVariantSaleList(container: Resolver, id: string): Promise<boolean> {
  const [list] = (await container
    .resolve(Modules.PRICING)
    .listPriceLists({ id: [id] }, { select: ["id", "metadata"], take: 1 })) as unknown as ListRow[]
  return isVariantSaleMeta(list?.metadata)
}

/** Every price list of ours (adr/0086): kept out of the price lists screen. */
export async function variantSaleListIds(container: Resolver): Promise<Set<string>> {
  const lists = (await container
    .resolve(Modules.PRICING)
    .listPriceLists({}, { select: ["id", "metadata"], ...EVERY })) as unknown as ListRow[]
  return new Set(lists.filter((list) => isVariantSaleMeta(list.metadata)).map((list) => list.id))
}
