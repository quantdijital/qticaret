import type { ShipmentStatus } from "../../../modules/shipment-tracking/states"
import { fakeTrackingUrl } from "../carriers"
import { columnOf } from "./tracking"
import type { SuratRow, SuratTracking } from "./tracking"

/**
 * Where a Sürat parcel stands (docs/entegrasyonlar/surat.md, "Durum
 * eşlemesi"): each movement read by the event's name when Sürat gives one
 * (its `KargoHareketTip`, `KTeslimatDurum` and `KIptalDurumu` values),
 * else by its Turkish words; the latest movement that says something wins.
 * Only Sürat's own columns are read (event, status, explanation), never a
 * receiver's name or address. The answer's shape and the names it carries
 * are to confirm with a real account.
 */

/** Our status for an event name; null: the event moves nothing (a claim, a new barcode). */
const EVENTS: Readonly<Record<string, ShipmentStatus | null>> = Object.fromEntries(
  (
    [
      ["KargoAdrestenTeslimAlindi", "picked_up"],
      ["KargoSubedeTeslimAlindi", "picked_up"],
      ...[
        "AracYolaCikti",
        "AracVarisYapti",
        "KargoAracaYuklendi",
        "KargoAractanIndirildi",
        "KargoAraciyaVerildi",
        "KargoDevir",
        "KargoParcalandi",
        "KargoBirlestirildi",
        "KargoParcaGiris",
        "KargoButunGiris",
        "YanlisSubede",
        "KargoYonlendirme",
        "KargoYonlendirmeTalep",
        "KargoYonlendirmeOnay",
        "TeslimatNoktasinaIletildi",
        "Yonlendirilecek",
        "Devir",
        "TeslimatNoktasiDevir",
      ].map((name) => [name, "in_transit"] as const),
      ["KargoDagitimaCikti", "out_for_delivery"],
      ["KargoKuryeyeZimmetlendi", "out_for_delivery"],
      // Left at a pick-up point: the receiver still has to collect it
      ["TeslimatNoktasinaBirakildi", "out_for_delivery"],
      ["KargoAdresteTeslimEdildi", "delivered"],
      ["KargoSubedeTeslimEdildi", "delivered"],
      ["TeslimatNoktasinadanAlindi", "delivered"],
      ["TeslimEdildi", "delivered"],
      ["KargoAdresteIade", "returned"],
      ["KargoSubedeIade", "returned"],
      ["KargoIadeOnay", "returned"],
      ["IadeEdilecek", "returned"],
      ["IptalEdildi", "canceled"],
      ...[
        "KargoIadeTalep",
        "KargoIadeRet",
        "KargoIadeTalepIptal",
        "KargoTeslimatiIptalEdildi",
        "KargoBulundu",
        "KargoYeniBarkodUretildi",
        "KargoKuryedenZimmetAlindi",
        "Ihbar",
        "TeslimatHazirlik",
        "Kullanimda",
        "IptalIcinOnayda",
        "IptalOnaylandi",
        "Takipte",
      ].map((name) => [name, null] as const),
    ] as const
  ).map(([name, status]) => [columnOf(name), status])
)

// The words fallback, first match wins: "teslim edilemedi" before "teslim edildi", and a
// failed delivery stays on its way (Sürat tries again; our `failed` is final)
const WORDS: readonly [RegExp, ShipmentStatus][] = [
  [/teslim edilemedi|teslim edilmedi/, "in_transit"],
  [/teslim edildi|teslimat yapıldı/, "delivered"],
  [/iade edildi|iade teslim|göndericiye iade/, "returned"],
  [/iptal edildi|pasif/, "canceled"],
  [/dağıtıma|dağıtımda|kuryede/, "out_for_delivery"],
  [/teslim alındı|kabul/, "picked_up"],
  [/şubede|transfer|aktarma|yolda|sevk/, "in_transit"],
]

// Sürat's own words about the parcel; never a person, a place or a time
const STATUS_COLUMN = /HAREKET|ISLEM|DURUM|STATU|ACIKLAMA|ETIKET|TIP/
const OTHER_COLUMN =
  /ALICI|GONDEREN|ADRES|KISI|TELEFON|TARIH|ZAMAN|SAAT|YERI|BIRIM|SUBE|ILCE|TESLIMALAN|NO$/
const TRACKING_COLUMN = /KARGOTAKIPNO|^TAKIPNO$/
const DATE_COLUMN = /TARIH|ZAMAN/

const statusValues = (row: SuratRow): string[] =>
  Object.entries(row)
    .filter(([column]) => STATUS_COLUMN.test(column) && !OTHER_COLUMN.test(column))
    .map(([, value]) => value)
    .filter((value) => value !== "")

/** What one movement says: its event's status, null when it says nothing new. */
function movementOf(row: SuratRow): { status: ShipmentStatus | null; said: string | null } {
  const values = statusValues(row)
  const named = values.find((value) => Object.hasOwn(EVENTS, columnOf(value)))
  if (named !== undefined) {
    return { status: EVENTS[columnOf(named)] ?? null, said: named }
  }
  // Only the words that matched are kept: Sürat's sentence may name the person who signed
  // for the parcel (KVKK, security review 2026-11-26)
  for (const value of values) {
    const words = value.toLocaleLowerCase("tr")
    for (const [pattern, status] of WORDS) {
      const found = pattern.exec(words)
      if (found) {
        return { status, said: found[0] }
      }
    }
  }
  return { status: null, said: null }
}

/** A movement's time ("26.11.2026 14:30", or ISO); null when it reads as neither. */
function timeOf(row: SuratRow): number | null {
  const value = Object.entries(row).find(([column]) => DATE_COLUMN.test(column))?.[1] ?? ""
  const tr = /^(\d{2})\.(\d{2})\.(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(value)
  if (tr) {
    const [, d, m, y, hh = "0", mm = "0", ss = "0"] = tr
    return Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss))
  }
  const iso = Date.parse(value)
  return Number.isNaN(iso) ? null : iso
}

/** The movements oldest first: by their times when each has one, else as Sürat lists them. */
function inOrder(rows: readonly SuratRow[]): SuratRow[] {
  const times = rows.map(timeOf)
  if (times.some((time) => time === null)) {
    return [...rows]
  }
  return rows
    .map((row, index) => ({ row, time: times[index] ?? 0, index }))
    .sort((a, b) => a.time - b.time || a.index - b.index)
    .map(({ row }) => row)
}

/**
 * Sürat's public tracking page for its number; the fake Sürat's own page
 * when one is set (`SURAT_BASE_URL`, a developer's machine only). Pattern
 * from the owner's plugin, to confirm.
 */
export const suratTrackingUrl = (number: string, fakeBase?: string | null): string =>
  fakeBase
    ? fakeTrackingUrl(fakeBase, number)
    : `https://suratkargo.com.tr/KargoTakip/?kargotakipno=${encodeURIComponent(number)}`

export function suratStatusOf(
  tracking: SuratTracking,
  fakeBase?: string | null
): {
  status: ShipmentStatus
  provider_status: string | null
  tracking_number: string | null
  tracking_url: string | null
} {
  let status: ShipmentStatus = "created"
  let said: string | null = null
  let number: string | null = null
  for (const row of inOrder(tracking.rows)) {
    const movement = movementOf(row)
    if (movement.status) {
      status = movement.status
      said = movement.said
    }
    // Sürat's own number, once the branch has the parcel; never our code
    const own = Object.entries(row).find(
      ([column, value]) => TRACKING_COLUMN.test(column) && !column.includes("OZEL") && value
    )?.[1]
    if (own && /^\d{6,20}$/.test(own)) {
      number = own
    }
  }
  return {
    status: tracking.found ? status : "created",
    provider_status: said === null ? null : Array.from(said).slice(0, 120).join(""),
    tracking_number: number,
    tracking_url: number ? suratTrackingUrl(number, fakeBase) : null,
  }
}
