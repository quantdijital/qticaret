import type { ShipmentStatus } from "../../../modules/shipment-tracking/states"
import { providerText } from "../../errors"
import { fakeTrackingUrl } from "../carriers"
import type { PttEvent, PttTracking } from "./client"

/**
 * Where a PTT parcel stands (docs/entegrasyonlar/ptt.md, "Durum
 * eşlemesi"): each event read by PTT's status id (`gonderiDurumId`) when
 * it is one we know, else by its Turkish words; the latest event that
 * says something wins. The ids come from a community list of PTT's codes
 * (not PTT's official one): to confirm with a real account. A failed
 * delivery attempt ("teslim edilemedi": not at home, address unknown)
 * stays on its way: PTT tries again or sends it back, and our `failed` is
 * final. Only lasting losses (destroyed, seized, lost, damaged, written
 * off) are `failed`.
 */

/** Our status for a known id; null: the event moves nothing (a fee paid, a cancel undone). */
const IDS: Readonly<Record<string, ShipmentStatus | null>> = {
  // KABUL: accepted at a branch, registered
  "1": "picked_up",
  "701": "picked_up",
  // SEVK, GERİ ZİMMET, DEPO: bagged, sent on, waiting at a PTT office
  "3": "in_transit",
  "77": "in_transit",
  "174": "in_transit",
  "650": "in_transit",
  // DAĞITIM and the courier's handheld: out, or a delivery attempt
  "7": "out_for_delivery",
  "532": "out_for_delivery",
  "600": "out_for_delivery",
  // TESLİM EDİLEMEDİ, passing reasons: still on its way
  "118": "in_transit",
  "127": "in_transit",
  // TESLİM
  "100": "delivered",
  "807": "delivered",
  // İADE, GÖNDERİCİSİNE TESLİM
  "99": "returned",
  "151": "returned",
  "120": "returned",
  // KABUL İPTAL
  "2": "canceled",
  // Lasting: destroyed, seized, taken out of the system, written off, lost, damaged
  "109": "failed",
  "147": "failed",
  "21": "failed",
  "831": "failed",
  "180": "failed",
  "181": "failed",
  // Moves nothing: updates, fees, a return, a delivery or a destruction undone
  "159": null,
  "399": null,
  "165": null,
  "15": null,
  "501": null,
}

// The words fallback, first match wins: what undoes comes first, "teslim edilemedi" before
// "teslim edildi", "göndericisine teslim" before "teslim edildi"
const WORDS: readonly [RegExp, ShipmentStatus | null][] = [
  [/iade iptal|teslim iptal|imha iptal|ücret|ucret|güncelle/, null],
  [/teslim edilemedi|teslim edilmedi|yerinde yok|tanınmıyor|adres/, "in_transit"],
  [/göndericisine teslim|göndericiye teslim|iade/, "returned"],
  [/teslim edildi|teslim alındı \(alıcı\)|muhataba/, "delivered"],
  [/kayıp|hasar|imha|el koy|tasfiye|sistemden çıkar/, "failed"],
  [/iptal/, "canceled"],
  [/dağıtıcı|dağıtım/, "out_for_delivery"],
  [/kabul|kayıt edildi/, "picked_up"],
  [/sevk|torba|aktarma|bekliyor|depo|transfer/, "in_transit"],
]

/** What one event says: its status, and the words kept for staff. */
function eventOf(event: PttEvent): { status: ShipmentStatus | null; said: string | null } {
  if (event.statusId !== null && Object.hasOwn(IDS, event.statusId)) {
    return { status: IDS[event.statusId] ?? null, said: event.said }
  }
  const words = (event.said ?? "").toLocaleLowerCase("tr")
  for (const [pattern, status] of WORDS) {
    if (pattern.test(words)) {
      return { status, said: event.said }
    }
  }
  return { status: null, said: null }
}

/**
 * PTT's public tracking page for the barcode; the fake PTT's own page when
 * one is set (`PTT_BASE_URL`, a developer's machine only). Pattern from
 * the owner's plugin, to confirm.
 */
export const pttTrackingUrl = (barcode: string, fakeBase?: string | null): string =>
  fakeBase
    ? fakeTrackingUrl(fakeBase, barcode)
    : `https://gonderitakip.ptt.gov.tr/Track/Verify?q=${encodeURIComponent(barcode)}`

export function pttStatusOf(
  tracking: PttTracking,
  barcode: string,
  fakeBase?: string | null
): {
  status: ShipmentStatus
  provider_status: string | null
  tracking_number: string | null
  tracking_url: string | null
} {
  let status: ShipmentStatus = "created"
  let said: string | null = null
  for (const event of tracking.events) {
    const read = eventOf(event)
    if (read.status) {
      status = read.status
      said = read.said
    }
  }
  return {
    status: tracking.found ? status : "created",
    // One line, made safe (a name or a number PTT may write in it masked), cut
    provider_status:
      said === null
        ? null
        : Array.from(providerText(said) ?? "")
            .slice(0, 120)
            .join("") || null,
    // The barcode is PTT's number from the start: the label carries it
    tracking_number: barcode,
    tracking_url: pttTrackingUrl(barcode, fakeBase),
  }
}
