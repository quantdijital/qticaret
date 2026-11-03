import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  QueryContext,
  getVariantAvailability,
} from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { fromMedusaAmount } from "../../lib/money"
import type { MedusaAmount } from "../../lib/money"
import type { PaymentLinkLine } from "../../lib/payment-links/snapshot"

type Container = Pick<MedusaContainer, "resolve">

/** The shop's Turkish lira region: the store's default when it is one, else the first. */
export async function liraRegion(container: Container): Promise<string> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const [{ data: stores }, { data: regions }] = await Promise.all([
    query.graph({ entity: "store", fields: ["default_region_id"] }),
    query.graph({ entity: "region", fields: ["id"], filters: { currency_code: "try" } }),
  ])
  const ids = (regions as { id: string }[]).map((region) => region.id)
  const preferred = (stores[0] as { default_region_id?: string | null } | undefined)
    ?.default_region_id
  const region = preferred && ids.includes(preferred) ? preferred : ids[0]
  if (!region) {
    throw new ValidationError("payment_link.no_region")
  }
  return region
}

interface VariantRow {
  id: string
  title?: string | null
  manage_inventory?: boolean | null
  allow_backorder?: boolean | null
  product?: {
    id: string
    title?: string | null
    thumbnail?: string | null
    status?: string | null
  } | null
  calculated_price?: { calculated_amount?: MedusaAmount | null } | null
}

export interface PricingContext {
  region_id: string
  customer_id: string | null
}

/** The customer's groups: a group's price list prices their lines (2.21.2). */
async function groupsOf(container: Container, customerId: string | null): Promise<string[]> {
  if (!customerId) {
    return []
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: ["groups.id"],
    filters: { id: customerId },
  })
  const groups = (data[0] as { groups?: ({ id: string } | null)[] | null } | undefined)?.groups
  return (groups ?? []).flatMap((group) => (group ? [group.id] : []))
}

/**
 * One variant's row with its price for the quantity, as Medusa prices a
 * cart line: the lira region, the customer and their groups, the quantity
 * (tiered prices). The price is null when the variant has none there.
 */
async function variantRow(
  container: Container,
  variantId: string,
  quantity: number,
  context: PricingContext,
  groups: string[]
): Promise<VariantRow | undefined> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_variant",
    fields: [
      "id",
      "title",
      "manage_inventory",
      "allow_backorder",
      "product.id",
      "product.title",
      "product.thumbnail",
      "product.status",
      "calculated_price.calculated_amount",
    ],
    filters: { id: variantId },
    context: {
      calculated_price: QueryContext({
        currency_code: "try",
        region_id: context.region_id,
        ...(context.customer_id
          ? {
              customer_id: context.customer_id,
              customer: { id: context.customer_id, groups: { id: groups } },
            }
          : {}),
        quantity,
      }),
    },
  })
  return data[0]
}

const priceOf = (row: VariantRow | undefined): number | null => {
  const amount = row?.calculated_price?.calculated_amount
  return amount === null || amount === undefined
    ? null
    : fromMedusaAmount(amount, { allowRounding: true })
}

/**
 * The lines as the catalog prices them now (adr/0051 §2): the request
 * names variants and quantities only. A variant unknown, unpublished or
 * without a lira price is refused.
 */
export async function priceLines(
  container: Container,
  wanted: readonly { variant_id: string; quantity: number }[],
  context: PricingContext
): Promise<PaymentLinkLine[]> {
  const groups = await groupsOf(container, context.customer_id)
  const lines: PaymentLinkLine[] = []
  for (const line of wanted) {
    const row = await variantRow(container, line.variant_id, line.quantity, context, groups)
    const price = priceOf(row)
    if (row?.product?.status !== "published") {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "payment_link.variant_unknown")
    }
    if (price === null) {
      throw new ValidationError("payment_link.variant_unpriced", { field: "lines" })
    }
    lines.push({
      variant_id: row.id,
      product_id: row.product.id,
      quantity: line.quantity,
      title: row.product.title ?? "",
      variant_title: row.title ?? null,
      thumbnail: row.product.thumbnail ?? null,
      unit_price: price,
    })
  }
  return lines
}

/** Each line's price now, by variant; null for one with no price (or gone). */
export async function currentPrices(
  container: Container,
  lines: readonly PaymentLinkLine[],
  context: PricingContext
): Promise<Map<string, number | null>> {
  const groups = await groupsOf(container, context.customer_id)
  const prices = new Map<string, number | null>()
  for (const line of lines) {
    const row = await variantRow(container, line.variant_id, line.quantity, context, groups)
    prices.set(line.variant_id, row?.product?.status === "published" ? priceOf(row) : null)
  }
  return prices
}

/**
 * The variants of these lines that are short on the shelf for the
 * channel; one that does not track stock or sells past it never is.
 */
export async function shortLines(
  container: Container,
  lines: readonly { variant_id: string; quantity: number }[],
  salesChannelId: string | null
): Promise<Set<string>> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_variant",
    fields: ["id", "manage_inventory", "allow_backorder"],
    filters: { id: lines.map((line) => line.variant_id) },
  })
  const tracked = (data as VariantRow[])
    .filter((row) => row.manage_inventory && !row.allow_backorder)
    .map((row) => row.id)
  if (tracked.length === 0 || !salesChannelId) {
    return new Set()
  }
  const availability = await getVariantAvailability(query, {
    variant_ids: tracked,
    sales_channel_id: salesChannelId,
  })
  const wanted = new Map<string, number>()
  for (const line of lines) {
    wanted.set(line.variant_id, (wanted.get(line.variant_id) ?? 0) + line.quantity)
  }
  return new Set(
    tracked.filter((id) => (availability[id]?.availability ?? 0) < (wanted.get(id) ?? 0))
  )
}

/** The store's default sales channel: where staff check stock before a storefront is known. */
export async function defaultChannel(container: Container): Promise<string | null> {
  const { data } = await container
    .resolve(ContainerRegistrationKeys.QUERY)
    .graph({ entity: "store", fields: ["default_sales_channel_id"] })
  return (
    (data[0] as { default_sales_channel_id?: string | null } | undefined)
      ?.default_sales_channel_id ?? null
  )
}
