import type { ShipmentStatus } from "../../../modules/shipment-tracking/states"
import { fakeTrackingUrl } from "../carriers"

/**
 * Where a DHL eCommerce parcel stands (docs/entegrasyonlar/dhlecommerce.md),
 * from `getshipmentstatus/{referenceId}`: its `shipmentStatusCode` (1–8,
 * the Standard Query's table as the open source clients give it; to
 * confirm with a real account), its shipment number and DHL's own page.
 */

export interface DhlEcomDelivery {
  /** DHL knows the reference on this account. */
  found: boolean
  code: number | null
  /** DHL's words for the status ("Teslim Edildi"). */
  status: string | null
  /** DHL's shipment number (12 digits), once the barcode is made. */
  shipmentId: string | null
  trackingUrl: string | null
}

// 1 prepared; 2 in transfer; 3 at the delivering branch; 4 out to the address; 5 delivered;
// 6 not delivered (DHL tries again: on its way, not an end); 7 coming back; 8 support needed
const STAGES: Readonly<Record<number, ShipmentStatus>> = {
  1: "created",
  2: "in_transit",
  3: "in_transit",
  4: "out_for_delivery",
  5: "delivered",
  6: "in_transit",
  7: "returned",
}

/** DHL eCommerce's public tracking page (the number typed there); a fake's own page when one is set. */
export const dhlEcomTrackingUrl = (shipmentId: string, fakeBase?: string | null): string =>
  fakeBase ? fakeTrackingUrl(fakeBase, shipmentId) : "https://www.dhlecommerce.com.tr/gonderitakip"

/** DHL's own page from an answer: https on its hosts only, shown to shoppers and staff. */
const dhlPage = (value: string | null): string | null => {
  if (!value || value.length > 2048) {
    return null
  }
  try {
    const url = new URL(value)
    return url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      /(^|\.)(dhlecommerce\.com\.tr|mngkargo\.com\.tr)$/.test(url.hostname)
      ? value
      : null
  } catch {
    return null
  }
}

export function dhlEcomStatusOf(
  delivery: DhlEcomDelivery,
  fakeBase?: string | null
): {
  status: ShipmentStatus
  provider_status: string | null
  tracking_number: string | null
  tracking_url: string | null
} {
  const code = delivery.code
  // 8 (support needed) and an unknown code move nothing: the parcel stays where it was
  const status =
    delivery.found && code !== null && Object.hasOwn(STAGES, code)
      ? (STAGES[code] ?? "created")
      : "created"
  const shipmentId =
    delivery.shipmentId && /^\d{6,20}$/.test(delivery.shipmentId) ? delivery.shipmentId : null
  return {
    status,
    provider_status: delivery.status,
    tracking_number: shipmentId,
    // A fake's answer names no page of DHL's: its own page stands in
    tracking_url:
      (fakeBase ? null : dhlPage(delivery.trackingUrl)) ??
      (shipmentId ? dhlEcomTrackingUrl(shipmentId, fakeBase) : null),
  }
}
