import type { Translate } from "@qticaret/ui"
import { escapeHtml } from "@/lib/security/html"
import { isStoreApiError } from "@/lib/store-api/errors"
import { storeCall } from "@/lib/store-api/server"

/**
 * A booking's voucher (adr/0076 Ek D7b) as `GET /store/orders/:id/voucher`
 * gives it to the order's own shopper: the order's number, departures and
 * places, and the check code staff ask for. No one's name.
 */
export interface VoucherDepartureRow {
  title: string
  /** Written out by the server in the product's zone. */
  when: string
  starts_at: string
  meeting_point: string | null
  units: number
  cancelled: boolean
}

export interface VoucherRow {
  order_number: string
  status: "valid" | "cancelled"
  code: string
  departures: VoucherDepartureRow[]
}

/** The order's vouchers; null when it has none or is not the visitor's (404). */
export async function orderVouchers(
  id: string,
  token: string | null
): Promise<VoucherRow[] | null> {
  try {
    const { vouchers } = await storeCall<{ vouchers: VoucherRow[] }>(
      `/store/orders/${encodeURIComponent(id)}/voucher`,
      token ? { headers: { "x-order-token": token } } : {}
    )
    return vouchers
  } catch (error) {
    if (isStoreApiError(error) && (error.status === 404 || error.status === 403)) {
      return null
    }
    throw error
  }
}

const departureHtml = (departure: VoucherDepartureRow, t: Translate): string =>
  [
    `<h3>${escapeHtml(departure.title)}</h3>`,
    "<ul>",
    `<li>${escapeHtml(t("voucher.when", { when: departure.when }))}</li>`,
    departure.meeting_point
      ? `<li>${escapeHtml(t("voucher.meeting_point", { place: departure.meeting_point }))}</li>`
      : "",
    `<li>${escapeHtml(t("voucher.units", { count: departure.units }))}</li>`,
    departure.cancelled
      ? `<li><strong>${escapeHtml(t("voucher.departure_cancelled"))}</strong></li>`
      : "",
    "</ul>",
  ].join("")

/**
 * The vouchers as the content page prints them. Every value is escaped
 * here: the page prints this HTML as it is.
 */
export function voucherHtml(vouchers: readonly VoucherRow[], t: Translate): string {
  return vouchers
    .map((voucher) =>
      [
        `<h2>${escapeHtml(t("voucher.order", { number: voucher.order_number }))}</h2>`,
        `<p>${escapeHtml(t("voucher.code"))} <strong><code>${escapeHtml(voucher.code)}</code></strong></p>`,
        `<p><strong>${escapeHtml(t(voucher.status === "valid" ? "voucher.valid" : "voucher.cancelled"))}</strong></p>`,
        ...voucher.departures.map((departure) => departureHtml(departure, t)),
      ].join("")
    )
    .concat(`<p>${escapeHtml(t("voucher.note"))}</p>`)
    .join("<hr>")
}
