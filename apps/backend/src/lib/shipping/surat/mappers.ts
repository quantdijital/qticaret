import type { XmlFields } from "../../clients/xml"
import { kurus, toMedusaAmount } from "../../money"
import type { Parcel } from "../parcel"
import type { Receiver } from "../receiver"

/**
 * A parcel as Sürat Kargo takes it (`GonderiModel` of
 * `GonderiyiKargoyaGonderYeni`; docs/entegrasyonlar/surat.md): our code as
 * its `OzelKargoTakipNo` (deleted, labelled and tracked by it), the
 * receiver (`../receiver`), its desi and kg, what the courier collects.
 * Fields in the service description's order (an ASMX service reads them
 * in sequence), every string sent, empty when unused, as the sources send
 * them. No e-mail: Sürat does not need one (KVKK, data minimisation).
 * Numbers with a dot (the separator to confirm with a real account).
 */

export interface SuratShipmentInput {
  /** Our code for the parcel: `OzelKargoTakipNo` and `ReferansNo`, the label's barcode. */
  code: string
  /** The order's number: the waybill's number and the parcel's contents. */
  orderNumber: string
  receiver: Receiver
  /** One parcel's desi (volume / 3000) and kg; null when not measured (the branch measures). */
  desi: number | null
  kg: number | null
  /** Kuruş the courier collects at the door, in cash; null when paid already. */
  cashOnDelivery: number | null
}

// `KargoTuru` 3 koli; `OdemeTipi` 1 the sender pays; `TasimaSekli`, `TeslimSekli` 1 as the
// sources send them (to the address); meanings to confirm with Sürat
const PARCEL = 3
const SENDER_PAYS = 1
const STANDARD = 1
// `KapidanOdemeTahsilatTipi`: 0 nothing collected, 1 cash (2 card, which we do not offer)
const NO_COLLECTION = 0
const CASH = 1

const cut = (value: string, length: number): string => Array.from(value).slice(0, length).join("")

const decimal = (value: number): string => value.toFixed(2)

/** One parcel's desi as Sürat records it: its volume / 3000, to two decimals up. */
export function suratDesi(parcel: Pick<Parcel, "length_cm" | "width_cm" | "height_cm">): number {
  const desi = (parcel.length_cm * parcel.width_cm * parcel.height_cm) / 3000
  return Math.max(0, Math.ceil(desi * 100 - 1e-9) / 100)
}

/** The `Gonderi` element of `GonderiyiKargoyaGonderYeni`. */
export function suratShipmentFields(input: SuratShipmentInput): XmlFields {
  const cod = input.cashOnDelivery !== null && input.cashOnDelivery > 0
  return {
    KisiKurum: cut(input.receiver.name, 200),
    SahisBirim: "",
    AliciAdresi: cut(input.receiver.address, 500),
    Il: input.receiver.city,
    Ilce: input.receiver.town,
    TelefonEv: "",
    TelefonIs: "",
    // Ten digits, no leading 0 (the sources normalise it so)
    TelefonCep: input.receiver.phone.replace(/^0/, ""),
    Email: "",
    AliciKodu: "",
    KargoTuru: PARCEL,
    OdemeTipi: SENDER_PAYS,
    IrsaliyeSeriNo: "",
    IrsaliyeSiraNo: cut(input.orderNumber, 20),
    // Our code here too: tracking asks by `WebSiparisKodu`, which the sources fill from either
    ReferansNo: input.code,
    OzelKargoTakipNo: input.code,
    Adet: 1,
    BirimDesi: input.desi === null ? "" : decimal(input.desi),
    BirimKg: input.kg === null ? "" : decimal(input.kg),
    KargoIcerigi: cut(`Sipariş ${input.orderNumber}`, 100),
    KapidanOdemeTahsilatTipi: cod ? CASH : NO_COLLECTION,
    KapidanOdemeTutari: cod ? toMedusaAmount(kurus(input.cashOnDelivery ?? 0)) : "0",
    EkHizmetler: "",
    TasimaSekli: STANDARD,
    TeslimSekli: STANDARD,
    SevkAdresi: "",
    GonderiSekli: 0,
    TeslimSubeKodu: "",
    Pazaryerimi: 0,
    EntegrasyonFirmasi: "",
    Iademi: false,
    AlimSaati: "",
  }
}
