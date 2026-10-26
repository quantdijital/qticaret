import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  batchPriceListPricesWorkflow,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { BPS_PER_WHOLE, multiplyByRateBps, toMedusaAmount } from "../../lib/money"
import { PRICE_ROW_FIELDS, isPlainPrice, kurusOfRow } from "./price-rows"
import type { PriceRow } from "./price-rows"

export interface DiscountPriceListInput {
  price_list_id: string
  product_ids: string[]
  /** Off each variant's own price, in basis points (20% = 2000). */
  rate_bps: number
  /**
   * Only the variants the list already prices: a new rate for the list's
   * own lines, never bringing back a variant taken out of it.
   */
  only_listed?: boolean
}

interface BatchRow {
  variant_id: string
  currency_code: string
  amount: number
}

interface Plan {
  batch: {
    id: string
    create: BatchRow[]
    update: (BatchRow & { id: string })[]
    delete: string[]
  }
  /** Variants with no price of their own in the shop's currency: nothing to take a share of. */
  skipped: string[]
}

interface StoreRow {
  supported_currencies?: ({ currency_code: string; is_default?: boolean | null } | null)[] | null
}

function shopCurrency(store: StoreRow | undefined): string {
  const currencies = (store?.supported_currencies ?? []).flatMap((each) => (each ? [each] : []))
  const currency = (currencies.find((each) => each.is_default) ?? currencies[0])?.currency_code
  if (!currency) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "price_lists.no_currency")
  }
  return currency
}

/**
 * Each variant at its own price less the rate, rounded half-up to the
 * kuruş (adr/0010): replaced where the list prices it, added where not
 * (unless only the list's own lines are asked for).
 */
export function planDiscount(
  input: DiscountPriceListInput,
  currency: string,
  variants: readonly { id: string; setId: string | null }[],
  prices: readonly PriceRow[]
): Plan {
  const plan: Plan = {
    batch: { id: input.price_list_id, create: [], update: [], delete: [] },
    skipped: [],
  }
  for (const variant of variants) {
    const ofSet = prices.filter((price) => price.price_set_id === variant.setId)
    const base = ofSet.find((price) => !price.price_list_id && isPlainPrice(price))
    const listed = ofSet.find(
      (price) => price.price_list_id === input.price_list_id && isPlainPrice(price)
    )
    if (input.only_listed && !listed) {
      continue
    }
    if (!base) {
      plan.skipped.push(variant.id)
      continue
    }
    const off = multiplyByRateBps(kurusOfRow(base), BPS_PER_WHOLE - input.rate_bps)
    const row = {
      variant_id: variant.id,
      currency_code: currency,
      amount: Number(toMedusaAmount(off)),
    }
    if (listed) {
      plan.batch.update.push({ id: listed.id, ...row })
    } else {
      plan.batch.create.push(row)
    }
  }
  return plan
}

/** Reads what the plan needs; read only, nothing to undo. */
const planDiscountStep = createStep(
  "price-list-discount-plan",
  async (input: DiscountPriceListInput, { container }) => {
    if (
      !Number.isInteger(input.rate_bps) ||
      input.rate_bps <= 0 ||
      input.rate_bps >= BPS_PER_WHOLE
    ) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "price_lists.rate")
    }
    const pricing = container.resolve(Modules.PRICING)
    const [list] = await pricing.listPriceLists({ id: [input.price_list_id] }, { take: 1 })
    if (!list) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "price_lists.unknown")
    }
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: stores } = await query.graph({
      entity: "store",
      fields: ["supported_currencies.currency_code", "supported_currencies.is_default"],
    })
    const currency = shopCurrency(stores[0])
    const { data } = await query.graph({
      entity: "product_variant",
      fields: ["id", "price_set.id"],
      filters: { product_id: input.product_ids },
    })
    const variants = (data as { id: string; price_set?: { id: string } | null }[]).map((row) => ({
      id: row.id,
      setId: row.price_set?.id ?? null,
    }))
    const setIds = variants.flatMap((variant) => (variant.setId ? [variant.setId] : []))
    const prices =
      setIds.length === 0
        ? []
        : ((await pricing.listPrices(
            { price_set_id: setIds, currency_code: [currency] },
            { select: PRICE_ROW_FIELDS, take: null }
          )) as unknown as PriceRow[])
    return new StepResponse(planDiscount(input, currency, variants, prices))
  }
)

/**
 * A percentage off the products' own prices, written into a price list
 * (F4.1) through Medusa's own price list batch, which undoes itself if a
 * later part fails. The amounts are worked out here, never sent in.
 */
export const discountPriceListWorkflow = createWorkflow(
  "price-list-discount",
  (input: DiscountPriceListInput) => {
    // One at a time per list: two (a double click) would read the same prices and both add one
    const lock = transform({ input }, ({ input }) => `price-list-discount:${input.price_list_id}`)
    acquireLockStep({ key: lock, timeout: 5, ttl: 60 })
    const plan = planDiscountStep(input)
    const data = transform({ plan }, ({ plan }) => plan.batch)
    // Nothing to write (unknown products, or none with a price of their own): no batch
    when({ plan }, ({ plan }) => plan.batch.create.length + plan.batch.update.length > 0).then(
      () => {
        batchPriceListPricesWorkflow.runAsStep({ input: { data } })
      }
    )
    releaseLockStep({ key: lock })
    return new WorkflowResponse(
      transform({ plan }, ({ plan }) => ({
        priced: plan.batch.create.length + plan.batch.update.length,
        skipped: plan.skipped,
      }))
    )
  }
)
