import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  beginReceiveReturnWorkflow,
  confirmReturnReceiveWorkflow,
  receiveItemReturnRequestWorkflow,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { RETURN_REQUESTS_MODULE } from "../../modules/return-requests"
import type ReturnRequestsModuleService from "../../modules/return-requests/service"
import { SHOP_FAULT_REASONS } from "../../modules/return-requests/states"
import { refundOrderWorkflow } from "../orders/refund-order"
import { returnsLockKey } from "./request-return"
import { readReturnRequestStep, updateReturnRequestStep } from "./steps/return-request"

/** Fired when a return's money is given back: the return invoice hangs off it (F8). */
export const RETURN_REFUNDED = "return.refunded"

/**
 * The parcel reached the warehouse (adr/0032): the lines that came back
 * received through Medusa's own receiving, which puts them back in stock,
 * and the request marked received. Its refund follows on its own
 * (`refundReturn`), so a refund that fails leaves the stock counted.
 */
export const receiveReturnWorkflow = createWorkflow(
  "returns-receive",
  (input: {
    id: string
    staff_id: string
    items: { line_item_id: string; quantity: number }[]
  }) => {
    const request = readReturnRequestStep({ id: input.id, status: "approved" })
    const lockKey = transform({ request }, ({ request }) => returnsLockKey(request.order_id))
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 120 })
    const returnId = transform({ request }, ({ request }) => request.return_id ?? "")
    beginReceiveReturnWorkflow.runAsStep({
      input: transform({ returnId, input }, ({ returnId, input }) => ({
        return_id: returnId,
        created_by: input.staff_id,
      })),
    })
    receiveItemReturnRequestWorkflow.runAsStep({
      input: transform({ returnId, input }, ({ returnId, input }) => ({
        return_id: returnId,
        items: input.items.map((item) => ({ id: item.line_item_id, quantity: item.quantity })),
      })),
    })
    confirmReturnReceiveWorkflow.runAsStep({
      input: transform({ returnId, input }, ({ returnId, input }) => ({
        return_id: returnId,
        confirmed_by: input.staff_id,
      })),
    })
    const received = updateReturnRequestStep(
      transform({ input }, ({ input }) => ({
        id: input.id,
        status: "received",
        received_items: input.items,
        received_at: new Date(),
      }))
    )
    releaseLockStep({ key: lockKey })
    return new WorkflowResponse(received)
  }
)

/** What came back may only be what was asked: each line once, no more of it. */
export function receivedProblem(
  asked: readonly { line_item_id: string; quantity: number }[],
  received: readonly { line_item_id: string; quantity: number }[]
): string | null {
  const limit = new Map(asked.map((line) => [line.line_item_id, line.quantity]))
  const ids = new Set(received.map((line) => line.line_item_id))
  return received.length === 0 ||
    ids.size !== received.length ||
    received.some(
      (line) => line.quantity < 1 || line.quantity > (limit.get(line.line_item_id) ?? 0)
    )
    ? "returns.items_invalid"
    : null
}

/**
 * Gives the money for what came back (adr/0032): through our refund, line
 * by line, under the request's own reference (tried again, refunded
 * once). Shipping comes back too when the shop was at fault. The request
 * is marked refunded and `return.refunded` announced.
 */
export async function refundReturn(
  container: MedusaContainer,
  input: { id: string; staff_id: string }
) {
  const service = container.resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
  const [request] = await service.listReturnRequests({ id: input.id }, { take: 1 })
  if (!request) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "returns.unknown")
  }
  if (request.status === "refunded") {
    return request
  }
  if (request.status !== "received") {
    throw new ValidationError("returns.status_invalid")
  }
  const reference = `return${request.id.replace(/[^A-Za-z0-9]/g, "")}`.slice(0, 40)
  const lines = (request.received_items ?? []) as unknown as {
    line_item_id: string
    quantity: number
  }[]
  const { result } = await refundOrderWorkflow(container).run({
    input: {
      order_id: request.order_id,
      reference,
      request: {
        items: lines.map((line) => ({ id: line.line_item_id, quantity: line.quantity })),
        shipping: SHOP_FAULT_REASONS.includes(request.reason),
      },
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
