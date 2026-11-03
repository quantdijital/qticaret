import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  beginReceiveReturnWorkflow,
  confirmReturnReceiveWorkflow,
  dismissItemReturnRequestWorkflow,
  emitEventStep,
  receiveItemReturnRequestWorkflow,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { ValidationError } from "../../lib/errors"
import { kurus } from "../../lib/money"
import { cameBack } from "../../lib/orders/returns"
import type { ReturnLine } from "../../lib/orders/returns"
import { shippingRefundDue } from "../../lib/orders/withdrawal-rules"
import type { RefusedLine } from "../../lib/orders/withdrawal-rules"
import { RETURN_REQUESTS_MODULE } from "../../modules/return-requests"
import type ReturnRequestsModuleService from "../../modules/return-requests/service"
import { refundOrderWorkflow } from "../orders/refund-order"
import { returnsLockKey } from "../../lib/orders/locks"
import { RETURN_REQUEST_REFUSED } from "./events"
import { readReceiptRulesStep } from "./steps/receipt"
import {
  readReturnRequestStep,
  returnRequestOrderStep,
  updateReturnRequestStep,
} from "./steps/return-request"

/** Fired when a return's money is given back: the return invoice hangs off it (F8). */
export const RETURN_REFUNDED = "return.refunded"

/** Fired when a parcel sent back is received: an exchange's two documents hang off it (F8 E6b). */
export const RETURN_RECEIVED = "return.received"

export interface ReceiveInput {
  id: string
  staff_id: string
  /** Back in sellable stock. */
  items: ReturnLine[]
  /** Came back broken: counted and refunded, never restocked (Medusa's dismissal). */
  damaged: ReturnLine[]
  /**
   * Came back but refused: a sealed good opened (MSY md. 15/1-ç). Left out
   * of Medusa's receiving and never refunded; the parcel goes back to the
   * shopper (adr/0032 Ek 2026-11-03).
   */
  refused: ReturnLine[]
  /**
   * The staff's call (adr/0032 §5) on the order's shipping, heard only for
   * lines outside the right of withdrawal: a withdrawal gives it back by
   * law (`shippingRefundDue`).
   */
  refund_shipping: boolean
}

const asMedusaLines = (lines: readonly ReturnLine[]) =>
  lines.map((line) => ({ id: line.line_item_id, quantity: line.quantity }))

/**
 * The parcel reached the warehouse (adr/0032): the lines that came back
 * received through Medusa's own receiving, which puts the sound ones back
 * in stock and leaves the damaged ones out, and the request marked
 * received, with what was refused and whether the order's shipping comes
 * back (Ek 2026-11-03: a withdrawal's always, MSY md. 12/1). Its refund
 * follows on its own (`refundReturn`), so a refund that fails leaves the
 * stock counted. Read under the order's returns lock: a second receive
 * finds it received already.
 */
export const receiveReturnWorkflow = createWorkflow("returns-receive", (input: ReceiveInput) => {
  const orderId = returnRequestOrderStep({ id: input.id })
  const lockKey = transform({ orderId }, ({ orderId }) => returnsLockKey(orderId))
  acquireLockStep({ key: lockKey, timeout: 10, ttl: 120 })
  const request = readReturnRequestStep({ id: input.id, status: "approved" })
  const rules = readReceiptRulesStep(
    transform({ input, request }, ({ input, request }) => ({
      id: input.id,
      order_id: request.order_id,
      refused: input.refused,
    }))
  )
  const returnId = transform({ request }, ({ request }) => request.return_id ?? "")
  beginReceiveReturnWorkflow.runAsStep({
    input: transform({ returnId, input }, ({ returnId, input }) => ({
      return_id: returnId,
      created_by: input.staff_id,
    })),
  })
  when("returns-receive-sound", { input }, ({ input }) => input.items.length > 0).then(() => {
    receiveItemReturnRequestWorkflow.runAsStep({
      input: transform({ returnId, input }, ({ returnId, input }) => ({
        return_id: returnId,
        items: asMedusaLines(input.items),
      })),
    })
  })
  when("returns-receive-damaged", { input }, ({ input }) => input.damaged.length > 0).then(() => {
    dismissItemReturnRequestWorkflow.runAsStep({
      input: transform({ returnId, input }, ({ returnId, input }) => ({
        return_id: returnId,
        items: asMedusaLines(input.damaged),
      })),
    })
  })
  confirmReturnReceiveWorkflow.runAsStep({
    input: transform({ returnId, input }, ({ returnId, input }) => ({
      return_id: returnId,
      confirmed_by: input.staff_id,
    })),
  })
  const received = updateReturnRequestStep(
    transform({ input, request, rules }, ({ input, request, rules }) => ({
      id: input.id,
      from: "approved" as const,
      changes: {
        status: "received",
        received_items: input.items,
        damaged_items: input.damaged,
        refused_items: input.refused.length
          ? input.refused.map((line): RefusedLine => ({ ...line, reason: "unsealed" }))
          : null,
        refund_shipping: shippingRefundDue({
          kind: request.kind,
          accepted: [...input.items, ...input.damaged],
          excluded: new Set(rules.excluded),
          staff_choice: input.refund_shipping,
          refunded_before: rules.shipping_refunded_before,
        }),
        received_at: new Date(),
      },
    }))
  )
  const announced = transform({ received }, ({ received }) => ({
    id: received.id,
    order_id: received.order_id,
    kind: received.kind,
  }))
  emitEventStep({ eventName: RETURN_RECEIVED, data: announced })
  // Units refused: the shopper is told which and why, the only word when nothing else came
  when("returns-receive-refused", { input }, ({ input }) => input.refused.length > 0).then(() => {
    emitEventStep({ eventName: RETURN_REQUEST_REFUSED, data: announced }).config({
      name: "returns-emit-refused",
    })
  })
  releaseLockStep({ key: lockKey })
  return new WorkflowResponse(received)
})

/**
 * What came back may only be what was asked: each line once in each list,
 * sound, damaged and refused together no more than asked of it, something
 * at all.
 */
export function receivedProblem(
  asked: readonly ReturnLine[],
  sound: readonly ReturnLine[],
  damaged: readonly ReturnLine[],
  refused: readonly ReturnLine[] = []
): string | null {
  const limit = new Map(asked.map((line) => [line.line_item_id, line.quantity]))
  const unique = (lines: readonly ReturnLine[]) =>
    new Set(lines.map((line) => line.line_item_id)).size === lines.length
  const every = [...sound, ...damaged, ...refused]
  const total = new Map<string, number>()
  for (const line of every) {
    total.set(line.line_item_id, (total.get(line.line_item_id) ?? 0) + line.quantity)
  }
  return total.size === 0 ||
    !unique(sound) ||
    !unique(damaged) ||
    !unique(refused) ||
    every.some((line) => line.quantity < 1) ||
    [...total].some(([id, quantity]) => quantity > (limit.get(id) ?? 0))
    ? "returns.items_invalid"
    : null
}

/** Every unit asked came back, sound or damaged. */
export function receivedWhole(
  asked: unknown,
  sound: readonly ReturnLine[],
  damaged: readonly ReturnLine[]
): boolean {
  const came = new Map<string, number>()
  for (const line of [...sound, ...damaged]) {
    came.set(line.line_item_id, (came.get(line.line_item_id) ?? 0) + line.quantity)
  }
  return (asked as ReturnLine[]).every((line) => came.get(line.line_item_id) === line.quantity)
}

/**
 * Gives the money for what came back, sound or damaged (adr/0032): through
 * our refund, line by line, under the request's own reference (tried
 * again, refunded once), with the shipping when staff said so on receipt.
 * An exchange (§6) gives back what the shop owes on the swap, and only
 * when it owes. Under the order's returns lock, so two clicks refund once
 * and `return.refunded` is announced once, as the request turns refunded.
 */
export async function refundReturn(
  container: MedusaContainer,
  input: { id: string; staff_id: string }
) {
  const service = container.resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
  const [found] = await service.listReturnRequests(
    { id: input.id },
    { take: 1, select: ["order_id"] }
  )
  if (!found) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "returns.unknown")
  }
  return container.resolve(Modules.LOCKING).execute(
    returnsLockKey(found.order_id),
    async () => {
      const [request] = await service.listReturnRequests({ id: input.id }, { take: 1 })
      if (request?.status === "refunded") {
        return request
      }
      const owed = request?.kind === "exchange" ? -(request.difference ?? 0) : null
      if (request?.status !== "received" || (owed !== null && owed <= 0)) {
        throw new ValidationError("returns.status_invalid")
      }
      const reference = `return${request.id.replace(/[^A-Za-z0-9]/g, "")}`.slice(0, 40)
      const { result } = await refundOrderWorkflow(container).run({
        input: {
          order_id: request.order_id,
          reference,
          request:
            owed === null
              ? { items: asMedusaLines(cameBack(request)), shipping: request.refund_shipping }
              : { balance: kurus(owed) },
          note: `return ${request.id}`,
          created_by: input.staff_id,
        },
      })
      const amount = result.amount
      const refunded = await service.updateReturnRequests({
        id: request.id,
        status: "refunded",
        refund_reference: reference,
        refund_amount: amount,
      })
      await container.resolve(Modules.EVENT_BUS).emit({
        name: RETURN_REFUNDED,
        data: { id: request.id, order_id: request.order_id, amount, reference },
      })
      return refunded
    },
    { timeout: 30 }
  )
}

/** Turns down a request still waiting for the shop's decision (adr/0032), with a note for the shopper. */
export async function rejectReturn(
  container: MedusaContainer,
  input: { id: string; staff_id: string; note: string }
) {
  const service = container.resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
  const [request] = await service.listReturnRequests({ id: input.id }, { take: 1 })
  if (!request) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "returns.unknown")
  }
  return container.resolve(Modules.LOCKING).execute(
    returnsLockKey(request.order_id),
    async () => {
      const [current] = await service.listReturnRequests({ id: input.id }, { take: 1 })
      if (current?.status !== "requested") {
        throw new ValidationError("returns.status_invalid")
      }
      return service.updateReturnRequests({
        id: input.id,
        status: "rejected",
        decided_by: input.staff_id,
        decided_at: new Date(),
        decision_note: input.note,
      })
    },
    { timeout: 10 }
  )
}
