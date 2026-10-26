import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { chunksOf } from "../../../lib/catalog"
import { fromMedusaAmount } from "../../../lib/money"
import { PRICE_HISTORY_MODULE } from "../../../modules/price-history"
import type PriceHistoryModuleService from "../../../modules/price-history/service"
import type { PriceRecordInput, PriceRecordReason } from "../../../modules/price-history/service"
import { sellingPrices } from "../selling-prices"

export interface RecordSellingPricesInput {
  variant_ids: string[]
  reason: PriceRecordReason
}

// Variants priced per query
const VARIANT_CHUNK = 100

const kurus = (amount: number | string) => fromMedusaAmount(amount, { allowRounding: true })

async function currencies(container: MedusaContainer): Promise<string[]> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "store",
    fields: ["supported_currencies.currency_code"],
  })
  const store = data[0] as { supported_currencies?: { currency_code: string }[] } | undefined
  return [...new Set((store?.supported_currencies ?? []).map((each) => each.currency_code))]
}

async function changedPrices(
  container: MedusaContainer,
  ids: string[],
  currency: string,
  reason: PriceRecordReason
): Promise<PriceRecordInput[]> {
  const history = container.resolve<PriceHistoryModuleService>(PRICE_HISTORY_MODULE)
  const last = new Map(
    (await history.lastPrices(ids, [currency])).map((row) => [row.variant_id, row])
  )
  return (await sellingPrices(container, ids, currency)).flatMap((variant) => {
    const price = variant.calculated_price
    const amount = price?.calculated_amount
    if (amount === null || amount === undefined) {
      // No price in this currency: nothing a shopper could pay to record
      return []
    }
    const original = price?.original_amount ?? amount
    const listId = price?.calculated_price?.price_list_id ?? null
    const known = last.get(variant.id)
    const same =
      known !== undefined &&
      kurus(known.amount) === kurus(amount) &&
      kurus(known.original_amount) === kurus(original) &&
      known.price_list_id === listId
    return same
      ? []
      : [
          {
            variant_id: variant.id,
            currency_code: currency,
            amount,
            original_amount: original,
            price_list_id: listId,
            reason,
          },
        ]
  })
}

/**
 * Records each variant's selling price in every currency of the shop where
 * it differs from the last one recorded (F4.2, ADR-0023). Reading the
 * price rather than trusting an event makes a repeated or late event
 * harmless: it finds nothing new. Two runs at once may both write the same
 * change; equal rows change no reading of the history.
 *
 * No compensation: a row records a price that already applied.
 */
export const recordSellingPricesStep = createStep(
  "price-history-record",
  async (input: RecordSellingPricesInput, { container }) => {
    const ids = [...new Set(input.variant_ids)]
    let recorded = 0
    for (const currency of await currencies(container)) {
      for (const chunk of chunksOf(ids, VARIANT_CHUNK)) {
        const rows = await changedPrices(container, chunk, currency, input.reason)
        await container.resolve<PriceHistoryModuleService>(PRICE_HISTORY_MODULE).recordPrices(rows)
        recorded += rows.length
      }
    }
    return new StepResponse(recorded)
  }
)
