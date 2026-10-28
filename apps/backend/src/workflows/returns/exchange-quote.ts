import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  QueryContext,
} from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { returnsLockKey } from "../../lib/orders/locks"
import { fromMedusaAmount } from "../../lib/money"
import type { MedusaAmount } from "../../lib/money"
import { exchangeDifference, exchangeProblem } from "../../lib/orders/exchanges"
import type { ExchangeLine, ExchangeOrderLine, ExchangeVariant } from "../../lib/orders/exchanges"
import { RETURN_REQUESTS_MODULE } from "../../modules/return-requests"
import { readOrderMoney } from "../orders/order-money"
import type ReturnRequestsModuleService from "../../modules/return-requests/service"

interface OrderRow {
  currency_code: string
  region_id?: string | null
  customer_id?: string | null
  items?:
    | ({
        id: string
        product_id?: string | null
        variant_id?: string | null
        unit_price: MedusaAmount
      } | null)[]
    | null
}

interface VariantRow {
  id: string
  product_id: string
  manage_inventory?: boolean | null
  allow_backorder?: boolean | null
  calculated_price?: { calculated_amount?: MedusaAmount | null } | null
  inventory_items?:
    | ({
        required_quantity?: number | null
        inventory?: {
          location_levels?: ({ available_quantity?: unknown } | null)[] | null
        } | null
      } | null)[]
    | null
}

const kurusOf = (amount: MedusaAmount) => fromMedusaAmount(amount, { allowRounding: true })

// Unlimited: Medusa promises it without counting
const UNLIMITED = Number.MAX_SAFE_INTEGER

function availableOf(variant: VariantRow): number {
  if (variant.manage_inventory === false || variant.allow_backorder) {
    return UNLIMITED
  }
  // A variant made of several items is as available as its scarcest one
  return Math.min(
    ...(variant.inventory_items ?? []).map((item) => {
      const units = (item?.inventory?.location_levels ?? []).reduce(
        (sum, level) => sum + Math.max(0, Number(level?.available_quantity) || 0),
        0
      )
      return Math.floor(units / Math.max(1, item?.required_quantity ?? 1))
    }),
    UNLIMITED
  )
}

/**
 * What a swap is and costs now (adr/0032 §6): the order's lines and the
 * wanted variants priced as Medusa would price a new line of the order
 * (its currency, region and customer: price lists included), checked by
 * `exchangeProblem`. The difference is in kuruş, positive when the
 * shopper owes. Reads only.
 */
export async function quoteExchange(
  container: MedusaContainer,
  orderId: string,
  wanted: readonly ExchangeLine[]
): Promise<{ problem: string | null; difference: number }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "currency_code",
      "region_id",
      "customer_id",
      "items.id",
      "items.product_id",
      "items.variant_id",
      "items.unit_price",
      // A price an order edit corrected reaches the item only with it (adr/0033)
      "items.detail.unit_price",
    ],
    filters: { id: orderId },
  })
  const order = orders[0] as OrderRow | undefined
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
  }
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "product_id",
      "manage_inventory",
      "allow_backorder",
      "calculated_price.calculated_amount",
      "inventory_items.required_quantity",
      "inventory_items.inventory.location_levels.available_quantity",
    ],
    filters: { id: [...new Set(wanted.map((line) => line.variant_id))] },
    context: {
      calculated_price: QueryContext({
        currency_code: order.currency_code,
        ...(order.region_id ? { region_id: order.region_id } : {}),
        ...(order.customer_id ? { customer_id: order.customer_id } : {}),
      }),
    },
  })
  const { lines: shares } = await readOrderMoney(container, orderId)
  const discounted = new Set(
    shares.filter((line) => line.kind === "item" && line.discount > 0).map((line) => line.id)
  )
  const lines = new Map<string, ExchangeOrderLine>(
    (order.items ?? []).flatMap((item) =>
      item
        ? [
            [
              item.id,
              {
                id: item.id,
                product_id: item.product_id ?? null,
                variant_id: item.variant_id ?? null,
                unit_price: kurusOf(item.unit_price),
                discounted: discounted.has(item.id),
              },
            ] as const,
          ]
        : []
    )
  )
  const priced = new Map<string, ExchangeVariant>(
    (variants as unknown as VariantRow[]).map((variant) => {
      const amount = variant.calculated_price?.calculated_amount
      return [
        variant.id,
        {
          id: variant.id,
          product_id: variant.product_id,
          price: amount === null || amount === undefined ? null : kurusOf(amount),
          available: availableOf(variant),
        },
      ]
    })
  )
  return {
    problem: exchangeProblem(lines, priced, wanted),
    difference: exchangeDifference(lines, priced, wanted),
  }
}

/**
 * Before a swap is approved: still possible, at the cost staff were
 * shown. A cost that moved (a price changed) is kept as the new quote and
 * refused, so staff see it before they approve (`returns.exchange_price_changed`).
 */
export async function requoteExchange(
  container: MedusaContainer,
  request: { id: string; order_id: string }
): Promise<void> {
  const service = container.resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
  // Under the returns lock, and only while it waits: an approved swap keeps its cost
  await container.resolve(Modules.LOCKING).execute(
    returnsLockKey(request.order_id),
    async () => {
      const [current] = await service.listReturnRequests({ id: request.id }, { take: 1 })
      if (current?.status !== "requested") {
        throw new ValidationError("returns.status_invalid")
      }
      const { problem, difference } = await quoteExchange(
        container,
        current.order_id,
        (current.exchange_items ?? []) as unknown as ExchangeLine[]
      )
      if (problem) {
        throw new ValidationError(problem)
      }
      if (difference !== current.difference) {
        await service.updateReturnRequests({ id: current.id, difference })
        throw new ValidationError("returns.exchange_price_changed")
      }
    },
    { timeout: 10 }
  )
}
