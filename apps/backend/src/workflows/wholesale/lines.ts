import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { fromMedusaAmount } from "../../lib/money"
import type { Kurus } from "../../lib/money"
import { baseOf, byName, isUndercut, lineMatches, netOfGross } from "../../lib/wholesale"
import { variantRows, variantsBySet } from "../pricing/price-list-lines"
import { PRICE_ROW_FIELDS, kurusOfRow } from "../pricing/price-rows"
import type { PriceRow } from "../pricing/price-rows"
import { sellingPrices } from "../pricing/selling-prices"
import { manualPrices, planRows, planVariants, wholesaleContext } from "./context"

/** One row of a wholesale list as the panel shows it (ADR-0068 §4). */
export interface WholesaleLine {
  variant_id: string
  variant_title: string | null
  sku: string | null
  product_id: string
  product_title: string
  thumbnail: string | null
  /** KDV excluded: entered by hand, or worked out from the row. */
  net: Kurus
  /** KDV included: the row Medusa prices with. */
  gross: Kurus
  vat_bps: number
  source: "manual" | "rate"
  /** The variant's own price, KDV included; null without one. */
  base: Kurus | null
  /** What a shopper with no group pays now, a live public sale included. */
  retail_now: Kurus | null
  /** Retail now is below the wholesale price: a warning, never a block (Ek 2026-11-15). */
  undercut: boolean
}

export interface LinesQuery {
  limit: number
  offset: number
  /** Product name, variant name or SKU. */
  q?: string | undefined
}

export interface LinesPage {
  lines: WholesaleLine[]
  /** Lines the search finds, across pages. */
  count: number
  /** Of those, the ones retail now undercuts. */
  undercut_count: number
}

// What a shopper with no group pays is worked out this many variants a read
const RETAIL_CHUNK = 500

async function retailNow(container: MedusaContainer, ids: string[], currency: string) {
  const retail = new Map<string, Kurus>()
  for (let start = 0; start < ids.length; start += RETAIL_CHUNK) {
    for (const row of await sellingPrices(
      container,
      ids.slice(start, start + RETAIL_CHUNK),
      currency
    )) {
      const amount = row.calculated_price?.calculated_amount
      if (amount !== null && amount !== undefined) {
        retail.set(row.id, fromMedusaAmount(amount, { allowRounding: true }))
      }
    }
  }
  return retail
}

/**
 * A wholesale list's rows, a page at a time, by product name: net and
 * gross price, where the price comes from, and the retail warning. The
 * search and the warning's count cover the whole list; a shop's every
 * variant may be on it (a rate prices them all).
 */
export async function wholesaleLines(
  container: MedusaContainer,
  priceListId: string,
  query: LinesQuery
): Promise<LinesPage> {
  const context = await wholesaleContext(container)
  const own = (await container
    .resolve(Modules.PRICING)
    .listPrices(
      { price_list_id: [priceListId], currency_code: [context.currency] },
      { select: PRICE_ROW_FIELDS, take: null }
    )) as unknown as PriceRow[]
  const variantOf = await variantsBySet(container, [...new Set(own.map((row) => row.price_set_id))])
  const rowOf = new Map(own.map((row) => [variantOf.get(row.price_set_id) ?? "", row]))
  const found = (await variantRows(container, [...rowOf.keys()].filter(Boolean)))
    .flatMap((variant) =>
      variant.product
        ? [
            {
              variant,
              product: variant.product,
              product_title: variant.product.title,
              variant_title: variant.title ?? null,
              sku: variant.sku ?? null,
            },
          ]
        : []
    )
    .filter((line) => lineMatches(line, query.q))
    .sort(byName)
  const ids = found.map((line) => line.variant.id)
  const { variants } = await planVariants(container, context, { ids })
  const [rows, manual, retail] = await Promise.all([
    planRows(container, context.currency, variants),
    manualPrices(container, priceListId, ids),
    retailNow(container, ids, context.currency),
  ])
  const planOf = new Map(variants.map((variant) => [variant.id, variant]))
  const rowsOfSet = new Map<string, typeof rows>()
  for (const each of rows) {
    rowsOfSet.set(each.price_set_id, [...(rowsOfSet.get(each.price_set_id) ?? []), each])
  }
  const lines = found.flatMap(({ variant, product, product_title, variant_title, sku }) => {
    const row = rowOf.get(variant.id)
    if (!row) {
      return []
    }
    const plan = planOf.get(variant.id)
    const gross = kurusOfRow(row)
    const vat = plan?.vat_bps ?? 0
    const entered = manual.get(variant.id)
    const retailPrice = retail.get(variant.id) ?? null
    const line: WholesaleLine = {
      variant_id: variant.id,
      variant_title,
      sku,
      product_id: product.id,
      product_title,
      thumbnail: product.thumbnail ?? null,
      net: entered ?? netOfGross(gross, vat),
      gross,
      vat_bps: vat,
      source: entered === undefined ? "rate" : "manual",
      base: plan ? baseOf(rowsOfSet.get(plan.price_set_id) ?? []) : null,
      retail_now: retailPrice,
      undercut: isUndercut(retailPrice, gross),
    }
    return [line]
  })
  return {
    lines: lines.slice(query.offset, query.offset + query.limit),
    count: lines.length,
    undercut_count: lines.filter((line) => line.undercut).length,
  }
}
