import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../../lib/errors"
import { fromMedusaAmount } from "../../../lib/money"
import type { MedusaAmount } from "../../../lib/money"
import type { ExchangeLine } from "../../../lib/orders/exchanges"
import { quoteExchange } from "../exchange-quote"

/**
 * The swap as the shop approves it (adr/0032 §6): still possible, at the
 * difference staff were shown, and, when the shopper owes, collected
 * (staff say so). Checked before Medusa's exchange is opened.
 */
export const checkExchangeStep = createStep(
  "returns-check-exchange",
  async (
    input: {
      order_id: string
      exchange_items: ExchangeLine[]
      /** What staff were shown (kuruş, positive when the shopper owes). */
      shown: number | null
      collected: boolean
    },
    { container }
  ) => {
    const { problem, difference } = await quoteExchange(
      container,
      input.order_id,
      input.exchange_items
    )
    if (problem) {
      throw new ValidationError(problem)
    }
    if (difference !== input.shown) {
      throw new ValidationError("returns.exchange_price_changed")
    }
    if (difference > 0 && !input.collected) {
      throw new ValidationError("returns.exchange_difference_due")
    }
    return new StepResponse(difference)
  }
)

interface BalanceRow {
  summary?: { pending_difference?: MedusaAmount | null } | null
  items?: ({ id: string; unit_price: MedusaAmount } | null)[] | null
  shipping_methods?: ({ shipping_option_id?: string | null } | null)[] | null
  payment_collections?:
    | ({
        id: string
        status?: string | null
        amount?: MedusaAmount | null
        created_at?: string | Date | null
      } | null)[]
    | null
}

async function balanceOf(container: Pick<MedusaContainer, "resolve">, orderId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: [
      "summary",
      "items.id",
      "items.unit_price",
      // A price an order edit corrected reaches the item only with it (adr/0033)
      "items.detail.unit_price",
      "shipping_methods.shipping_option_id",
      "payment_collections.id",
      "payment_collections.status",
      "payment_collections.amount",
      "payment_collections.created_at",
    ],
    filters: { id: orderId },
  })
  return data[0] as BalanceRow | undefined
}

// Query may hand dates back as Date objects: compared by time, not by text
const timeOf = (value: unknown): number =>
  value instanceof Date || typeof value === "string" ? new Date(value).getTime() : 0

const pendingOf = (row: BalanceRow | undefined): number =>
  fromMedusaAmount(row?.summary?.pending_difference ?? 0, { allowRounding: true })

/**
 * The order before the swap: what Medusa's sums say is owed on it, and
 * the shipping option the new items go with (the order's own).
 */
export const exchangeStartStep = createStep(
  "returns-exchange-start",
  async (input: { order_id: string }, { container }) => {
    const row = await balanceOf(container, input.order_id)
    const optionId = (row?.shipping_methods ?? []).find(
      (method) => method?.shipping_option_id
    )?.shipping_option_id
    if (!optionId) {
      throw new ValidationError("returns.exchange_no_shipping")
    }
    return new StepResponse({ pending: pendingOf(row), shipping_option_id: optionId })
  }
)

/**
 * The swap as Medusa confirmed it: its difference, which must be the one
 * checked, the return it opened, and the payment collection Medusa opened
 * for what the shopper owes. Medusa adds the new items to what is owed at
 * once but takes the returned ones off only once they are received, so
 * the difference is what is owed now less before, less the returned
 * lines at their unit price (Medusa's own collection counts it so).
 */
export const exchangeSettledStep = createStep(
  "returns-exchange-settled",
  async (
    input: {
      order_id: string
      exchange_id: string
      pending_before: number
      expected: number
      returned: { line_item_id: string; quantity: number }[]
    },
    { container }
  ) => {
    const row = await balanceOf(container, input.order_id)
    const prices = new Map(
      (row?.items ?? []).flatMap((item) =>
        item ? [[item.id, fromMedusaAmount(item.unit_price, { allowRounding: true })] as const] : []
      )
    )
    const returned = input.returned.reduce(
      (sum, line) => sum + (prices.get(line.line_item_id) ?? 0) * line.quantity,
      0
    )
    const difference = pendingOf(row) - input.pending_before - returned
    if (difference !== input.expected) {
      throw new ValidationError("returns.exchange_price_changed")
    }
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order_exchange",
      fields: ["return_id"],
      filters: { id: input.exchange_id },
    })
    const collection = (row?.payment_collections ?? [])
      .filter((each) => each?.status === "not_paid")
      .sort((a, b) => timeOf(b?.created_at) - timeOf(a?.created_at))[0]
    // What Medusa asks the shopper for is the swap's cost alone, else an older balance rides along
    if (
      difference > 0 &&
      fromMedusaAmount(collection?.amount ?? 0, { allowRounding: true }) !== difference
    ) {
      throw new ValidationError("returns.exchange_balance_open")
    }
    return new StepResponse({
      difference,
      return_id: (data[0] as { return_id?: string | null } | undefined)?.return_id ?? null,
      payment_collection_id: collection?.id ?? null,
    })
  }
)
