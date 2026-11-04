import type { MedusaContainer } from "@medusajs/framework/types"
import type { VatRate, VatState } from "../../../lib/tax"
import { ensureVatRegion } from "../../../workflows/tax/region"
import { productTotal, productsOnType, vatStateOf } from "../../../workflows/tax/vat-state"

export interface VatRateView {
  id: string
  code: string | null
  name: string
  rate: number
  product_type_id: string | null
  product_type_name: string | null
  /** Products taxed at it: on its type, and for the default those on no other rate's type. */
  products: number
  active: boolean
}

export interface VatRatesView {
  region_id: string
  default: { id: string; code: string | null; name: string; rate: number } | null
  rates: VatRateView[]
}

// The default first, then the others by rate, highest first; removed ones last
const order = (a: VatRate, b: VatRate) =>
  Number(b.active) - Number(a.active) ||
  Number(b.is_default) - Number(a.is_default) ||
  b.rate - a.rate ||
  a.name.localeCompare(b.name, "tr")

async function countsOf(container: MedusaContainer, state: VatState): Promise<Map<string, number>> {
  const others = state.rates.filter((rate) => rate.active && !rate.is_default)
  const [total, onTypes] = await Promise.all([
    productTotal(container),
    Promise.all(
      others.map(async (rate) =>
        rate.product_type_id ? productsOnType(container, rate.product_type_id) : 0
      )
    ),
  ])
  const counts = new Map(others.map((rate, at) => [rate.id, onTypes[at] ?? 0]))
  const fallback = state.rates.find((rate) => rate.active && rate.is_default)
  if (fallback) {
    const elsewhere = onTypes.reduce((sum, count) => sum + count, 0)
    counts.set(fallback.id, Math.max(0, total - elsewhere))
  }
  return counts
}

/**
 * GET /admin/vat-rates (adr/0007 Ek 2026-11-04): the shop's KDV rates,
 * each with its product type and how many products are taxed at it, the
 * removed ones as inactive. The TR region is made when missing, as a new
 * shop's bootstrap does.
 */
export async function readVatRates(container: MedusaContainer): Promise<VatRatesView> {
  const regionId = await ensureVatRegion(container)
  const state = await vatStateOf(container, regionId)
  const counts = await countsOf(container, state)
  const types = new Map(state.types.map((type) => [type.id, type]))
  const fallback = state.rates.find((rate) => rate.active && rate.is_default)
  return {
    region_id: regionId,
    default: fallback
      ? { id: fallback.id, code: fallback.code, name: fallback.name, rate: fallback.rate }
      : null,
    rates: [...state.rates].sort(order).map((rate) => ({
      id: rate.id,
      code: rate.code,
      name: rate.name,
      rate: rate.rate,
      product_type_id: rate.product_type_id,
      product_type_name: rate.product_type_id
        ? (types.get(rate.product_type_id)?.value ?? null)
        : null,
      products: counts.get(rate.id) ?? 0,
      active: rate.active,
    })),
  }
}
