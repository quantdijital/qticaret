import { STAGES, movesTo, stageIndex, trackingNumber, xmlText } from "../carrier/tracking"
import type { Stage, StageMove } from "../carrier/tracking"
import type { TrackedParcel, TrackingPlace, TrackingSource } from "../carrier/page"
import { carrierLabelPdf, trLira, trNumber } from "../label-pdf"
import type { LabelParty } from "../label-pdf"

/**
 * A Sürat parcel as the fake keeps it (docs/entegrasyonlar/surat.md): what
 * `GonderiyiKargoyaGonderYeni` sent, the number Sürat gives it once the
 * branch has it (`KargoTakipNo`, 12 digits; its tracking page's), where it
 * stands and the moves that brought it there.
 */

export interface FakeSuratShipment {
  /** Our code (`OzelKargoTakipNo`). */
  code: string
  receiverName: string
  address: string
  city: string
  town: string
  phone: string
  /** As sent ("0.40"); "" when not. */
  desi: string
  kg: string
  /** `KapidanOdemeTahsilatTipi`: 0 nothing, 1 cash, 2 card. */
  collectionType: string
  codAmount: string
  waybill: string
  trackingNumber: string
  /** Steps of `TRACKING_STEPS` reached; -1 before Sürat has the parcel. */
  step: number
  /** Deleted (`GonderiSil`) before the branch had it. */
  canceled: boolean
  /** Asked back (`GonderiGeriCek`) on its way: Sürat returns it to the shop. */
  withdrawn: boolean
  moves: StageMove[]
}

/** What Sürat says of a parcel, step by step: its `KargoHareketTip` and its words. */
export const TRACKING_STEPS = [
  { event: "KargoSubedeTeslimAlindi", text: "Kargo şubede teslim alındı" },
  { event: "AracYolaCikti", text: "Kargo transfer merkezinden çıktı" },
  { event: "KargoDagitimaCikti", text: "Kargo dağıtıma çıktı" },
  { event: "KargoAdresteTeslimEdildi", text: "Kargo adreste teslim edildi" },
] as const

/** A request field's text; "" when empty or missing. */
export const field = (body: string, name: string): string =>
  xmlText(new RegExp(`<${name}>([^<]*)</${name}>`, "i").exec(body)?.[1] ?? "")

const stageOfStep = (step: number): Stage => STAGES[step + 1] ?? "created"

/** A new parcel from a request body, with a Sürat number no other has. */
export function shipmentOf(body: string, taken: (number: string) => boolean): FakeSuratShipment {
  return {
    code: field(body, "OzelKargoTakipNo"),
    receiverName: field(body, "KisiKurum"),
    address: field(body, "AliciAdresi"),
    city: field(body, "Il"),
    town: field(body, "Ilce"),
    phone: field(body, "TelefonCep"),
    desi: field(body, "BirimDesi"),
    kg: field(body, "BirimKg"),
    collectionType: field(body, "KapidanOdemeTahsilatTipi"),
    codAmount: field(body, "KapidanOdemeTutari"),
    waybill: field(body, "IrsaliyeSiraNo"),
    trackingNumber: trackingNumber({ digits: 12 }, taken),
    step: -1,
    canceled: false,
    withdrawn: false,
    moves: [{ stage: "created", at: new Date().toISOString() }],
  }
}

/** Moves the parcel to `step`, recording the stages on the way; never back. */
export function moveShipment(shipment: FakeSuratShipment, step: number): boolean {
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

/** The tracking answer's JSON, as the owner's plugin reads it: the parcel with its movements. */
export function trackingJson(shipment: FakeSuratShipment): string {
  const stamps = shipment.moves.slice(1)
  const movements: Record<string, string>[] = TRACKING_STEPS.slice(0, shipment.step + 1).map(
    (step, index) => ({
      HareketTipi: step.event,
      Aciklama: step.text,
      IslemTarihi: at(stamps[index]?.at ?? new Date().toISOString()),
      IslemYeri: index === 0 ? "Gönderen şube" : "Varış şubesi",
    })
  )
  if (shipment.withdrawn) {
    movements.push({
      HareketTipi: "KargoIadeOnay",
      Aciklama: "Kargo göndericiye iade edilecek",
      IslemTarihi: at(new Date().toISOString()),
      IslemYeri: "Varış şubesi",
    })
  }
  return JSON.stringify({
    IsError: false,
    errorMessage: null,
    Gonderiler: [
      {
        OzelKargoTakipNo: shipment.code,
        KargoTakipNo: shipment.trackingNumber,
        Hareketler: movements,
      },
    ],
  })
}

const measure = (value: string): string | null => {
  const number = Number(value)
  return value !== "" && Number.isFinite(number) && number > 0 ? trNumber(number) : null
}

/** The label `KargoBarkodu` hands out to an account allowed one: Sürat's own, from the parcel. */
export function suratLabel(shipment: FakeSuratShipment, sender: LabelParty | null): Buffer {
  return carrierLabelPdf({
    carrier: "Sürat Kargo",
    service: "Standart · Gönderici Ödemeli",
    trackingNumber: shipment.trackingNumber,
    sender,
    receiver: {
      name: shipment.receiverName,
      address: shipment.address,
      town: shipment.town,
      city: shipment.city,
      phone: shipment.phone,
    },
    piece: 1,
    pieces: 1,
    desi: measure(shipment.desi),
    kg: measure(shipment.kg),
    cashOnDelivery:
      shipment.collectionType !== "0" && Number(shipment.codAmount) > 0
        ? trLira(Number(shipment.codAmount))
        : null,
    references: [
      shipment.waybill ? `İrsaliye No: ${shipment.waybill}` : "",
      `Özel Takip No: ${shipment.code}`,
    ],
    date: new Date(shipment.moves[0]?.at ?? Date.now()),
    test: false,
  })
}

/** Sürat's tracking page for the fake's parcels, by Sürat's number. */
export function suratTracking(
  shipments: ReadonlyMap<string, FakeSuratShipment>,
  origin: TrackingPlace | null,
  changed: () => void
): TrackingSource {
  const tracked = (shipment: FakeSuratShipment): TrackedParcel => ({
    view: () => {
      const stage = stageOfStep(shipment.step)
      const known = new Set(shipment.moves.map((move) => move.stage))
      const last = shipment.moves.at(-1)?.at ?? new Date().toISOString()
      // A step set straight on the record (a test) still shows its stages
      const missing = STAGES.slice(0, stageIndex(stage) + 1)
        .filter((each) => !known.has(each))
        .map((each) => ({ stage: each, at: last }))
      return {
        number: shipment.trackingNumber,
        stage,
        moves: [...shipment.moves, ...missing],
        canceled: shipment.canceled,
        note: shipment.withdrawn ? "Göndericiye iade edilecek" : null,
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
    carrier: "Sürat Kargo",
    color: "#c8102e",
    words: {
      picked_up: TRACKING_STEPS[0].text,
      in_transit: TRACKING_STEPS[1].text,
      out_for_delivery: TRACKING_STEPS[2].text,
      delivered: TRACKING_STEPS[3].text,
    },
    find: (number) => {
      const shipment = [...shipments.values()].find((each) => each.trackingNumber === number)
      return shipment ? tracked(shipment) : null
    },
  }
}
