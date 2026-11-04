import { randomUUID } from "node:crypto"
import type { AdvanceMode } from "../carrier/tracking"
import type { FakeAddress } from "./addresses"
import {
  TEST_STEPS,
  acceptedOffer,
  geliverLabel,
  moveToStep,
  numberFor,
  trackingCodeOf,
} from "./parcels"
import type { FakeShipment } from "./parcels"
import { fakeDesi, offersFor } from "./prices"
import type { FakeService } from "./prices"
import type { Handler, Reply } from "./routes"
import { failed, ok } from "./routes"

/**
 * Geliver's shipments as the fake keeps them (adr/0031): created with
 * offers that are complete on the first read, accepted (the label bought,
 * the carrier's tracking number given), cancelled until the carrier has
 * the parcel. After its label is bought a shipment, test or live, moves
 * on a step on each read (`advance: "on-read"`, the tests' default) or
 * only from the carrier's tracking page (`"manual"`, `./parcels`).
 */

export { TEST_STEPS } from "./parcels"
export type { FakeShipment } from "./parcels"

const CANCELLABLE = new Set([
  "CREATED",
  "GOT_OFFERS",
  "OFFER_ACCEPTED",
  "TRACKING_CODE_CREATED",
  "LABEL_PRINTED",
])

export interface ShipmentOptions {
  origin: () => string
  addresses: ReadonlyMap<string, FakeAddress>
  services: readonly FakeService[]
  advance: AdvanceMode
}

export function createShipments(options: ShipmentOptions) {
  const shipments = new Map<string, FakeShipment>()
  // Shipments whose reads do not move them on (a test pins one where it stands)
  const held = new Set<string>()

  const view = (shipment: FakeShipment) => {
    const accepted = acceptedOffer(shipment)
    const sorted = [...shipment.offers].sort(
      (a, b) => Number(a["totalAmount"]) - Number(b["totalAmount"])
    )
    const tracking = trackingCodeOf(shipment)
    return {
      id: shipment.id,
      test: shipment.test,
      statusCode: shipment.statusCode,
      acceptedOfferID: shipment.acceptedOfferID,
      providerServiceCode: accepted?.["providerServiceCode"] ?? null,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingNumber
        ? `${options.origin()}/takip/${shipment.trackingNumber}`
        : null,
      barcode: shipment.trackingNumber,
      labelURL: shipment.labelURL,
      offers: {
        percentageCompleted: shipment.offersRead ? 100 : 50,
        cheapest: shipment.offersRead ? (sorted[0] ?? null) : null,
        list: shipment.offersRead ? shipment.offers : [],
      },
      trackingStatus:
        shipment.acceptedOfferID && tracking
          ? {
              trackingStatusCode: tracking,
              statusDate: shipment.moves.at(-1)?.at ?? new Date().toISOString(),
            }
          : null,
    }
  }

  /** Moves a shipment one step on, as a read does; also for tests that drive it. */
  const advance = (shipment: FakeShipment) => {
    if (!shipment.acceptedOfferID || shipment.statusCode === "CANCELED") {
      return
    }
    moveToStep(shipment, shipment.step + 1)
  }

  /**
   * The account's default sender, as Geliver takes it when a shipment names
   * none (the SDK's README): here its first sender address.
   */
  const defaultSender = (): string | null =>
    [...options.addresses.values()].find((address) => !address.isRecipientAddress)?.id ?? null

  const create: Handler = ({ body }) => {
    const recipient = body["recipientAddress"] as Record<string, unknown> | undefined
    const parcel = {
      length: Number(body["length"]),
      width: Number(body["width"]),
      height: Number(body["height"]),
      weight: Number(body["weight"]),
    }
    const named = body["senderAddressID"]
    const sender = typeof named === "string" ? named : named === undefined ? defaultSender() : null
    if (
      sender === null ||
      typeof recipient?.["phone"] !== "string" ||
      recipient["phone"] === "" ||
      Object.values(parcel).some((value) => !Number.isFinite(value) || value <= 0)
    ) {
      return failed(400, "VALIDATION_ERROR", "sender, recipient phone and parcel required")
    }
    const shipment: FakeShipment = {
      id: randomUUID(),
      request: body,
      // The sender it went from, named or the default, as Geliver keeps it
      senderID: sender,
      test: body["test"] === true,
      statusCode: "GOT_OFFERS",
      offers: offersFor(options.services, fakeDesi(parcel)).map((offer) => ({
        id: randomUUID(),
        ...offer,
      })),
      offersRead: false,
      acceptedOfferID: null,
      step: 0,
      stage: "created",
      moves: [],
      trackingNumber: null,
      labelURL: null,
    }
    shipments.set(shipment.id, shipment)
    return ok(view(shipment))
  }

  const read: Handler = ({ params }) => {
    const shipment = shipments.get(params[0] ?? "")
    if (!shipment) {
      return failed(404, "NOT_FOUND", "shipment not found")
    }
    if (!shipment.offersRead) {
      shipment.offersRead = true
    } else if (options.advance === "on-read" && !held.has(shipment.id)) {
      advance(shipment)
    }
    return ok(view(shipment))
  }

  /** The label bought: the carrier's number given now, as its label carries it. */
  const bought = (shipment: FakeShipment) => {
    shipment.moves = [{ stage: "created", at: new Date().toISOString() }]
    shipment.stage = "created"
    shipment.trackingNumber = numberFor(shipment, shipments.values())
    // By hand, the number given is where it waits; on read, each read takes a step
    shipment.step = options.advance === "manual" ? 1 : 0
    shipment.statusCode = TEST_STEPS[shipment.step]?.statusCode ?? "OFFER_ACCEPTED"
    shipment.labelURL = `${options.origin()}/labels/${shipment.id}.pdf`
  }

  const accept: Handler = ({ body }) => {
    const shipment = [...shipments.values()].find((each) =>
      each.offers.some((offer) => offer["id"] === body["offerID"])
    )
    if (!shipment || shipment.statusCode === "CANCELED") {
      return failed(400, "OFFER_NOT_FOUND", "offer not found")
    }
    if (shipment.acceptedOfferID) {
      return failed(400, "ALREADY_ACCEPTED", "an offer was already accepted")
    }
    shipment.acceptedOfferID = String(body["offerID"])
    bought(shipment)
    return ok({ id: randomUUID(), shipment: view(shipment) })
  }

  const cancel: Handler = ({ params }) => {
    const shipment = shipments.get(params[0] ?? "")
    if (!shipment) {
      return failed(404, "NOT_FOUND", "shipment not found")
    }
    if (!CANCELLABLE.has(shipment.statusCode)) {
      return failed(400, "CANNOT_CANCEL", "the carrier has the parcel")
    }
    shipment.statusCode = "CANCELED"
    return ok(undefined)
  }

  /** The label PDF, the carrier's own, served without a token like Geliver's link. */
  const label = (id: string): Reply => {
    const shipment = shipments.get(id)
    return shipment?.labelURL
      ? {
          body: null,
          bytes: { type: "application/pdf", data: geliverLabel(shipment, options.addresses) },
        }
      : failed(404, "NOT_FOUND", "label not found")
  }

  /** `POST /shipments/:id { isReturn }`: a return of a delivered shipment, its label bought. */
  const createReturn: Handler = ({ params, body }) => {
    const original = shipments.get(params[0] ?? "")
    if (!original) {
      return failed(404, "NOT_FOUND", "shipment not found")
    }
    if (body["isReturn"] !== true) {
      return failed(400, "VALIDATION_ERROR", "only returns are made here")
    }
    const returned: FakeShipment = {
      ...original,
      id: randomUUID(),
      request: { ...original.request, isReturn: true, returnOf: original.id },
      offersRead: true,
      acceptedOfferID: original.acceptedOfferID,
    }
    bought(returned)
    shipments.set(returned.id, returned)
    return ok({ id: randomUUID(), shipment: { ...view(returned), isReturn: true } })
  }

  return {
    shipments,
    held,
    advance,
    view,
    label,
    routes: {
      "POST /shipments": create,
      "GET /shipments/:id": read,
      "DELETE /shipments/:id": cancel,
      "POST /shipments/:id": createReturn,
      "POST /transactions": accept,
    } satisfies Record<string, Handler>,
  }
}
