import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { kurus } from "../../lib/money"
import type { Kurus } from "../../lib/money"
import { DEFAULT_VAT_RATE } from "../../lib/tax"
import { vatBps } from "../../lib/wholesale"
import type { PlanRow, PlanVariant } from "../../lib/wholesale"
import { WHOLESALE_MODULE } from "../../modules/wholesale"
import type WholesaleModuleService from "../../modules/wholesale/service"
import { findVatRegion } from "../tax/region"
import { vatStateOf } from "../tax/vat-state"
import { PRICE_ROW_FIELDS, kurusOfRow } from "../pricing/price-rows"
import type { PriceRow } from "../pricing/price-rows"

/** What every wholesale price write reads first: the shop's currency and its KDV rates. */
export interface WholesaleContext {
  currency: string
  /** A product type's KDV rate in basis points; a product on none pays the default. */
  vatOf: (typeId: string | null | undefined) => number
}

interface StoreRow {
  supported_currencies?: ({ currency_code: string; is_default?: boolean | null } | null)[] | null
}

async function shopCurrency(container: MedusaContainer): Promise<string> {
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

/** The KDV rate of each product type (adr/0007: product type = KDV group). */
async function vatRates(container: MedusaContainer) {
  const region = await findVatRegion(container)
  const rates = region ? (await vatStateOf(container, region.id)).rates : []
  const active = rates.filter((rate) => rate.active)
  const fallback = active.find((rate) => rate.is_default)?.rate ?? DEFAULT_VAT_RATE.rate
  const byType = new Map(
    active.flatMap((rate) => (rate.product_type_id ? [[rate.product_type_id, rate.rate]] : []))
  )
  return (typeId: string | null | undefined): number =>
    vatBps((typeId ? byType.get(typeId) : undefined) ?? fallback)
}

export async function wholesaleContext(container: MedusaContainer): Promise<WholesaleContext> {
  const [currency, vatOf] = await Promise.all([shopCurrency(container), vatRates(container)])
  return { currency, vatOf }
}

interface VariantRow {
  id: string
  price_set?: { id: string } | null
  product?: { type_id?: string | null } | null
}

export const VARIANT_PAGE = 500

/** Variants by id, or a page of every variant by id order; those without a price set are left out. */
export async function planVariants(
  container: MedusaContainer,
  context: WholesaleContext,
  scope: { ids: string[] } | { skip: number }
): Promise<{ variants: PlanVariant[]; read: number }> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_variant",
    fields: ["id", "price_set.id", "product.type_id"],
    filters: "ids" in scope ? { id: scope.ids } : {},
    ...("skip" in scope
      ? { pagination: { skip: scope.skip, take: VARIANT_PAGE, order: { id: "ASC" } } }
      : {}),
  })
  const rows = data as VariantRow[]
  return {
    read: rows.length,
    variants: rows.flatMap((row) =>
      row.price_set?.id
        ? [
            {
              id: row.id,
              price_set_id: row.price_set.id,
              vat_bps: context.vatOf(row.product?.type_id),
            },
          ]
        : []
    ),
  }
}

/** Every price row of these variants' sets in the shop's currency, as the planner reads them. */
export async function planRows(
  container: MedusaContainer,
  currency: string,
  variants: readonly PlanVariant[]
): Promise<PlanRow[]> {
  if (variants.length === 0) {
    return []
  }
  const rows = (await container
    .resolve(Modules.PRICING)
    .listPrices(
      { price_set_id: variants.map((variant) => variant.price_set_id), currency_code: [currency] },
      { select: PRICE_ROW_FIELDS, take: null }
    )) as unknown as PriceRow[]
  return rows.map((row) => ({
    id: row.id,
    price_set_id: row.price_set_id,
    price_list_id: row.price_list_id ?? null,
    amount: kurusOfRow(row),
    rules_count: row.rules_count ?? 0,
    tiered:
      (row.min_quantity !== null && row.min_quantity !== undefined) ||
      (row.max_quantity !== null && row.max_quantity !== undefined),
  }))
}

/** The hand-entered net prices of one list for these variants. */
export async function manualPrices(
  container: MedusaContainer,
  priceListId: string,
  variantIds: readonly string[]
): Promise<Map<string, Kurus>> {
  if (variantIds.length === 0) {
    return new Map()
  }
  const marks = await container
    .resolve<WholesaleModuleService>(WHOLESALE_MODULE)
    .listWholesaleManualPrices(
      { price_list_id: priceListId, variant_id: [...variantIds] },
      { select: ["variant_id", "net_amount"], take: null }
    )
  return new Map(marks.map((mark) => [mark.variant_id, kurus(mark.net_amount)]))
}
