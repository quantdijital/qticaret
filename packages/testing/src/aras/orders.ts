import { STAGES, movesTo, stageIndex, trackingNumber, xmlText } from "../carrier/tracking"
import type { Stage, StageMove } from "../carrier/tracking"
import type { TrackedParcel, TrackingView } from "../carrier/page"
import { carrierLabelPdf, trLira, trNumber } from "../label-pdf"
import type { LabelParty } from "../label-pdf"

/**
 * An Aras order as the fake keeps it (adr/0035): what `SetOrder` sent,
 * the tracking number Aras gives it (13 digits, the shape Aras's tracking
 * page takes; to confirm with a real account), where it stands and the
 * moves that brought it there. Its label is drawn from the same record.
 */

export interface FakeArasOrder {
  integrationCode: string
  receiverName: string
  city: string
  town: string
  isCod: boolean
  codAmount: string
  trackingNumber: string
  /** Steps of `TRACKING_STEPS` reached; -1 before Aras has the parcel. */
  step: number
  canceled: boolean
  address: string
  phone: string
  /** As sent ("2.00"); "" when not. */
  desi: string
  kg: string
  pieces: number
  /** The order's number on the waybill. */
  waybill: string
  /** Who pays the carriage: `PayorTypeCode` 1 the sender, 2 the receiver. */
  payor: string
  moves: StageMove[]
}

/** What Aras shows for a parcel, step by step. */
export const TRACKING_STEPS = ["TESLİM ALINDI", "YOLDA", "DAĞITIMDA", "TESLİM EDİLDİ"] as const

/** The tracking page's stage for a step: one ahead, the label-only "created" first. */
export const stageOfStep = (step: number): Stage => STAGES[step + 1] ?? "created"

const field = (body: string, name: string): string =>
  xmlText(new RegExp(`<${name}>([^<]*)</${name}>`, "i").exec(body)?.[1] ?? "")

/** A new order from a `SetOrder` body, with a tracking number no other order has. */
export function orderOf(
  body: string,
  integrationCode: string,
  taken: (number: string) => boolean
): FakeArasOrder {
  const pieces = Number(field(body, "PieceCount"))
  return {
    integrationCode,
    receiverName: field(body, "ReceiverName"),
    city: field(body, "ReceiverCityName"),
    town: field(body, "ReceiverTownName"),
    isCod: field(body, "IsCod") === "1",
    codAmount: field(body, "CodAmount"),
    trackingNumber: trackingNumber({ digits: 13 }, taken),
    step: -1,
    canceled: false,
    address: [field(body, "ReceiverQuarterName"), field(body, "ReceiverAddress")]
      .filter(Boolean)
      .join(", "),
    phone: field(body, "ReceiverPhone1"),
    desi: field(body, "VolumetricWeight"),
    kg: field(body, "Weight"),
    pieces: Number.isInteger(pieces) && pieces > 0 ? pieces : 1,
    waybill: field(body, "TradingWaybillNumber") || field(body, "InvoiceNumber"),
    payor: field(body, "PayorTypeCode"),
    moves: [{ stage: "created", at: new Date().toISOString() }],
  }
}

/** Moves the order to `step`, recording the stages on the way; never back. */
export function moveOrder(order: FakeArasOrder, step: number): boolean {
  const to = Math.min(step, TRACKING_STEPS.length - 1)
  if (order.canceled || to <= order.step) {
    return false
  }
  order.moves.push(...movesTo(stageOfStep(order.step), stageOfStep(to)))
  order.step = to
  return true
}

const measure = (value: string): string | null => {
  const number = Number(value)
  return value !== "" && Number.isFinite(number) && number > 0 ? trNumber(number) : null
}

/** The label `GetArasBarcode` hands out: Aras's own, drawn from the order. */
export function arasLabel(order: FakeArasOrder, sender: LabelParty | null): Buffer {
  return carrierLabelPdf({
    carrier: "Aras Kargo",
    service: `Standart · ${order.payor === "2" ? "Alıcı" : "Gönderici"} Ödemeli`,
    trackingNumber: order.trackingNumber,
    sender,
    receiver: {
      name: order.receiverName,
      address: order.address,
      town: order.town,
      city: order.city,
      phone: order.phone,
    },
    piece: 1,
    pieces: order.pieces,
    desi: measure(order.desi),
    kg: measure(order.kg),
    cashOnDelivery:
      order.isCod && Number(order.codAmount) > 0 ? trLira(Number(order.codAmount)) : null,
    references: [
      order.waybill ? `İrsaliye No: ${order.waybill}` : "",
      `Entegrasyon Kodu: ${order.integrationCode}`,
    ],
    date: new Date(order.moves[0]?.at ?? Date.now()),
    test: false,
  })
}

/** The order on the fake's tracking page, moved on by its buttons. */
export function trackedOrder(
  order: FakeArasOrder,
  sender: LabelParty | null,
  changed: () => void
): TrackedParcel {
  return {
    view: (): TrackingView => {
      const stage = stageOfStep(order.step)
      const known = new Set(order.moves.map((move) => move.stage))
      const last = order.moves.at(-1)?.at ?? new Date().toISOString()
      // A step set straight on the record (a test) still shows its stages
      const missing = STAGES.slice(0, stageIndex(stage) + 1)
        .filter((each) => !known.has(each))
        .map((each) => ({ stage: each, at: last }))
      return {
        number: order.trackingNumber,
        stage,
        moves: [...order.moves, ...missing],
        canceled: order.canceled,
        note: null,
        receiverName: order.receiverName,
        destination: { town: order.town, city: order.city },
        origin: sender ? { town: sender.town, city: sender.city } : null,
        pieces: order.pieces,
        desi: measure(order.desi),
      }
    },
    advance: (stage) => {
      const moved = moveOrder(order, stageIndex(stage) - 1)
      if (moved) {
        changed()
      }
      return moved
    },
  }
}
