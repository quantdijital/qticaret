import type { MedusaContainer } from "@medusajs/framework/types"
import { fromMedusaAmount } from "../../lib/money"
import type { Kurus } from "../../lib/money"
import { isUndercut, netOfGross } from "../../lib/wholesale"
import { priceListLines } from "../pricing/price-list-lines"
import { sellingPrices } from "../pricing/selling-prices"
import { manualPrices, planVariants, wholesaleContext } from "./context"

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

/** A wholesale list's rows with their net price, source and the retail warning. */
export async function wholesaleLines(
  container: MedusaContainer,
  priceListId: string
): Promise<{ lines: WholesaleLine[]; undercut_count: number }> {
  const context = await wholesaleContext(container)
  const { lines } = await priceListLines(container, priceListId)
  const ids = [...new Set(lines.map((line) => line.variant_id))]
  const [{ variants }, manual, retail] = await Promise.all([
    planVariants(container, context, { ids }),
    manualPrices(container, priceListId, ids),
    ids.length === 0 ? Promise.resolve([]) : sellingPrices(container, ids, context.currency),
  ])
  const vatOf = new Map(variants.map((variant) => [variant.id, variant.vat_bps]))
  const retailOf = new Map(
    retail.flatMap((row) => {
      const amount = row.calculated_price?.calculated_amount
      return amount === null || amount === undefined
        ? []
        : [[row.id, fromMedusaAmount(amount, { allowRounding: true })] as const]
    })
  )
  const shown = lines.map((line): WholesaleLine => {
    const vat = vatOf.get(line.variant_id) ?? 0
    const entered = manual.get(line.variant_id)
    const retailNow = retailOf.get(line.variant_id) ?? null
    return {
      variant_id: line.variant_id,
      variant_title: line.variant_title,
      sku: line.sku,
      product_id: line.product_id,
      product_title: line.product_title,
      thumbnail: line.thumbnail,
      net: entered ?? netOfGross(line.price, vat),
      gross: line.price,
      vat_bps: vat,
      source: entered === undefined ? "rate" : "manual",
      base: line.base,
      retail_now: retailNow,
      undercut: isUndercut(retailNow, line.price),
    }
  })
  return { lines: shown, undercut_count: shown.filter((line) => line.undercut).length }
}
