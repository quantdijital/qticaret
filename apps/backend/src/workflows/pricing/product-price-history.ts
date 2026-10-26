import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { fromMedusaAmount } from "../../lib/money"
import type { Kurus } from "../../lib/money"
import type { PriceDisplay } from "../../lib/pricing"
import { PRICE_HISTORY_MODULE } from "../../modules/price-history"
import type PriceHistoryModuleService from "../../modules/price-history/service"
import { priceDisplays } from "./price-display"

const DAY_MS = 24 * 60 * 60 * 1000
export const HISTORY_DAYS = 90

export interface PricePointView {
  at: Date
  amount: Kurus
  original: Kurus
}

export interface VariantPriceHistory {
  id: string
  title: string | null
  sku: string | null
  /** How the price is shown now; null with no price in the currency. */
  display: PriceDisplay | null
  /** The selling price over the window, oldest first: the one in force at its start, then each change. */
  points: PricePointView[]
}

interface VariantRow {
  id: string
  title?: string | null
  sku?: string | null
  variant_rank?: number | null
}

const kurus = (amount: unknown) =>
  fromMedusaAmount(amount as Parameters<typeof fromMedusaAmount>[0], { allowRounding: true })

// Two runs may record one change twice (ADR-0023): a point equal to the one before adds nothing
const changesOf = (points: readonly PricePointView[]): PricePointView[] =>
  points.filter(
    (point, index) =>
      index === 0 ||
      point.amount !== points[index - 1]?.amount ||
      point.original !== points[index - 1]?.original
  )

/**
 * A product's selling prices over the last 90 days, by variant, beside how
 * each is shown today (F4.3, ADR-0023): the panel's price history, and why
 * a discount is, or is not, struck through.
 */
export async function productPriceHistory(
  container: MedusaContainer,
  productId: string,
  currency: string,
  now: Date = new Date()
): Promise<{ window_start: Date; variants: VariantPriceHistory[] }> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "variants.id", "variants.title", "variants.sku", "variants.variant_rank"],
    filters: { id: productId },
  })
  const product = data[0] as { variants?: (VariantRow | null)[] | null } | undefined
  if (!product) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "products.unknown")
  }
  const variants = (product.variants ?? [])
    .flatMap((variant) => (variant ? [variant] : []))
    .sort((a, b) => (a.variant_rank ?? 0) - (b.variant_rank ?? 0))
  const ids = variants.map((variant) => variant.id)
  const windowStart = new Date(now.getTime() - HISTORY_DAYS * DAY_MS)
  const [displays, history] = await Promise.all([
    priceDisplays(container, ids, currency, now),
    container.resolve<PriceHistoryModuleService>(PRICE_HISTORY_MODULE).historyOf(ids, currency),
  ])
  return {
    window_start: windowStart,
    variants: variants.map((variant) => {
      const rows = (history.get(variant.id) ?? []).map((row) => ({
        at: new Date(row.recorded_at),
        amount: kurus(row.amount),
        original: kurus(row.original_amount),
      }))
      const inForce = rows.filter((row) => row.at <= windowStart).at(-1)
      const later = rows.filter((row) => row.at > windowStart)
      return {
        id: variant.id,
        title: variant.title ?? null,
        sku: variant.sku ?? null,
        display: displays.get(variant.id) ?? null,
        points: changesOf([...(inForce ? [{ ...inForce, at: windowStart }] : []), ...later]),
      }
    }),
  }
}
