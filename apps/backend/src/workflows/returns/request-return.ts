import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { returnsLockKey } from "../../lib/orders/locks"
import {
  RETURN_ORDER_FIELDS,
  cameBack,
  linesProblem,
  returnable,
  windowOpen,
  withdrawalProblem,
} from "../../lib/orders/returns"
import type { ExchangeLine } from "../../lib/orders/exchanges"
import { giftReturnProblem, giftReturnable } from "../../lib/orders/gift-returns"
import type { ReturnLine, ReturnOrderFacts } from "../../lib/orders/returns"
import { ORDER_REFUNDS_MODULE } from "../../modules/order-refunds"
import type OrderRefundsModuleService from "../../modules/order-refunds/service"
import { RETURN_REQUESTS_MODULE } from "../../modules/return-requests"
import type ReturnRequestsModuleService from "../../modules/return-requests/service"
import { COUNTED_RETURN_STATUSES, OPEN_RETURN_STATUSES } from "../../modules/return-requests/states"
import type { ReturnKind, ReturnReason } from "../../modules/return-requests/states"
import { RETURN_REQUEST_CREATED } from "./events"
import type { ReturnRequestEvent } from "./events"
import { quoteExchange } from "./exchange-quote"
import { giftLinesOf } from "./gift-lines"
import { excludedLines, returnPolicy } from "./policy"

/**
 * A shopper asks to send lines of their own order back (F7.9, adr/0032):
 * shipped lines, within the window, no more than is left after earlier
 * requests, one request at a time. An exchange (§6) names another variant
 * of the same product for each line, in stock; what it costs is quoted
 * on the server and kept. Gift card lines (adr/0025, 2026-11-03) come
 * back on their own, as money back, within the period from the day their
 * cards were sent and while none was spent (`giftReturnProblem`). Under
 * the order's returns lock.
 */
export async function requestReturn(
  container: MedusaContainer,
  input: {
    order_id: string
    customer_id: string
    kind: ReturnKind
    /** For an exchange, each with the variant it goes back for. */
    items: (ReturnLine & { variant_id?: string | undefined })[]
    reason: ReturnReason
    note: string | null
  },
  now = new Date()
) {
  return container.resolve(Modules.LOCKING).execute(
    returnsLockKey(input.order_id),
    async () => {
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "order",
        fields: ["customer_id", "status", ...RETURN_ORDER_FIELDS],
        filters: { id: input.order_id },
      })
      const order = data[0] as
        (ReturnOrderFacts & { customer_id?: string | null; status?: string }) | undefined
      if (order?.customer_id !== input.customer_id) {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
      }
      const policy = await returnPolicy(container)
      const lines = input.items.map(({ line_item_id, quantity }) => ({ line_item_id, quantity }))
      const gifts = await giftLinesOf(container, order.items ?? [])
      const giftProblem = giftReturnProblem(lines, gifts, input, now, policy.withdrawal_days)
      const giftRequest = lines.some((line) => gifts.has(line.line_item_id))
      if (
        order.status === "canceled" ||
        giftProblem === "returns.window_closed" ||
        (!giftRequest && !windowOpen(order, now, policy.withdrawal_days))
      ) {
        throw new ValidationError("returns.window_closed")
      }
      if (giftProblem) {
        throw new ValidationError(giftProblem, { field: "items" })
      }
      const service = container.resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
      const earlier = await service.listReturnRequests(
        { order_id: input.order_id, status: [...COUNTED_RETURN_STATUSES] },
        { select: ["status", "items", "received_items", "damaged_items"] }
      )
      if (
        earlier.some((request) =>
          (OPEN_RETURN_STATUSES as readonly string[]).includes(request.status)
        )
      ) {
        throw new ValidationError("returns.already_open")
      }
      // A request that came back counts what came back; one still open, what it asked
      const asked = earlier.flatMap(cameBack)
      const kept = await container
        .resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
        .keptUnits(input.order_id)
      const left = returnable(order, asked, kept)
      // A gift card line is never shipped: what is left of it is its cards
      for (const gift of gifts.values()) {
        const taken = asked
          .filter((line) => line.line_item_id === gift.line_id)
          .reduce((sum, line) => sum + line.quantity, 0)
        left.set(gift.line_id, giftReturnable(gift, taken, kept.get(gift.line_id) ?? 0))
      }
      const problem =
        linesProblem(left, lines) ??
        withdrawalProblem(lines, await excludedLines(container, order.items ?? [], gifts), input)
      if (problem) {
        throw new ValidationError(problem, { field: "items" })
      }
      const swaps: ExchangeLine[] | null =
        input.kind === "exchange"
          ? input.items.map((item) => ({
              line_item_id: item.line_item_id,
              quantity: item.quantity,
              variant_id: item.variant_id ?? "",
            }))
          : null
      const quote = swaps ? await quoteExchange(container, input.order_id, swaps) : null
      if (quote?.problem) {
        throw new ValidationError(quote.problem, { field: "items" })
      }
      const created = await service.createReturnRequests({
        order_id: input.order_id,
        customer_id: input.customer_id,
        kind: input.kind,
        reason: input.reason,
        note: input.note,
        items: lines as unknown as Record<string, unknown>,
        exchange_items: swaps as unknown as Record<string, unknown> | null,
        difference: quote?.difference ?? null,
      })
      const event: ReturnRequestEvent = {
        id: created.id,
        order_id: input.order_id,
        kind: input.kind,
      }
      await container.resolve(Modules.EVENT_BUS).emit({ name: RETURN_REQUEST_CREATED, data: event })
      return created
    },
    { timeout: 10 }
  )
}
