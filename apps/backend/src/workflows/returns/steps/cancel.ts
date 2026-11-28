import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../../lib/errors"
import { RETURN_REQUESTS_MODULE } from "../../../modules/return-requests"
import type ReturnRequestsModuleService from "../../../modules/return-requests/service"
import type { ReturnKind } from "../../../modules/return-requests/states"

type Container = Pick<MedusaContainer, "resolve">

const requests = (container: Container) =>
  container.resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)

/** An approved request as its cancel needs it: what Medusa opened for it. */
export interface CancellableRequest {
  id: string
  order_id: string
  kind: ReturnKind
  return_id: string | null
  exchange_id: string | null
}

interface ReturnRow {
  status?: string | null
  canceled_at?: unknown
  items?: ({ received_quantity?: unknown; damaged_quantity?: unknown } | null)[] | null
}

/**
 * Whether an approved request can still be cancelled (the panel's
 * "İsteği iptal et"), read under the order's returns lock: approved, its
 * parcel not handed to the carrier yet (`handed_over_at`), nothing of it
 * received in Medusa's return, and for an exchange nothing collected
 * from the shopper (a difference staff took by hand goes back by hand).
 */
export async function cancellableRequest(
  container: Container,
  id: string
): Promise<CancellableRequest> {
  const [request] = await requests(container).listReturnRequests({ id }, { take: 1 })
  if (!request) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "returns.unknown")
  }
  if (request.status !== "approved") {
    throw new ValidationError("returns.status_invalid")
  }
  if (request.handed_over_at) {
    throw new ValidationError("returns.cancel_handed_over")
  }
  if (request.kind === "exchange" && (request.difference ?? 0) > 0) {
    throw new ValidationError("returns.cancel_exchange_collected")
  }
  if (request.return_id) {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "return",
      fields: ["status", "canceled_at", "items.received_quantity", "items.damaged_quantity"],
      filters: { id: request.return_id },
    })
    const found = data[0] as ReturnRow | undefined
    const came = (found?.items ?? []).some(
      (item) => Number(item?.received_quantity ?? 0) > 0 || Number(item?.damaged_quantity ?? 0) > 0
    )
    if (came || (found?.status ?? "") === "received") {
      throw new ValidationError("returns.cancel_received")
    }
  }
  return {
    id: request.id,
    order_id: request.order_id,
    kind: request.kind,
    return_id: request.return_id,
    exchange_id: request.exchange_id,
  }
}

export const readCancellableRequestStep = createStep(
  "returns-read-cancellable",
  async (input: { id: string }, { container }) =>
    new StepResponse(await cancellableRequest(container, input.id))
)

/**
 * The order's requests still waiting for the shop's decision, closed as
 * its cancel goes through (adr/0025, 2026-11-03): a gift card line's
 * withdrawal asked on a cancelled order has nothing left to withdraw,
 * its cards voided by the cancel itself. Cancelled with the order's cancel
 * as the cause, by no one; undone by opening them again.
 */
export const closeWaitingRequestsStep = createStep(
  "returns-close-waiting",
  async (input: { order_id: string }, { container }) => {
    const waiting = await requests(container).listReturnRequests(
      { order_id: input.order_id, status: "requested" },
      { select: ["id"] }
    )
    if (waiting.length === 0) {
      return new StepResponse(0, [] as string[])
    }
    const now = new Date()
    await requests(container).updateReturnRequests(
      waiting.map((request) => ({
        id: request.id,
        status: "canceled" as const,
        canceled_at: now,
        canceled_by: null,
        cancel_cause: "order_canceled" as const,
        cancel_reason: null,
      }))
    )
    return new StepResponse(
      waiting.length,
      waiting.map((request) => request.id)
    )
  },
  async (ids, { container }) => {
    if (ids?.length) {
      await requests(container).updateReturnRequests(
        ids.map((id) => ({
          id,
          status: "requested" as const,
          canceled_at: null,
          canceled_by: null,
          cancel_cause: null,
          cancel_reason: null,
        }))
      )
    }
  }
)
