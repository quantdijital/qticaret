import type { ShipmentStatus } from "../../../modules/shipment-tracking/states"
import { fakeTrackingUrl } from "../carriers"

/**
 * Where a Yurtiçi parcel stands (adr/0035), from `queryShipment`, as
 * Yurtiçi's "Web Servis Giden Kargo Teknik Döküman V3" gives it
 * (docs/entegrasyonlar/yurtici.md): the operation status says the stage,
 * the return's own code (`rejectStatus`) says a return, the words Yurtiçi
 * shows for the last event tell a failed delivery and the last mile apart
 * while the parcel is on its way. To confirm with a real account (PROGRESS).
 */

/** One parcel of a `queryShipment` answer. */
export interface YurticiDelivery {
  /** Yurtiçi knows the cargo key on this account. */
  found: boolean
  operationCode: number | null
  /** NOP, IND, ISR, CNL, ISC, DLV or BI. */
  operationStatus: string | null
  operationMessage: string | null
  /** Yurtiçi's own shipment number, once the branch has the parcel. */
  docId: string | null
  trackingUrl: string | null
  /** The return's stage (`rejectStatus`, 0–11); null when no return was asked for. */
  rejectStatus: string | null
  /** What Yurtiçi shows for the last event and its reason. */
  words: string[]
}

// NOP not processed, IND on its way (or a return asked for), ISR taken (no document yet),
// CNL kept from leaving, ISC canceled before, DLV delivered, BI document canceled by the branch
const STAGES: Readonly<Record<string, ShipmentStatus>> = {
  NOP: "created",
  IND: "in_transit",
  ISR: "picked_up",
  CNL: "canceled",
  ISC: "canceled",
  DLV: "delivered",
  BI: "canceled",
}

// The document's code table; its own sample answers number them otherwise (CNL as 2),
// so the letters decide and the number only stands in when they are missing
const CODES: Readonly<Record<number, string>> = {
  0: "NOP",
  1: "IND",
  2: "ISR",
  3: "CNL",
  4: "ISC",
  5: "DLV",
  6: "BI",
}

/** The operation status an answer gives: its letters, else its code by the document's table. */
export function yurticiOperationStatus(status: string | null, code: number | null): string | null {
  const named = (status ?? "").trim().toUpperCase()
  if (Object.hasOwn(STAGES, named)) {
    return named
  }
  return code !== null && Object.hasOwn(CODES, code) ? (CODES[code] ?? null) : null
}

// rejectStatus 0, 1, 2, 3, 9 and 10: the parcel is being returned; 4, 7, 8 and 11: the
// return was called off and the parcel goes on as before
const RETURNING = new Set(["0", "1", "2", "3", "9", "10"])

const RETURNED = /İADE|IADE/
const FAILED = /TESLİM EDİLEMEDİ|TESLIM EDILEMEDI|ADRESTE BULUNAMADI/
const LAST_MILE = /DAĞITIM|DAGITIM/

/**
 * Yurtiçi's public tracking page for a parcel, when the answer gives none;
 * the fake Yurtiçi's own page when one is set (`YURTICI_BASE_URL`, a
 * developer's machine only).
 */
export const yurticiTrackingUrl = (docId: string, fakeBase?: string | null): string =>
  fakeBase
    ? fakeTrackingUrl(fakeBase, docId)
    : `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${encodeURIComponent(docId)}`

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

export function yurticiStatusOf(
  delivery: YurticiDelivery,
  fakeBase?: string | null
): {
  status: ShipmentStatus
  provider_status: string | null
  tracking_number: string | null
  tracking_url: string | null
} {
  const words = [...delivery.words, delivery.operationMessage ?? ""].map((word) =>
    word.toLocaleUpperCase("tr")
  )
  const says = (pattern: RegExp) => words.some((word) => pattern.test(word))
  const operation = yurticiOperationStatus(delivery.operationStatus, delivery.operationCode)
  const stage = delivery.found && operation ? (STAGES[operation] ?? "created") : "created"
  const returning = RETURNING.has((delivery.rejectStatus ?? "").trim()) || says(RETURNED)
  const status: ShipmentStatus =
    (stage === "in_transit" || stage === "delivered") && returning
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
    // A fake's answer names no page of Yurtiçi's: its own page stands in
    tracking_url:
      (fakeBase ? null : yurticiPage(delivery.trackingUrl)) ??
      (docId ? yurticiTrackingUrl(docId, fakeBase) : null),
  }
}
