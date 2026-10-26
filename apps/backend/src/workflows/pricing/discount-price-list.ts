import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { batchPriceListPricesWorkflow } from "@medusajs/medusa/core-flows"
import { BPS_PER_WHOLE, fromMedusaAmount, multiplyByRateBps, toMedusaAmount } from "../../lib/money"
import type { MedusaAmount } from "../../lib/money"

export interface DiscountPriceListInput {
  price_list_id: string
  product_ids: string[]
  /** Off each variant's own price, in basis points (20% = 2000). */
  rate_bps: number
}

interface PriceRow {
  id: string
  raw_amount?: MedusaAmount | null
  amount?: MedusaAmount | null
  currency_code: string
  price_set_id: string
  price_list_id?: string | null
  rules_count?: number | null
}

interface Plan {
  batch: {
    id: string
    create: { variant_id: string; currency_code: string; amount: number }[]
    update: { id: string; variant_id: string; currency_code: string; amount: number }[]
    delete: string[]
  }
  /** Variants with no price of their own in the shop's currency: nothing to take a share of. */
  skipped: string[]
}

const PRICE_FIELDS = [
  "id",
  "amount",
  "raw_amount",
  "currency_code",
  "price_set_id",
  "price_list_id",
  "rules_count",
]

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
 * Each variant of the products at its own price less the rate, in the
 * shop's currency, rounded half-up to the kuruş (adr/0010). A variant the
 * list already prices has that price replaced; read only, nothing to undo.
 */
const planDiscountStep = createStep(
  "price-list-discount-plan",
  async (input: DiscountPriceListInput, { container }) => {
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
    const variants = (data as { id: string; price_set?: { id: string } | null }[]).flatMap((row) =>
      row.price_set ? [{ id: row.id, setId: row.price_set.id }] : []
    )
    const prices = (await pricing.listPrices(
      { price_set_id: variants.map((variant) => variant.setId), currency_code: [currency] },
      { select: PRICE_FIELDS, take: null }
    )) as unknown as PriceRow[]
    const plan: Plan = {
      batch: { id: input.price_list_id, create: [], update: [], delete: [] },
      skipped: [],
    }
    for (const variant of variants) {
      const ofSet = prices.filter((price) => price.price_set_id === variant.setId)
      const base = ofSet.find((price) => !price.price_list_id && !price.rules_count)
      if (!base) {
        plan.skipped.push(variant.id)
        continue
      }
      const own = fromMedusaAmount(base.raw_amount ?? base.amount ?? 0, { allowRounding: true })
      const amount = Number(toMedusaAmount(multiplyByRateBps(own, BPS_PER_WHOLE - input.rate_bps)))
      const listed = ofSet.find((price) => price.price_list_id === input.price_list_id)
      const row = { variant_id: variant.id, currency_code: currency, amount }
      if (listed) {
        plan.batch.update.push({ id: listed.id, ...row })
      } else {
        plan.batch.create.push(row)
      }
    }
    return new StepResponse(plan)
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
    const plan = planDiscountStep(input)
    const data = transform({ plan }, ({ plan }) => plan.batch)
    batchPriceListPricesWorkflow.runAsStep({ input: { data } })
    return new WorkflowResponse(
      transform({ plan }, ({ plan }) => ({
        priced: plan.batch.create.length + plan.batch.update.length,
        skipped: plan.skipped,
      }))
    )
  }
)
