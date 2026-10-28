import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../../lib/errors"
import { geliverApi, geliverCredentialsOf } from "../../../lib/shipping/geliver"
import { downloadLabel } from "../../../lib/shipping/geliver/labels"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../../modules/integration-credentials/service"
import { RETURN_REQUESTS_MODULE } from "../../../modules/return-requests"
import type ReturnRequestsModuleService from "../../../modules/return-requests/service"
import type { ExchangeLine } from "../../../lib/orders/exchanges"
import type { ReturnKind, ReturnStatus } from "../../../modules/return-requests/states"
import { SHIPMENT_TRACKING_MODULE } from "../../../modules/shipment-tracking"
import type ShipmentTrackingModuleService from "../../../modules/shipment-tracking/service"

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

const geliverAccount = async (container: Pick<MedusaContainer, "resolve">) =>
  geliverCredentialsOf(
    await container
      .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
      .read("geliver")
  )

type Parcel = Awaited<ReturnType<ShipmentTrackingModuleService["listTrackedShipments"]>>[number]

/**
 * The Geliver parcel the returned lines left in: the one that carried the
 * most of them, the latest on a tie (security review 2026-10-28: an order
 * in several parcels). Lines from two parcels come back on one label,
 * that of the parcel carrying most of them.
 */
async function parcelOfLines(
  container: Pick<MedusaContainer, "resolve">,
  orderId: string,
  lines: readonly { line_item_id: string; quantity: number }[]
): Promise<Parcel | null> {
  const parcels = await container
    .resolve<ShipmentTrackingModuleService>(SHIPMENT_TRACKING_MODULE)
    .listTrackedShipments(
      { order_id: orderId, provider: "geliver", status: { $ne: "canceled" } },
      { order: { created_at: "DESC" } }
    )
  if (parcels.length <= 1) {
    return parcels[0] ?? null
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "fulfillment",
    fields: ["id", "items.line_item_id", "items.quantity"],
    filters: { id: parcels.map((parcel) => parcel.fulfillment_id) },
  })
  const wanted = new Map(lines.map((line) => [line.line_item_id, line.quantity]))
  const carried = new Map(
    (
      data as {
        id: string
        items?: ({ line_item_id?: string | null; quantity?: unknown } | null)[] | null
      }[]
    ).map((fulfillment) => [
      fulfillment.id,
      (fulfillment.items ?? []).reduce(
        (sum, item) =>
          sum + Math.min(Number(item?.quantity) || 0, wanted.get(item?.line_item_id ?? "") ?? 0),
        0
      ),
    ])
  )
  // Newest first already: a later parcel wins only by carrying more
  return parcels.reduce((best, parcel) =>
    (carried.get(parcel.fulfillment_id) ?? 0) > (carried.get(best.fulfillment_id) ?? 0)
      ? parcel
      : best
  )
}

/**
 * The carrier's return for an order that went with Geliver (adr/0032): the
 * return of the parcel the lines left in opened and its label bought; its
 * code is what the shopper hands the parcel over with. Nothing for an
 * order the shop shipped itself. Undone by withdrawing the return at
 * Geliver.
 */
export const openCarrierReturnStep = createStep(
  "returns-open-carrier-return",
  async (
    input: { order_id: string; items: { line_item_id: string; quantity: number }[] },
    { container }
  ) => {
    const parcel = await parcelOfLines(container, input.order_id, input.items)
    if (!parcel) {
      return new StepResponse(null, null as string | null)
    }
    const account = await geliverAccount(container)
    if (!account) {
      throw new ValidationError("shipping.carrier_not_connected")
    }
    const answer = await geliverApi().createReturn(account, parcel.provider_shipment_id)
    const shipment = answer.shipment
    if (!shipment) {
      throw new ValidationError("returns.carrier_refused")
    }
    return new StepResponse(
      {
        shipment_id: shipment.id,
        code: shipment.barcode ?? shipment.trackingNumber ?? null,
        label_source: shipment.labelURL ?? null,
      },
      shipment.id
    )
  },
  async (shipmentId, { container }) => {
    const account = shipmentId ? await geliverAccount(container) : null
    if (shipmentId && account) {
      await geliverApi().cancelShipment(account, shipmentId)
    }
  }
)

/** The return label in private storage (it holds the shopper's address); undone by removing it. */
export const storeReturnLabelStep = createStep(
  "returns-store-label",
  async (input: { source: string | null }, { container }) => {
    if (!input.source) {
      return new StepResponse(null, null as string | null)
    }
    const pdf = await downloadLabel(input.source)
    const upload = await container.resolve(Modules.FILE).getUploadStream({
      filename: `iade-etiket-${randomUUID()}.pdf`,
      mimeType: "application/pdf",
      access: "private",
    })
    upload.writeStream.end(pdf)
    await upload.promise
    return new StepResponse(upload.fileKey, upload.fileKey)
  },
  async (fileKey, { container }) => {
    if (fileKey) {
      await container.resolve(Modules.FILE).deleteFiles(fileKey)
    }
  }
)
