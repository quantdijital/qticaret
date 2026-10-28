import { tinyPdf } from "../pdf"
import { randomUUID } from "node:crypto"
import { FAKE_SERVICES, fakeDesi, fakePrice } from "./prices"
import type { Handler, Reply } from "./routes"
import { failed, ok } from "./routes"

/**
 * Geliver's shipments as the fake keeps them (adr/0031): created with
 * offers that are complete on the first read, accepted (the label bought),
 * cancelled until the carrier has the parcel. A test shipment moves one
 * step on every read after its label is bought, as Geliver's do.
 */

/** The steps a test shipment takes after its label is bought, one per read. */
export const TEST_STEPS = [
  { statusCode: "OFFER_ACCEPTED", tracking: null },
  { statusCode: "TRACKING_CODE_CREATED", tracking: "PRE_TRANSIT" },
  { statusCode: "LABEL_PRINTED", tracking: "PRE_TRANSIT" },
  { statusCode: "SHIPPED", tracking: "TRANSIT" },
  { statusCode: "DELIVERED", tracking: "DELIVERED" },
] as const

export interface FakeShipment {
  id: string
  request: Record<string, unknown>
  test: boolean
  statusCode: string
  offers: Record<string, unknown>[]
  offersRead: boolean
  acceptedOfferID: string | null
  step: number
  trackingNumber: string | null
  labelURL: string | null
}

const CANCELLABLE = new Set([
  "CREATED",
  "GOT_OFFERS",
  "OFFER_ACCEPTED",
  "TRACKING_CODE_CREATED",
  "LABEL_PRINTED",
])

export function createShipments(labelBase: () => string) {
  const shipments = new Map<string, FakeShipment>()
  // Shipments whose reads do not move them on (a test pins one where it stands)
  const held = new Set<string>()

  const view = (shipment: FakeShipment) => {
    const accepted = shipment.offers.find((offer) => offer["id"] === shipment.acceptedOfferID)
    const sorted = [...shipment.offers].sort(
      (a, b) => Number(a["totalAmount"]) - Number(b["totalAmount"])
    )
    const step = TEST_STEPS[shipment.step]
    return {
      id: shipment.id,
      test: shipment.test,
      statusCode: shipment.statusCode,
      acceptedOfferID: shipment.acceptedOfferID,
      providerServiceCode: accepted?.["providerServiceCode"] ?? null,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingNumber
        ? `https://kargo.example.com/takip/${shipment.trackingNumber}`
        : null,
      barcode: shipment.trackingNumber,
      labelURL: shipment.labelURL,
      offers: {
        percentageCompleted: shipment.offersRead ? 100 : 50,
        cheapest: shipment.offersRead ? (sorted[0] ?? null) : null,
        list: shipment.offersRead ? shipment.offers : [],
      },
      trackingStatus:
        shipment.acceptedOfferID && step?.tracking
          ? { trackingStatusCode: step.tracking, statusDate: new Date().toISOString() }
          : null,
    }
  }

  /** Moves a test shipment one step on, as a read does; also for tests that drive it. */
  const advance = (shipment: FakeShipment) => {
    if (!shipment.acceptedOfferID || shipment.statusCode === "CANCELED") {
      return
    }
    shipment.step = Math.min(shipment.step + 1, TEST_STEPS.length - 1)
    shipment.statusCode = TEST_STEPS[shipment.step]?.statusCode ?? shipment.statusCode
    shipment.trackingNumber ??= String(Math.floor(1e11 + Math.random() * 9e11))
  }

  const create: Handler = ({ body }) => {
    const recipient = body["recipientAddress"] as Record<string, unknown> | undefined
    const parcel = {
      length: Number(body["length"]),
      width: Number(body["width"]),
      height: Number(body["height"]),
      weight: Number(body["weight"]),
    }
    if (
      typeof body["senderAddressID"] !== "string" ||
      typeof recipient?.["phone"] !== "string" ||
      Object.values(parcel).some((value) => !Number.isFinite(value) || value <= 0)
    ) {
      return failed(400, "VALIDATION_ERROR", "sender, recipient phone and parcel required")
    }
    const desi = fakeDesi(parcel)
    const shipment: FakeShipment = {
      id: randomUUID(),
      request: body,
      test: body["test"] === true,
      statusCode: "GOT_OFFERS",
      offers: FAKE_SERVICES.map((service) => ({
        id: randomUUID(),
        providerCode: service.providerCode,
        providerServiceCode: service.providerServiceCode,
        totalAmount: fakePrice(service, desi),
        currency: "TRY",
        averageEstimatedTime: service.hours,
      })),
      offersRead: false,
      acceptedOfferID: null,
      step: 0,
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
    } else if (shipment.test && !held.has(shipment.id)) {
      advance(shipment)
    }
    return ok(view(shipment))
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
    shipment.statusCode = "OFFER_ACCEPTED"
    shipment.labelURL = `${labelBase()}/labels/${shipment.id}.pdf`
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

  /** The label PDF: a real (tiny) PDF, served without a token like Geliver's link. */
  const label = (id: string): Reply =>
    shipments.get(id)?.labelURL
      ? {
          body: null,
          bytes: {
            type: "application/pdf",
            data: tinyPdf(`etiket ${id}`),
          },
        }
      : failed(404, "NOT_FOUND", "label not found")

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
      statusCode: "OFFER_ACCEPTED",
      offersRead: true,
      acceptedOfferID: original.acceptedOfferID,
      step: 0,
      trackingNumber: String(Math.floor(1e11 + Math.random() * 9e11)),
      labelURL: null,
    }
    returned.labelURL = `${labelBase()}/labels/${returned.id}.pdf`
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
