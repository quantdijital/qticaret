import type { ShipmentStatus } from "../../../modules/shipment-tracking/states"
import { fakeTrackingUrl } from "../carriers"
import type { ArasRow } from "./client"

/**
 * Where an Aras parcel stands (adr/0035). Aras's tracking answer is a
 * DataSet whose columns come with the contract, so the status is read
 * from the words Aras shows shoppers ("Teslim Edildi", "Dağıtımda"), in
 * the latest row's status columns only: the receiver's name and address
 * are the shopper's own words and say nothing. The tracking number comes
 * from a column named for it. To confirm with a real account (PROGRESS).
 */

const RULES: readonly [RegExp, ShipmentStatus][] = [
  [/İADE|IADE/, "returned"],
  [/TESLİM EDİLDİ|TESLIM EDILDI/, "delivered"],
  [/DAĞITIM|DAGITIM/, "out_for_delivery"],
  [/İPTAL|IPTAL/, "canceled"],
  [/TESLİM EDİLEMEDİ|TESLIM EDILEMEDI|ADRESTE BULUNAMADI/, "failed"],
  [/YOLDA|TRANSFER|AKTARMA|SEVK/, "in_transit"],
  [/TESLİM ALINDI|TESLIM ALINDI|KABUL|ÇIKIŞ|CIKIS/, "picked_up"],
]

const TRACKING_COLUMN = /TAKIP|BARKOD|KARGO_?NO|CARGO_?KEY/i
// Aras's own words about the parcel; never a name, an address or a note
const STATUS_COLUMN = /DURUM|STATU/i

/**
 * Aras's public tracking page for a parcel; the fake Aras's own page when
 * one is set (`ARAS_BASE_URL`, a developer's machine only).
 */
export const arasTrackingUrl = (number: string, fakeBase?: string | null): string =>
  fakeBase
    ? fakeTrackingUrl(fakeBase, number)
    : `https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${encodeURIComponent(number)}`

export function arasStatusOf(
  rows: readonly Record<string, string>[],
  fakeBase?: string | null
): {
  status: ShipmentStatus
  provider_status: string | null
  tracking_number: string | null
  tracking_url: string | null
} {
  const row: ArasRow = rows[rows.length - 1] ?? {}
  const values = Object.entries(row)
    .filter(([column]) => STATUS_COLUMN.test(column))
    .map(([, value]) => value.toLocaleUpperCase("tr"))
  // "Teslim edilemedi" reads as failed, not delivered: the longer phrase first
  const failed = values.some((value) => RULES[4]?.[0].test(value))
  const rule = failed
    ? RULES[4]
    : RULES.find(([pattern]) => values.some((value) => pattern.test(value)))
  const number =
    Object.entries(row).find(
      ([column, value]) => TRACKING_COLUMN.test(column) && /^\d{6,20}$/.test(value)
    )?.[1] ?? null
  return {
    status: rows.length === 0 ? "created" : (rule?.[1] ?? "created"),
    provider_status: rule ? (values.find((value) => rule[0].test(value)) ?? null) : null,
    tracking_number: number,
    tracking_url: number ? arasTrackingUrl(number, fakeBase) : null,
  }
}
