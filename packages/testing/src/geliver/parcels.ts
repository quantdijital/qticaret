import { STAGES, movesTo, stageIndex, trackingNumber } from "../carrier/tracking"
import type { Stage, StageMove } from "../carrier/tracking"
import type { TrackedParcel, TrackingSource } from "../carrier/page"
import { carrierLabelPdf, trLira, trNumber } from "../label-pdf"
import type { LabelParty } from "../label-pdf"
import type { FakeAddress } from "./addresses"
import { fakeDesi } from "./prices"

/**
 * A Geliver shipment's parcel as the carrier Geliver bought it from sees
 * it: the carrier's tracking number in that carrier's shape, the stages
 * on its tracking page, and its label, the carrier's own, as Geliver's
 * `labelURL` serves it.
 */

/** Geliver's steps after an offer is accepted; a read moves one on when parcels move on read. */
export const TEST_STEPS = [
  { statusCode: "OFFER_ACCEPTED", tracking: null },
  { statusCode: "TRACKING_CODE_CREATED", tracking: "PRE_TRANSIT" },
  { statusCode: "LABEL_PRINTED", tracking: "PRE_TRANSIT" },
  { statusCode: "SHIPPED", tracking: "TRANSIT" },
  { statusCode: "DELIVERED", tracking: "DELIVERED" },
] as const

export interface FakeShipment {
  id: string
  /** As it was sent. */
  request: Record<string, unknown>
  /** The sender address it went from: the one named, or the account's default. */
  senderID?: string | undefined
  test: boolean
  statusCode: string
  offers: Record<string, unknown>[]
  offersRead: boolean
  acceptedOfferID: string | null
  /** Index of `TEST_STEPS`. */
  step: number
  /** Where the parcel stands on the carrier's tracking page. */
  stage: Stage
  moves: StageMove[]
  trackingNumber: string | null
  labelURL: string | null
}

// The carriers Geliver sells: their names and tracking numbers (shapes assumed, to confirm)
const CARRIERS: Readonly<Record<string, { name: string; digits: number; prefix?: string }>> = {
  ARAS: { name: "Aras Kargo", digits: 13 },
  YURTICI: { name: "Yurtiçi Kargo", digits: 12 },
  MNG: { name: "MNG Kargo", digits: 12 },
  SURAT: { name: "Sürat Kargo", digits: 12 },
  PTT: { name: "PTT Kargo", digits: 11, prefix: "KP" },
}
const carrierOf = (code: unknown) => CARRIERS[String(code)] ?? { name: String(code), digits: 12 }

export const acceptedOffer = (shipment: FakeShipment) =>
  shipment.offers.find((offer) => offer["id"] === shipment.acceptedOfferID)

/** The name of the carrier the accepted offer is from. */
const carrierNameFor = (shipment: FakeShipment): string =>
  carrierOf(acceptedOffer(shipment)?.["providerCode"]).name

/** A tracking number for the accepted offer's carrier, unique among the fake's. */
export function numberFor(shipment: FakeShipment, all: Iterable<FakeShipment>): string {
  const taken = new Set([...all].map((each) => each.trackingNumber))
  return trackingNumber(carrierOf(acceptedOffer(shipment)?.["providerCode"]), (candidate) =>
    taken.has(candidate)
  )
}

/** The stage a step shows: before the carrier has it "created", on its way, delivered. */
const stageOfStep = (step: number): Stage =>
  step >= 4 ? "delivered" : step === 3 ? "in_transit" : "created"

/** Moves to a step of `TEST_STEPS`, as a read does when parcels move on read. */
export function moveToStep(shipment: FakeShipment, step: number) {
  const to = Math.min(step, TEST_STEPS.length - 1)
  shipment.step = to
  shipment.statusCode = TEST_STEPS[to]?.statusCode ?? shipment.statusCode
  const stage = stageOfStep(to)
  if (stageIndex(stage) > stageIndex(shipment.stage)) {
    shipment.moves.push(...movesTo(shipment.stage, stage))
    shipment.stage = stage
  }
}

/** Moves to a stage by hand (the tracking page): Geliver says "SHIPPED" until delivered. */
export function moveToStage(shipment: FakeShipment, stage: Stage): boolean {
  if (
    !shipment.acceptedOfferID ||
    shipment.statusCode === "CANCELED" ||
    stageIndex(stage) <= stageIndex(shipment.stage)
  ) {
    return false
  }
  shipment.moves.push(...movesTo(shipment.stage, stage))
  shipment.stage = stage
  shipment.step = stage === "delivered" ? 4 : 3
  shipment.statusCode = TEST_STEPS[shipment.step]?.statusCode ?? shipment.statusCode
  return true
}

/** The tracking code Geliver gives with the shipment for where the parcel stands. */
export function trackingCodeOf(shipment: FakeShipment): string | null {
  switch (shipment.stage) {
    case "created":
      return TEST_STEPS[shipment.step]?.tracking ?? null
    case "out_for_delivery":
      return "OUT_FOR_DELIVERY"
    case "delivered":
      return "DELIVERED"
    case "picked_up":
    case "in_transit":
      return "TRANSIT"
  }
}

const text = (value: unknown): string => (typeof value === "string" ? value : "")

const partyOf = (address: Record<string, unknown> | undefined): LabelParty => ({
  name: text(address?.["name"]),
  address: text(address?.["address1"]),
  town: text(address?.["districtName"]),
  city: text(address?.["cityName"]),
  phone: text(address?.["phone"]),
})

/** Who sends and who receives: a return goes from the shopper back to the shop. */
function partiesOf(shipment: FakeShipment, addresses: ReadonlyMap<string, FakeAddress>) {
  const shop = addresses.get(shipment.senderID ?? text(shipment.request["senderAddressID"]))
  const shopper = shipment.request["recipientAddress"] as Record<string, unknown> | undefined
  const sender = shop ? partyOf(shop) : null
  const receiver = partyOf(shopper)
  return shipment.request["isReturn"] === true && sender
    ? { sender: receiver, receiver: sender }
    : { sender, receiver }
}

/** The carrier's label for the shipment, as Geliver's `labelURL` serves it. */
export function geliverLabel(
  shipment: FakeShipment,
  addresses: ReadonlyMap<string, FakeAddress>
): Buffer {
  const request = shipment.request
  const measure = (name: string) => Number(request[name])
  const desi = fakeDesi({
    length: measure("length"),
    width: measure("width"),
    height: measure("height"),
    weight: measure("weight"),
  })
  const order = request["order"] as Record<string, unknown> | undefined
  const cod = request["productPaymentOnDelivery"] === true ? Number(order?.["totalAmount"]) : 0
  const { sender, receiver } = partiesOf(shipment, addresses)
  return carrierLabelPdf({
    carrier: carrierOf(acceptedOffer(shipment)?.["providerCode"]).name,
    service:
      request["isReturn"] === true ? "İade · Gönderici Ödemeli" : "Standart · Gönderici Ödemeli",
    trackingNumber: shipment.trackingNumber ?? shipment.id.slice(0, 12).toUpperCase(),
    sender,
    receiver,
    piece: 1,
    pieces: 1,
    desi: Number.isFinite(desi) && desi > 0 ? trNumber(desi) : null,
    kg: measure("weight") > 0 ? trNumber(measure("weight")) : null,
    cashOnDelivery: cod > 0 ? trLira(cod) : null,
    references: [
      text(order?.["orderNumber"]) ? `Sipariş No: ${text(order?.["orderNumber"])}` : "",
      `Geliver: ${shipment.id.slice(0, 8).toUpperCase()}`,
    ],
    date: new Date(shipment.moves[0]?.at ?? Date.now()),
    test: shipment.test,
  })
}

/** The carriers' tracking pages for the fake's shipments, by tracking number. */
export function geliverTracking(
  shipments: ReadonlyMap<string, FakeShipment>,
  addresses: ReadonlyMap<string, FakeAddress>,
  changed: () => void
): TrackingSource {
  const tracked = (shipment: FakeShipment): TrackedParcel => ({
    view: () => {
      const { sender, receiver } = partiesOf(shipment, addresses)
      const known = new Set(shipment.moves.map((move) => move.stage))
      const last = shipment.moves.at(-1)?.at ?? new Date().toISOString()
      const missing = STAGES.slice(0, stageIndex(shipment.stage) + 1)
        .filter((each) => !known.has(each))
        .map((each) => ({ stage: each, at: last }))
      return {
        carrier: carrierNameFor(shipment),
        number: shipment.trackingNumber ?? "",
        stage: shipment.stage,
        moves: [...shipment.moves, ...missing],
        canceled: shipment.statusCode === "CANCELED",
        note: shipment.request["isReturn"] === true ? "İade gönderisi" : null,
        receiverName: receiver.name,
        destination: { town: receiver.town, city: receiver.city },
        origin: sender ? { town: sender.town, city: sender.city } : null,
        pieces: 1,
        desi: null,
      }
    },
    advance: (stage) => {
      const moved = moveToStage(shipment, stage)
      if (moved) {
        changed()
      }
      return moved
    },
  })
  return {
    carrier: "Kargo",
    color: "#0f5c4c",
    find: (number) => {
      const shipment = [...shipments.values()].find((each) => each.trackingNumber === number)
      return shipment ? tracked(shipment) : null
    },
  }
}
