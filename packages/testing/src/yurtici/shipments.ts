import { STAGES, movesTo, stageIndex, trackingNumber, xmlText } from "../carrier/tracking"
import type { Stage, StageMove } from "../carrier/tracking"
import type { TrackedParcel, TrackingPlace, TrackingSource } from "../carrier/page"
import { trNumber } from "../label-pdf"
import { field } from "./rules"

/**
 * A Yurtiçi parcel as the fake keeps it (adr/0035): what `createShipment`
 * sent, the document number Yurtiçi gives it (`docId`, 12 digits as in
 * its document's examples; the number its tracking page takes), where it
 * stands and the moves that brought it there.
 */

export interface FakeYurticiShipment {
  cargoKey: string
  /** Which login opened it. */
  account: "main" | "cod"
  receiverName: string
  address: string
  city: string
  town: string
  phone: string
  desi: string
  kg: string
  /** `ttInvoiceAmount` as sent; empty when nothing is collected. */
  codAmount: string
  codDocumentId: string
  /** `ttCollectionType`: 0 cash, 1 card; empty when nothing is collected. */
  collectionType: string
  docId: string
  /** Steps of `TRACKING_STEPS` reached; -1 before Yurtiçi has the parcel. */
  step: number
  canceled: boolean
  /** Withdrawn after its document was issued: Yurtiçi brings it back instead. */
  returnRequested: boolean
  moves: StageMove[]
}

/** What Yurtiçi says of a parcel, step by step: its operation and the last event. */
export const TRACKING_STEPS = [
  { operation: "ISR", event: "Kargo kabul edildi" },
  { operation: "IND", event: "Kargo İndirildi" },
  { operation: "IND", event: "Dağıtıma çıkarıldı" },
  { operation: "DLV", event: "Teslim edildi" },
] as const

/** The tracking page's stage for a step: one ahead, "created" before Yurtiçi has it. */
const stageOfStep = (step: number): Stage => STAGES[step + 1] ?? "created"

const text = (body: string, name: string) => xmlText(field(body, name))

/** A new parcel from a `createShipment` body, with a document number no other has. */
export function shipmentOf(
  body: string,
  account: "main" | "cod",
  taken: (docId: string) => boolean
): FakeYurticiShipment {
  return {
    cargoKey: field(body, "cargoKey"),
    account,
    receiverName: text(body, "receiverCustName"),
    address: text(body, "receiverAddress"),
    city: text(body, "cityName"),
    town: text(body, "townName"),
    phone: field(body, "receiverPhone1"),
    desi: field(body, "desi"),
    kg: field(body, "kg"),
    codAmount: field(body, "ttInvoiceAmount"),
    codDocumentId: field(body, "ttDocumentId"),
    collectionType: field(body, "ttCollectionType"),
    docId: trackingNumber({ digits: 12 }, taken),
    step: -1,
    canceled: false,
    returnRequested: false,
    moves: [{ stage: "created", at: new Date().toISOString() }],
  }
}

/** Moves the parcel to `step`, recording the stages on the way; never back. */
export function moveShipment(shipment: FakeYurticiShipment, step: number): boolean {
  const to = Math.min(step, TRACKING_STEPS.length - 1)
  if (shipment.canceled || to <= shipment.step) {
    return false
  }
  shipment.moves.push(...movesTo(stageOfStep(shipment.step), stageOfStep(to)))
  shipment.step = to
  return true
}

/** Yurtiçi's tracking page for the fake's parcels, by document number. */
export function yurticiTracking(
  shipments: ReadonlyMap<string, FakeYurticiShipment>,
  origin: TrackingPlace | null,
  changed: () => void
): TrackingSource {
  const tracked = (shipment: FakeYurticiShipment): TrackedParcel => ({
    view: () => {
      const stage = stageOfStep(shipment.step)
      const known = new Set(shipment.moves.map((move) => move.stage))
      const last = shipment.moves.at(-1)?.at ?? new Date().toISOString()
      // A step set straight on the record (a test) still shows its stages
      const missing = STAGES.slice(0, stageIndex(stage) + 1)
        .filter((each) => !known.has(each))
        .map((each) => ({ stage: each, at: last }))
      const desi = Number(shipment.desi)
      return {
        number: shipment.docId,
        stage,
        moves: [...shipment.moves, ...missing],
        canceled: shipment.canceled,
        note: shipment.returnRequested ? "İade isteği alındı" : null,
        receiverName: shipment.receiverName,
        destination: { town: shipment.town, city: shipment.city },
        origin,
        pieces: 1,
        desi: shipment.desi && desi > 0 ? trNumber(desi) : null,
      }
    },
    advance: (stage) => {
      const moved = moveShipment(shipment, stageIndex(stage) - 1)
      if (moved) {
        changed()
      }
      return moved
    },
  })
  return {
    carrier: "Yurtiçi Kargo",
    color: "#1d3a8a",
    words: {
      picked_up: TRACKING_STEPS[0].event,
      in_transit: TRACKING_STEPS[1].event,
      out_for_delivery: TRACKING_STEPS[2].event,
      delivered: TRACKING_STEPS[3].event,
    },
    find: (number) => {
      const shipment = [...shipments.values()].find((each) => each.docId === number)
      return shipment ? tracked(shipment) : null
    },
  }
}
