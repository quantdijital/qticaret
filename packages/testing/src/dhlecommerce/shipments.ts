import { STAGES, movesTo, stageIndex } from "../carrier/tracking"
import type { Stage, StageMove } from "../carrier/tracking"
import type { TrackedParcel, TrackingPlace, TrackingSource } from "../carrier/page"
import { trNumber } from "../label-pdf"

/**
 * A DHL eCommerce order as the fake keeps it: what `createOrder` sent (its
 * reference, recipient, pieces and what the courier collects), the
 * shipment number `createbarcode` gives it (12 digits, the number DHL's
 * tracking page takes), where it stands and the moves that brought it
 * there.
 */

export interface FakeDhlEcomOrder {
  referenceId: string
  /** The account (customer number) that opened it. */
  customer: string
  recipientName: string
  address: string
  city: string
  district: string
  cityCode: number
  districtCode: number
  phone: string
  email: string
  taxNumber: string
  taxOffice: string
  desi: number
  kg: number
  isCOD: number
  codAmount: number
  /** Null until `createbarcode`. */
  shipmentId: string | null
  /** The pieces' barcodes as DHL prints them; empty before `createbarcode`. */
  barcodes: string[]
  barcodeCanceled: boolean
  canceled: boolean
  /** Steps of `TRACKING_STEPS` reached; -1 before the branch has the parcel. */
  step: number
  moves: StageMove[]
}

/** What DHL says of a parcel, step by step: its `shipmentStatusCode` and words. */
export const TRACKING_STEPS = [
  { code: 2, status: "Transfer Aşamasında" },
  { code: 3, status: "Teslimat Birimine Ulaştı" },
  { code: 4, status: "Alıcı Adresine Yönlendirildi" },
  { code: 5, status: "Teslim Edildi" },
] as const

const PREPARED = { code: 1, status: "Gönderi Hazırlandı" } as const

/** The tracking page's stage for a step: the first move is the courier's. */
const stageOfStep = (step: number): Stage =>
  (["picked_up", "in_transit", "out_for_delivery", "delivered"] as const)[step] ?? "created"

/** The status DHL answers for the order where it stands. */
export const statusOfOrder = (order: FakeDhlEcomOrder) => TRACKING_STEPS[order.step] ?? PREPARED

/** Moves the order to `step`, recording the stages on the way; never back, never once withdrawn. */
export function moveOrder(order: FakeDhlEcomOrder, step: number): boolean {
  const to = Math.min(step, TRACKING_STEPS.length - 1)
  if (order.canceled || order.barcodeCanceled || !order.shipmentId || to <= order.step) {
    return false
  }
  order.moves.push(...movesTo(stageOfStep(order.step), stageOfStep(to)))
  order.step = to
  return true
}

/** DHL eCommerce's tracking page for the fake's parcels, by shipment number. */
export function dhlEcomTracking(
  orders: ReadonlyMap<string, FakeDhlEcomOrder>,
  origin: TrackingPlace | null,
  changed: () => void
): TrackingSource {
  const tracked = (order: FakeDhlEcomOrder): TrackedParcel => ({
    view: () => {
      const stage = stageOfStep(order.step)
      const known = new Set(order.moves.map((move) => move.stage))
      const last = order.moves.at(-1)?.at ?? new Date().toISOString()
      // A step set straight on the record (a test) still shows its stages
      const missing = STAGES.slice(0, stageIndex(stage) + 1)
        .filter((each) => !known.has(each))
        .map((each) => ({ stage: each, at: last }))
      return {
        number: order.shipmentId ?? order.referenceId,
        stage,
        moves: [...order.moves, ...missing],
        canceled: order.canceled || order.barcodeCanceled,
        note: null,
        receiverName: order.recipientName,
        destination: { town: order.district, city: order.city },
        origin,
        pieces: Math.max(1, order.barcodes.length),
        desi: order.desi > 0 ? trNumber(order.desi) : null,
      }
    },
    advance: (stage) => {
      const moved = moveOrder(order, stageIndex(stage) - 1)
      if (moved) {
        changed()
      }
      return moved
    },
  })
  return {
    carrier: "DHL eCommerce",
    color: "#d40511",
    words: {
      picked_up: "Gönderi kabul edildi",
      in_transit: TRACKING_STEPS[1].status,
      out_for_delivery: TRACKING_STEPS[2].status,
      delivered: TRACKING_STEPS[3].status,
    },
    find: (number) => {
      const order = [...orders.values()].find((each) => each.shipmentId === number)
      return order ? tracked(order) : null
    },
  }
}
