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
import type { ReturnStatus } from "../../../modules/return-requests/states"
import { SHIPMENT_TRACKING_MODULE } from "../../../modules/shipment-tracking"
import type ShipmentTrackingModuleService from "../../../modules/shipment-tracking/service"

const requests = (container: Pick<MedusaContainer, "resolve">) =>
  container.resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)

export interface RequestFacts {
  id: string
  order_id: string
  status: ReturnStatus
  items: { line_item_id: string; quantity: number }[]
  return_id: string | null
  /** Where the parcel comes back to: the warehouse it left from, else the shop's default. */
  location_id: string | null
}

/** The request, in the status the step after needs it in; refused otherwise. */
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
      .sort((a, b) => String(b?.created_at).localeCompare(String(a?.created_at)))[0]?.location_id
    return new StepResponse<RequestFacts>({
      id: request.id,
      order_id: request.order_id,
      status: request.status,
      items: request.items as unknown as RequestFacts["items"],
      return_id: request.return_id,
      location_id:
        left ??
        (stores[0] as { default_location_id?: string | null } | undefined)?.default_location_id ??
        null,
    })
  }
)

/** Writes the request's new state; undone by writing back the fields it changed. */
export const updateReturnRequestStep = createStep(
  "returns-update-request",
  async (input: { id: string } & Record<string, unknown>, { container }) => {
    const [before] = await requests(container).listReturnRequests({ id: input.id }, { take: 1 })
    const updated = await requests(container).updateReturnRequests(input)
    const previous = before
      ? Object.fromEntries(
          Object.keys(input).map((key) => [key, (before as Record<string, unknown>)[key]])
        )
      : null
    return new StepResponse(updated, previous)
  },
  async (previous, { container }) => {
    if (previous) {
      await requests(container).updateReturnRequests(previous as { id: string })
    }
  }
)

const geliverAccount = async (container: Pick<MedusaContainer, "resolve">) =>
  geliverCredentialsOf(
    await container
      .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
      .read("geliver")
  )

/**
 * The carrier's return for an order that went with Geliver (adr/0032): the
 * latest parcel's return opened and its label bought; its code is what the
 * shopper hands the parcel over with. Nothing for an order the shop
 * shipped itself. Undone by withdrawing the return at Geliver.
 */
export const openCarrierReturnStep = createStep(
  "returns-open-carrier-return",
  async (input: { order_id: string }, { container }) => {
    const [parcel] = await container
      .resolve<ShipmentTrackingModuleService>(SHIPMENT_TRACKING_MODULE)
      .listTrackedShipments(
        { order_id: input.order_id, provider: "geliver", status: { $ne: "canceled" } },
        { take: 1, order: { created_at: "DESC" } }
      )
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
