import { findAll, findFirst } from "../../clients/xml"
import type { XmlNode } from "../../clients/xml"
import { ProviderError } from "../../errors"
import { yurticiOperationStatus } from "./status"
import type { YurticiDelivery } from "./status"

/**
 * How Yurtiçi's answers read (adr/0035), as its "Web Servis Giden Kargo
 * Teknik Döküman V3" gives them: `outFlag` 0 for success (on
 * `createShipment`: at least one parcel taken), a line per parcel with its
 * `errCode` (0 when taken), and its operation status on a query or a
 * withdrawal. Error lines name no cargo key.
 */

export const YURTICI_PROVIDER = "yurtici"

/** ERR_INTG_CARGO_KEY_NOT_FOUND: this login has no parcel under the key. */
export const KEY_NOT_FOUND = "82519"
/** ERR_INTG_CARGO_KEY_OPERATION_CANCELLED: the key was withdrawn before. */
const CANCELED_BEFORE = "82520"

/**
 * A refused login: a fault (HTTP 500, or 200) whose `errorCode` is this.
 * Yurtiçi's document does not say how it refuses one (docs/entegrasyonlar/
 * yurtici.md, open questions); the fake service answers it so, and the
 * document's table gives 936 as "unexpected error". Any other fault is
 * the service's refusal of the call, not of the login.
 */
export const LOGIN_REFUSED_CODES: ReadonlySet<string> = new Set(["error_936"])

export const refused = (code: string | null) =>
  new ProviderError({
    provider: YURTICI_PROVIDER,
    providerCode: code && /^-?\d{1,8}$/.test(code) ? `error_${code}` : "rejected",
    retryable: false,
  })

export const invalid = () =>
  new ProviderError({
    provider: YURTICI_PROVIDER,
    providerCode: "invalid_response",
    retryable: false,
  })

/** A child's own text (not a descendant's): the answers repeat names at each level. */
export const own = (node: XmlNode, name: string): string | null => {
  const text = node.children.find((child) => child.name === name)?.text.trim() ?? ""
  return text === "" ? null : text
}

export const succeeded = (code: string | null): boolean => code === null || code === "0"

const integerOf = (value: string | null): number | null => {
  const number = Number(value ?? Number.NaN)
  return Number.isInteger(number) ? number : null
}

/**
 * The parcel's line in an answer: by our cargo key, else a line naming no
 * key. We ask one key a call, and Yurtiçi's error lines carry none.
 */
export const lineOf = (result: XmlNode, name: string, cargoKey: string): XmlNode | null => {
  const lines = findAll(result, name)
  return (
    lines.find((line) => own(line, "cargoKey") === cargoKey) ??
    lines.find((line) => own(line, "cargoKey") === null) ??
    null
  )
}

const NOT_FOUND: YurticiDelivery = {
  found: false,
  operationCode: null,
  operationStatus: null,
  operationMessage: null,
  docId: null,
  trackingUrl: null,
  rejectStatus: null,
  words: [],
}

/** The parcel in a `queryShipment` answer (`ShippingDeliveryVO`); refused on a code it does not expect. */
export function deliveryOf(result: XmlNode, cargoKey: string): YurticiDelivery {
  const line = lineOf(result, "shippingDeliveryDetailVO", cargoKey)
  if (!line) {
    if (own(result, "outFlag") === "2") {
      throw refused(own(result, "errCode"))
    }
    return NOT_FOUND
  }
  // A key this login does not have: its own code, under outFlag 0
  const error = own(line, "errCode")
  if (error === KEY_NOT_FOUND) {
    return NOT_FOUND
  }
  if (!succeeded(error)) {
    throw refused(error)
  }
  const item = findFirst(line, "shippingDeliveryItemDetailVO")
  const read = (name: string) => (item ? own(item, name) : null)
  return {
    found: true,
    operationCode: integerOf(own(line, "operationCode")),
    operationStatus: own(line, "operationStatus"),
    operationMessage: own(line, "operationMessage"),
    docId: read("docId") ?? own(line, "docId"),
    // Given with `onlyTracking` only, by the document: our page for the number stands in
    trackingUrl: read("trackingUrl"),
    rejectStatus: read("rejectStatus"),
    // `returnStatus` is the return-document service's (geri dönüşlü), not a return
    words: ["cargoEventExplanation", "cargoReasonExplanation"].flatMap((name) => read(name) ?? []),
  }
}

/**
 * Why a `cancelShipment` answer is no withdrawal; null when it is. Only CNL
 * (kept from leaving) and ISC (canceled before, or code 82520 on a repeat)
 * are: once the document is issued Yurtiçi takes the call as a return
 * request (IND) and the parcel comes back; a delivered one (DLV) stays so.
 */
export function withdrawalRefusal(result: XmlNode, cargoKey: string): ProviderError | null {
  const line = lineOf(result, "shippingCancelDetailVO", cargoKey)
  const code = line ? own(line, "errCode") : own(result, "errCode")
  if (code === CANCELED_BEFORE) {
    return null
  }
  if (own(result, "outFlag") !== "0" || !succeeded(code)) {
    return refused(code)
  }
  const status = line
    ? yurticiOperationStatus(own(line, "operationStatus"), integerOf(own(line, "operationCode")))
    : null
  if (status === "CNL" || status === "ISC") {
    return null
  }
  return new ProviderError({
    provider: YURTICI_PROVIDER,
    providerCode:
      status === "IND"
        ? "return_requested"
        : status
          ? `status_${status.toLowerCase()}`
          : "rejected",
    retryable: false,
  })
}
