import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { carrierOf } from "../../../lib/shipping/carriers"
import { SHIPMENT_TRACKING_MODULE } from "../../../modules/shipment-tracking"
import type ShipmentTrackingModuleService from "../../../modules/shipment-tracking/service"
import { movesOn, withCarrier } from "../../../modules/shipment-tracking/states"
import type { ShipmentStatus } from "../../../modules/shipment-tracking/states"
import { carrierReader } from "../carrier-status"
import type { CarrierReading } from "../carrier-status"

const tracking = (container: Pick<MedusaContainer, "resolve">) =>
  container.resolve<ShipmentTrackingModuleService>(SHIPMENT_TRACKING_MODULE)

/** Starts tracking the parcel a carrier opened for a fulfillment (adr/0031). Undone by removing it. */
export const trackShipmentStep = createStep(
  "shipping-track-shipment",
  async (input: { fulfillment_id: string; order_id: string }, { container }) => {
    const fulfillment = await container
      .resolve(Modules.FULFILLMENT)
      .retrieveFulfillment(input.fulfillment_id)
    const data: Record<string, unknown> = fulfillment.data ?? {}
    const shipmentId = data["shipment_id"]
    const provider = carrierOf(fulfillment.provider_id)
    if (typeof shipmentId !== "string" || !provider) {
      return new StepResponse(null, null)
    }
    const tracked = await tracking(container).createTrackedShipments({
      fulfillment_id: input.fulfillment_id,
      order_id: input.order_id,
      provider,
      provider_shipment_id: shipmentId,
      test: data["test"] === true,
    })
    return new StepResponse(tracked, tracked.id)
  },
  async (id, { container }) => {
    if (id) {
      await tracking(container).deleteTrackedShipments(id)
    }
  }
)

export interface TrackedFacts {
  id: string
  /** The carrier asked about it (`tracked_shipment.provider`). */
  provider: string
  order_id: string
  fulfillment_id: string
  provider_shipment_id: string
  status: ShipmentStatus
  tracking_number: string | null
  tracking_url: string | null
  status_at: Date | string | null
  checked_at: Date | string | null
  items: { id: string; quantity: number }[]
  shipped: boolean
  delivered: boolean
  /** Its fulfillment was cancelled (or is gone): the parcel's way ends here. */
  canceled: boolean
}

/** The tracked parcel and its fulfillment as Medusa holds it: packed lines, shipped, delivered. */
export const readTrackedShipmentStep = createStep(
  "shipping-read-tracked-shipment",
  async (id: string, { container }) => {
    const [tracked] = await tracking(container).listTrackedShipments({ id }, { take: 1 })
    if (!tracked) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "shipping.shipment_unknown")
    }
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "fulfillment",
      fields: [
        "id",
        "shipped_at",
        "delivered_at",
        "canceled_at",
        "items.line_item_id",
        "items.quantity",
      ],
      filters: { id: tracked.fulfillment_id },
    })
    const fulfillment = data[0] as
      | {
          shipped_at?: unknown
          delivered_at?: unknown
          canceled_at?: unknown
          items?: ({ line_item_id?: string | null; quantity?: number | null } | null)[] | null
        }
      | undefined
    return new StepResponse<TrackedFacts>({
      id: tracked.id,
      provider: tracked.provider,
      order_id: tracked.order_id,
      fulfillment_id: tracked.fulfillment_id,
      provider_shipment_id: tracked.provider_shipment_id,
      status: tracked.status,
      tracking_number: tracked.tracking_number,
      tracking_url: tracked.tracking_url,
      status_at: tracked.status_at,
      checked_at: tracked.checked_at,
      items: (fulfillment?.items ?? []).flatMap((item) =>
        item?.line_item_id ? [{ id: item.line_item_id, quantity: item.quantity ?? 0 }] : []
      ),
      shipped: Boolean(fulfillment?.shipped_at),
      delivered: Boolean(fulfillment?.delivered_at),
      canceled: !fulfillment || Boolean(fulfillment.canceled_at),
    })
  }
)

export type { CarrierReading }

/**
 * Asks the carrier where the parcel is (adr/0031: what its API says, never
 * a notification's body; adr/0035: each carrier through its reader). A
 * parcel whose fulfillment was cancelled is not asked about: it ends as
 * cancelled. Reads only.
 */
export const readCarrierStatusStep = createStep(
  "shipping-read-carrier-status",
  async (tracked: TrackedFacts, { container }) => {
    if (tracked.canceled) {
      return new StepResponse<CarrierReading>({
        status: "canceled",
        provider_status: "fulfillment_canceled",
        tracking_number: null,
        tracking_url: null,
      })
    }
    return new StepResponse<CarrierReading>(
      await carrierReader(tracked.provider)(container, tracked.provider_shipment_id)
    )
  }
)

export interface StatusChange {
  /** The parcel moved on: a new status recorded. */
  moved: boolean
  status: ShipmentStatus
  /** The carrier has it and Medusa does not yet say shipped. */
  hand_over: boolean
  /** Delivered and Medusa does not yet say so. */
  deliver: boolean
  tracking_number: string | null
  tracking_url: string | null
}

/**
 * Records what the carrier said (adr/0031): the tracking number once it
 * comes, the check's time, and a new status only when it moves the parcel
 * on, once (a unique event per status). What Medusa still has to record
 * follows from the status, whether this run moved it or an earlier one
 * failed before Medusa did. Undone by putting the parcel back.
 */
export const recordShipmentStatusStep = createStep(
  "shipping-record-shipment-status",
  async (input: { tracked: TrackedFacts; reading: CarrierReading }, { container }) => {
    const { tracked, reading } = input
    const service = tracking(container)
    const now = new Date()
    const moved = movesOn(tracked.status, reading.status)
    const status = moved ? reading.status : tracked.status
    let event: string | null = null
    if (moved) {
      const [existing] = await service.listShipmentEvents(
        { shipment_id: tracked.id, status: reading.status },
        { take: 1 }
      )
      if (!existing) {
        const created = await service.createShipmentEvents({
          shipment_id: tracked.id,
          status: reading.status,
          occurred_at: now,
          provider_status: reading.provider_status,
        })
        event = created.id
      }
    }
    const trackingNumber = reading.tracking_number ?? tracked.tracking_number
    const trackingUrl = reading.tracking_url ?? tracked.tracking_url
    await service.updateTrackedShipments({
      id: tracked.id,
      tracking_number: trackingNumber,
      tracking_url: trackingUrl,
      checked_at: now,
      ...(moved ? { status, status_at: now } : {}),
    })
    const change: StatusChange = {
      moved: moved && event !== null,
      status,
      hand_over: withCarrier(status) && !tracked.shipped,
      deliver: status === "delivered" && !tracked.delivered,
      tracking_number: trackingNumber,
      tracking_url: trackingUrl,
    }
    return new StepResponse(change, { tracked, event })
  },
  async (before, { container }) => {
    if (!before) {
      return
    }
    const service = tracking(container)
    if (before.event) {
      await service.deleteShipmentEvents(before.event)
    }
    await service.updateTrackedShipments({
      id: before.tracked.id,
      status: before.tracked.status,
      status_at: before.tracked.status_at ? new Date(before.tracked.status_at) : null,
      tracking_number: before.tracked.tracking_number,
      tracking_url: before.tracked.tracking_url,
      // The check's time stays: a parcel that fails is not asked about again at once
    })
  }
)
