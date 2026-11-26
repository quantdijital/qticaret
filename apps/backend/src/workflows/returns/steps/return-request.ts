import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../../lib/errors"
import { RETURN_REQUESTS_MODULE } from "../../../modules/return-requests"
import type ReturnRequestsModuleService from "../../../modules/return-requests/service"
import type { ExchangeLine } from "../../../lib/orders/exchanges"
import type { ReturnKind, ReturnStatus } from "../../../modules/return-requests/states"

// Query may hand dates back as Date objects: compared by time, not by text
const timeOf = (value: unknown): number =>
  value instanceof Date || typeof value === "string" ? new Date(value).getTime() : 0

const requests = (container: Pick<MedusaContainer, "resolve">) =>
  container.resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)

export interface RequestFacts {
  id: string
  order_id: string
  kind: ReturnKind
  status: ReturnStatus
  items: { line_item_id: string; quantity: number }[]
  exchange_items: ExchangeLine[] | null
  /** An exchange's cost as quoted (kuruş, positive when the shopper owes). */
  difference: number | null
  return_id: string | null
  /** Where the parcel comes back to: the warehouse it left from, else the shop's default. */
  location_id: string | null
}

/**
 * The order a request belongs to: what its lock is taken on before the
 * request is read for its status (security review 2026-10-28: a status
 * read before the lock lets two clicks both act on it).
 */
export const returnRequestOrderStep = createStep(
  "returns-request-order",
  async (input: { id: string }, { container }) => {
    const [request] = await requests(container).listReturnRequests(
      { id: input.id },
      { take: 1, select: ["order_id"] }
    )
    if (!request) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "returns.unknown")
    }
    return new StepResponse(request.order_id)
  }
)

/** The request, in the status the step after needs it in; refused otherwise. Read under its lock. */
export const readReturnRequestStep = createStep(
  "returns-read-request",
  async (input: { id: string; status: ReturnStatus }, { container }) => {
    const [request] = await requests(container).listReturnRequests({ id: input.id }, { take: 1 })
    if (!request) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "returns.unknown")
    }
    if (request.status !== input.status) {
      throw new ValidationError("returns.status_invalid")
    }
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const [{ data: orders }, { data: stores }] = await Promise.all([
      query.graph({
        entity: "order",
        fields: ["fulfillments.location_id", "fulfillments.canceled_at", "fulfillments.created_at"],
        filters: { id: request.order_id },
      }),
      query.graph({ entity: "store", fields: ["default_location_id"] }),
    ])
    const left = (
      (
        orders[0] as
          | {
              fulfillments?: ({
                location_id?: string | null
                canceled_at?: unknown
                created_at?: string
              } | null)[]
            }
          | undefined
      )?.fulfillments ?? []
    )
      .filter((fulfillment) => fulfillment && !fulfillment.canceled_at && fulfillment.location_id)
      .sort((a, b) => timeOf(b?.created_at) - timeOf(a?.created_at))[0]?.location_id
    return new StepResponse<RequestFacts>({
      id: request.id,
      order_id: request.order_id,
      status: request.status,
      kind: request.kind,
      items: request.items as unknown as RequestFacts["items"],
      exchange_items: request.exchange_items as unknown as ExchangeLine[] | null,
      difference: request.difference,
      return_id: request.return_id,
      location_id:
        left ??
        (stores[0] as { default_location_id?: string | null } | undefined)?.default_location_id ??
        null,
    })
  }
)

/**
 * Writes the request's new state, only from the status it was read in
 * (`from`); undone by writing back the fields it changed.
 */
export const updateReturnRequestStep = createStep(
  "returns-update-request",
  async (
    input: { id: string; from: ReturnStatus; changes: Record<string, unknown> },
    { container }
  ) => {
    const [before] = await requests(container).listReturnRequests({ id: input.id }, { take: 1 })
    if (before?.status !== input.from) {
      throw new ValidationError("returns.status_invalid")
    }
    const updated = await requests(container).updateReturnRequests({
      id: input.id,
      ...input.changes,
    })
    const previous = Object.fromEntries(
      Object.keys(input.changes).map((key) => [key, (before as Record<string, unknown>)[key]])
    )
    return new StepResponse(updated, { id: input.id, ...previous })
  },
  async (previous, { container }) => {
    if (previous) {
      await requests(container).updateReturnRequests(previous)
    }
  }
)
