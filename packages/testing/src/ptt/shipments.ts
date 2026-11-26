import { STAGES, movesTo, stageIndex, xmlText } from "../carrier/tracking"
import type { Stage, StageMove } from "../carrier/tracking"
import type { TrackedParcel, TrackingPlace, TrackingSource } from "../carrier/page"

/**
 * A PTT parcel as the fake keeps it (docs/entegrasyonlar/ptt.md): what
 * `kabulEkle2` loaded under its barcode, the file it came in (asked again
 * to delete it), where it stands and the moves that brought it there.
 */

export interface FakePttShipment {
  barcode: string
  fileName: string
  reference: string
  receiverName: string
  address: string
  city: string
  town: string
  phone: string
  /** As sent: grams and desi; "" when not. */
  grams: string
  desi: string
  /** `ekhizmet` ("OS" when paid at the door) and the amount (`odeme_sart_ucreti`). */
  services: string
  codAmount: string
  paymentType: string
  /** Loaded on PTT's test service. */
  test: boolean
  /** Steps of `TRACKING_STEPS` reached; -1 before a branch accepted it. */
  step: number
  /** Deleted (`barkodVeriSil`) before a branch accepted it. */
  canceled: boolean
  moves: StageMove[]
}

/** What PTT says of a parcel, step by step: its `gonderiDurumId` and its words. */
export const TRACKING_STEPS = [
  { id: "1", text: "Kabul Edildi" },
  { id: "77", text: "Sevk Edildi" },
  { id: "7", text: "Dağıtıcıya Verildi" },
  { id: "100", text: "Teslim Edildi" },
] as const

/** A request field's text, with or without its namespace prefix; "" when empty or missing. */
export const field = (body: string, name: string): string =>
  xmlText(new RegExp(`<(?:\\w+:)?${name}>([^<]*)</(?:\\w+:)?${name}>`, "i").exec(body)?.[1] ?? "")

const stageOfStep = (step: number): Stage => STAGES[step + 1] ?? "created"

/** A new parcel from a `kabulEkle2` body. */
export function shipmentOf(body: string, test: boolean): FakePttShipment {
  return {
    barcode: field(body, "barkodNo"),
    fileName: field(body, "dosyaAdi"),
    reference: field(body, "musteriReferansNo"),
    receiverName: field(body, "aliciAdi"),
    address: field(body, "aAdres"),
    city: field(body, "aliciIlAdi"),
    town: field(body, "aliciIlceAdi"),
    phone: field(body, "aliciSms"),
    grams: field(body, "agirlik"),
    desi: field(body, "desi"),
    services: field(body, "ekhizmet"),
    codAmount: field(body, "odeme_sart_ucreti"),
    paymentType: field(body, "odemesekli"),
    test,
    step: -1,
    canceled: false,
    moves: [{ stage: "created", at: new Date().toISOString() }],
  }
}

/** Moves the parcel to `step`, recording the stages on the way; never back. */
export function moveShipment(shipment: FakePttShipment, step: number): boolean {
  const to = Math.min(step, TRACKING_STEPS.length - 1)
  if (shipment.canceled || to <= shipment.step) {
    return false
  }
  shipment.moves.push(...movesTo(stageOfStep(shipment.step), stageOfStep(to)))
  shipment.step = to
  return true
}

const at = (iso: string): string => {
  const date = new Date(iso)
  const two = (value: number) => String(value).padStart(2, "0")
  return `${two(date.getDate())}.${two(date.getMonth() + 1)}.${String(date.getFullYear())} ${two(date.getHours())}:${two(date.getMinutes())}`
}

/** The events `gonderiSorgu2` lists, as XML rows under the types' prefix. */
export function trackingRows(shipment: FakePttShipment, prefix: string): string {
  const stamps = shipment.moves.slice(1)
  return TRACKING_STEPS.slice(0, shipment.step + 1)
    .map(
      (step, index) =>
        `<${prefix}:dongu><${prefix}:IMERK>${index === 0 ? "KADIKÖY PTT" : "VARIŞ PTT"}</${prefix}:IMERK>` +
        `<${prefix}:ISLEM>${step.text}</${prefix}:ISLEM>` +
        `<${prefix}:ITARIH>${at(stamps[index]?.at ?? new Date().toISOString())}</${prefix}:ITARIH>` +
        `<${prefix}:gonderiDurumId>${step.id}</${prefix}:gonderiDurumId>` +
        `<${prefix}:siraNo>${String(index + 1)}</${prefix}:siraNo></${prefix}:dongu>`
    )
    .join("")
}

const measure = (value: string): string | null => {
  const number = Number(value)
  return value !== "" && Number.isFinite(number) && number > 0 ? value : null
}

/** PTT's tracking page for the fake's parcels, by barcode. */
export function pttTracking(
  shipments: ReadonlyMap<string, FakePttShipment>,
  origin: TrackingPlace | null,
  changed: () => void
): TrackingSource {
  const tracked = (shipment: FakePttShipment): TrackedParcel => ({
    view: () => {
      const stage = stageOfStep(shipment.step)
      const known = new Set(shipment.moves.map((move) => move.stage))
      const last = shipment.moves.at(-1)?.at ?? new Date().toISOString()
      const missing = STAGES.slice(0, stageIndex(stage) + 1)
        .filter((each) => !known.has(each))
        .map((each) => ({ stage: each, at: last }))
      return {
        number: shipment.barcode,
        stage,
        moves: [...shipment.moves, ...missing],
        canceled: shipment.canceled,
        note: null,
        receiverName: shipment.receiverName,
        destination: { town: shipment.town, city: shipment.city },
        origin,
        pieces: 1,
        desi: measure(shipment.desi),
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
    carrier: "PTT Kargo",
    color: "#f5c400",
    words: {
      picked_up: TRACKING_STEPS[0].text,
      in_transit: TRACKING_STEPS[1].text,
      out_for_delivery: TRACKING_STEPS[2].text,
      delivered: TRACKING_STEPS[3].text,
    },
    find: (number) => {
      const shipment = shipments.get(number)
      return shipment ? tracked(shipment) : null
    },
  }
}
