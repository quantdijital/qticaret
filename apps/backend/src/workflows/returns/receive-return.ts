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
  receiveItemReturnRequestWorkflow,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { ValidationError } from "../../lib/errors"
import { cameBack } from "../../lib/orders/returns"
import type { ReturnLine } from "../../lib/orders/returns"
import { RETURN_REQUESTS_MODULE } from "../../modules/return-requests"
import type ReturnRequestsModuleService from "../../modules/return-requests/service"
import { refundOrderWorkflow } from "../orders/refund-order"
import { returnsLockKey } from "./request-return"
import {
  readReturnRequestStep,
  returnRequestOrderStep,
  updateReturnRequestStep,
} from "./steps/return-request"

/** Fired when a return's money is given back: the return invoice hangs off it (F8). */
export const RETURN_REFUNDED = "return.refunded"

export interface ReceiveInput {
  id: string
  staff_id: string
  /** Back in sellable stock. */
  items: ReturnLine[]
  /** Came back broken: counted and refunded, never restocked (Medusa's dismissal). */
  damaged: ReturnLine[]
  /** The staff's call (adr/0032 §5): the parcel's shipping comes back too. */
  refund_shipping: boolean
}

const asMedusaLines = (lines: readonly ReturnLine[]) =>
  lines.map((line) => ({ id: line.line_item_id, quantity: line.quantity }))

/**
 * The parcel reached the warehouse (adr/0032): the lines that came back
 * received through Medusa's own receiving, which puts the sound ones back
 * in stock and leaves the damaged ones out, and the request marked
 * received. Its refund follows on its own (`refundReturn`), so a refund
 * that fails leaves the stock counted. Read under the order's returns
 * lock: a second receive finds it received already.
 */
export const receiveReturnWorkflow = createWorkflow("returns-receive", (input: ReceiveInput) => {
  const orderId = returnRequestOrderStep({ id: input.id })
  const lockKey = transform({ orderId }, ({ orderId }) => returnsLockKey(orderId))
  acquireLockStep({ key: lockKey, timeout: 10, ttl: 120 })
  const request = readReturnRequestStep({ id: input.id, status: "approved" })
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
    transform({ input }, ({ input }) => ({
      id: input.id,
      from: "approved" as const,
      changes: {
        status: "received",
        received_items: input.items,
        damaged_items: input.damaged,
        refund_shipping: input.refund_shipping,
        received_at: new Date(),
      },
    }))
  )
  releaseLockStep({ key: lockKey })
  return new WorkflowResponse(received)
})

/**
 * What came back may only be what was asked: each line once in each list,
 * sound and damaged together no more than asked of it, something at all.
 */
export function receivedProblem(
  asked: readonly ReturnLine[],
  sound: readonly ReturnLine[],
  damaged: readonly ReturnLine[]
): string | null {
  const limit = new Map(asked.map((line) => [line.line_item_id, line.quantity]))
  const unique = (lines: readonly ReturnLine[]) =>
    new Set(lines.map((line) => line.line_item_id)).size === lines.length
  const total = new Map<string, number>()
  for (const line of [...sound, ...damaged]) {
    total.set(line.line_item_id, (total.get(line.line_item_id) ?? 0) + line.quantity)
  }
  return total.size === 0 ||
    !unique(sound) ||
    !unique(damaged) ||
    [...sound, ...damaged].some((line) => line.quantity < 1) ||
    [...total].some(([id, quantity]) => quantity > (limit.get(id) ?? 0))
    ? "returns.items_invalid"
    : null
}

/**
 * Gives the money for what came back, sound or damaged (adr/0032): through
 * our refund, line by line, under the request's own reference (tried
 * again, refunded once), with the shipping when staff said so on receipt.
 * Under the order's returns lock, so two clicks refund once and
 * `return.refunded` is announced once, as the request turns refunded.
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
      if (request?.status !== "received") {
        throw new ValidationError("returns.status_invalid")
      }
      const reference = `return${request.id.replace(/[^A-Za-z0-9]/g, "")}`.slice(0, 40)
      const { result } = await refundOrderWorkflow(container).run({
        input: {
          order_id: request.order_id,
          reference,
          request: {
            items: asMedusaLines(cameBack(request)),
            shipping: request.refund_shipping,
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
