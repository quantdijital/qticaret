import type { ShipmentStatus } from "../../../modules/shipment-tracking/states"

/**
 * Where a Yurtiçi parcel stands (adr/0035), from `queryShipment`: the
 * operation code says the stage, the words Yurtiçi shows for the last
 * event tell a return, a failed delivery and the last mile apart while
 * the parcel is on its way. To confirm with a real account (PROGRESS).
 */

/** One parcel of a `queryShipment` answer. */
export interface YurticiDelivery {
  /** Yurtiçi knows the cargo key on this account. */
  found: boolean
  operationCode: number | null
  operationMessage: string | null
  /** Yurtiçi's own shipment number, once the branch has the parcel. */
  docId: string | null
  trackingUrl: string | null
  /** What Yurtiçi shows for the last event and its reason, return and refusal included. */
  words: string[]
}

// 0 NOP not processed, 1 IND on its way, 2 ISR taken (no document yet), 3 CNL kept from
// leaving, 4 ISC canceled before, 5 DLV delivered, 6 BI document canceled by the branch
const CODES: Readonly<Record<number, ShipmentStatus>> = {
  0: "created",
  1: "in_transit",
  2: "picked_up",
  3: "canceled",
  4: "canceled",
  5: "delivered",
  6: "canceled",
}

const RETURNED = /İADE|IADE/
const FAILED = /TESLİM EDİLEMEDİ|TESLIM EDILEMEDI|ADRESTE BULUNAMADI/
const LAST_MILE = /DAĞITIM|DAGITIM/

/** Yurtiçi's public tracking page for a parcel, when the answer gives none. */
export const yurticiTrackingUrl = (docId: string): string =>
  `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${encodeURIComponent(docId)}`

/** Yurtiçi's own page from an answer: https on its hosts only, shown to shoppers and staff. */
const yurticiPage = (value: string | null): string | null => {
  if (!value || value.length > 2048) {
    return null
  }
  try {
    const url = new URL(value)
    return url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      /(^|\.)yurticikargo\.com$/.test(url.hostname)
      ? value
      : null
  } catch {
    return null
  }
}

export function yurticiStatusOf(delivery: YurticiDelivery): {
  status: ShipmentStatus
  provider_status: string | null
  tracking_number: string | null
  tracking_url: string | null
} {
  const words = delivery.words.map((word) => word.toLocaleUpperCase("tr"))
  const says = (pattern: RegExp) => words.some((word) => pattern.test(word))
  const stage = delivery.found ? (CODES[delivery.operationCode ?? 0] ?? "created") : "created"
  const status: ShipmentStatus =
    (stage === "in_transit" || stage === "delivered") && says(RETURNED)
      ? "returned"
      : stage === "in_transit" && says(FAILED)
        ? "failed"
        : stage === "in_transit" && says(LAST_MILE)
          ? "out_for_delivery"
          : stage
  const docId = delivery.docId && /^\d{6,20}$/.test(delivery.docId) ? delivery.docId : null
  return {
    status,
    provider_status: delivery.operationMessage,
    tracking_number: docId,
    tracking_url: yurticiPage(delivery.trackingUrl) ?? (docId ? yurticiTrackingUrl(docId) : null),
  }
}
