import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, QueryContext } from "@medusajs/framework/utils"
import { chunksOf } from "../../lib/catalog"
import { fromMedusaAmount } from "../../lib/money"
import type { Kurus } from "../../lib/money"
import { shownWholesale } from "../../lib/wholesale"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { CUSTOMERS_WHOLESALE } from "../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { WHOLESALE_MODULE } from "../../modules/wholesale"
import type WholesaleModuleService from "../../modules/wholesale/service"
import { shopperVariantIds } from "../pricing/selling-prices"
import { wholesaleContext } from "./context"

type Container = Pick<MedusaContainer, "resolve">

/** What the storefront needs to know of the signed-in customer (ADR-0068 §7). */
export interface WholesaleShopper {
  active: boolean
  /** Prices shown without KDV, KDV as its own line (§5). */
  vat_exclusive: boolean
  /** Fewest units an order holds (§8, slice 4); null: no rule. */
  min_quantity: number | null
}

/** Every customer who is not an active wholesaler of a shop that sells wholesale. */
export const NOT_WHOLESALE: WholesaleShopper = Object.freeze({
  active: false,
  vat_exclusive: false,
  min_quantity: null,
})

/**
 * The customer as a wholesaler, from the session's customer id only: an
 * active account while the shop has `customers.wholesale` on; anyone
 * else, a pending or closed account among them, is answered alike
 * (`NOT_WHOLESALE`), so nothing tells an account exists. The level's name
 * and the groups never leave here.
 */
export async function wholesaleShopper(
  container: Container,
  customerId: string
): Promise<WholesaleShopper> {
  const enabled = await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .isFeatureEnabled(CUSTOMERS_WHOLESALE)
  if (!enabled || customerId === "") {
    return NOT_WHOLESALE
  }
  const service = container.resolve<WholesaleModuleService>(WHOLESALE_MODULE)
  const [account] = await service.listWholesaleAccounts(
    { customer_id: customerId, status: "active" },
    { select: ["id", "tier_id", "min_quantity"], take: 1 }
  )
  if (!account) {
    return NOT_WHOLESALE
  }
  const [tier] = account.tier_id
    ? await service.listWholesaleTiers(
        { id: account.tier_id },
        { select: ["min_quantity"], take: 1 }
      )
    : []
  return {
    active: true,
    vat_exclusive: true,
    min_quantity: account.min_quantity ?? tier?.min_quantity ?? null,
  }
}

/** One variant's price for the wholesaler: without KDV, with it, and the rate in basis points. */
export interface WholesalePrice {
  net: Kurus
  gross: Kurus
  vat_bps: number
}

// Variants priced per query, as the public display reads them
const VARIANT_CHUNK = 100

interface VariantRow {
  id: string
  product?: { type_id?: string | null } | null
  calculated_price?: {
    calculated_amount?: number | null
    is_calculated_price_tax_inclusive?: boolean | null
  } | null
}

/** The groups the customer is in now, as Medusa's cart reads them for its prices. */
async function groupsOf(container: Container, customerId: string): Promise<string[]> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: ["groups.id"],
    filters: { id: customerId },
  })
  const groups = (data[0] as { groups?: ({ id: string } | null)[] | null } | undefined)?.groups
  return (groups ?? []).flatMap((group) => (group ? [group.id] : []))
}

/**
 * The region a cart in the currency is priced in (security review L3):
 * the store's default when it sells in it, else the first; null when
 * none does (the price is then the currency's alone, as before).
 */
async function regionOf(container: Container, currency: string): Promise<string | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const [{ data: stores }, { data: regions }] = await Promise.all([
    query.graph({ entity: "store", fields: ["default_region_id"] }),
    query.graph({ entity: "region", fields: ["id"], filters: { currency_code: currency } }),
  ])
  const ids = (regions as { id: string }[]).map((region) => region.id)
  const preferred = (stores[0] as { default_region_id?: string | null } | undefined)
    ?.default_region_id
  return preferred && ids.includes(preferred) ? preferred : (ids[0] ?? null)
}

/**
 * What the signed-in wholesaler pays for each variant (ADR-0068 §7):
 * Medusa's own price for the customer's groups in the shop's currency
 * and region, as their cart will price the line (own list > level, Ek
 * 2026-11-15), shown without KDV beside the KDV-included amount, by the
 * product type's KDV rate (adr/0007). Only variants a shopper may see
 * answer (`shopperVariantIds`); a variant with no price has none. Anyone
 * not an active wholesaler gets nothing: the public display is theirs.
 */
export async function wholesalePrices(
  container: Container,
  input: { customer_id: string; variant_ids: readonly string[]; sales_channel_ids: string[] }
): Promise<Map<string, WholesalePrice>> {
  const prices = new Map<string, WholesalePrice>()
  if (!(await wholesaleShopper(container, input.customer_id)).active) {
    return prices
  }
  const scope = container as MedusaContainer
  const visible = await shopperVariantIds(
    scope,
    [...new Set(input.variant_ids)],
    input.sales_channel_ids
  )
  if (visible.length === 0) {
    return prices
  }
  const [context, groups] = await Promise.all([
    wholesaleContext(scope),
    groupsOf(container, input.customer_id),
  ])
  const region = await regionOf(container, context.currency)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  for (const chunk of chunksOf(visible, VARIANT_CHUNK)) {
    const { data } = await query.graph({
      entity: "product_variant",
      fields: [
        "id",
        "product.type_id",
        "calculated_price.calculated_amount",
        "calculated_price.is_calculated_price_tax_inclusive",
      ],
      filters: { id: chunk },
      context: {
        calculated_price: QueryContext({
          currency_code: context.currency,
          ...(region ? { region_id: region } : {}),
          customer_id: input.customer_id,
          customer: { groups: { id: groups } },
        }),
      },
    })
    for (const variant of data as VariantRow[]) {
      const amount = variant.calculated_price?.calculated_amount
      if (amount === null || amount === undefined) {
        continue
      }
      const vat = context.vatOf(variant.product?.type_id)
      const shown = shownWholesale(
        fromMedusaAmount(amount, { allowRounding: true }),
        variant.calculated_price?.is_calculated_price_tax_inclusive === true,
        vat
      )
      prices.set(variant.id, { ...shown, vat_bps: vat })
    }
  }
  return prices
}
