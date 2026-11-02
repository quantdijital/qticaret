/**
 * What Yurtiçi Kargo's "Web Servis Giden Kargo Teknik Döküman V3" says a
 * `createShipment` parcel (`ShippingOrderVO`) must carry, as the error code
 * the service answers (adr/0035, docs/entegrasyonlar/yurtici.md). Where
 * the document gives a rule without its code, 82517 (wrong format) stands
 * in.
 */

/** A field's text in the request; "" when empty or missing. */
export const field = (body: string, name: string): string =>
  new RegExp(`<${name}>([^<]*)</${name}>`).exec(body)?.[1] ?? ""

/** Whether the request carries the element, empty or not. */
export const present = (body: string, name: string): boolean =>
  new RegExp(`<${name}(?:/>|>)`).test(body)

const letters = (value: string) => value.match(/\p{L}/gu)?.length ?? 0
const lettersOrDigits = (value: string) => value.match(/[\p{L}\p{N}]/gu)?.length ?? 0

/** Elements the service's description (WSDL) requires on every parcel, sent empty when unused. */
const ALWAYS_SENT = ["taxOfficeId", "ttDocumentId", "dcSelectedCredit", "dcCreditRule"]

/** Lines of [field, check, code]: the first that fails answers. */
type Rule = readonly [string, (value: string) => boolean, string]

const PARCEL: readonly Rule[] = [
  ["cargoKey", (value) => value !== "", "80859"],
  ["cargoKey", (value) => value.length <= 20, "82500"],
  ["invoiceKey", (value) => value !== "", "60017"],
  ["invoiceKey", (value) => value.length <= 20, "82501"],
  ["receiverCustName", (value) => value !== "", "60018"],
  ["receiverCustName", (value) => value.length <= 200, "82503"],
  // At least 5 characters, 4 of them letters (the document gives no code)
  ["receiverCustName", (value) => value.length >= 5 && letters(value) >= 4, "82517"],
  ["receiverAddress", (value) => value !== "", "60019"],
  ["receiverAddress", (value) => lettersOrDigits(value) >= 10 && value.length <= 500, "82502"],
  // Ten digits with the area code
  ["receiverPhone1", (value) => /^\d{10}$/.test(value), "82516"],
  ["receiverPhone2", (value) => value === "" || /^\d{10}$/.test(value), "82516"],
  ["cityName", (value) => value.length <= 40, "82517"],
  ["townName", (value) => value.length <= 40, "82517"],
  ["emailAddress", (value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "82515"],
  ["desi", (value) => value === "" || /^\d{1,6}(\.\d{1,3})?$/.test(value), "82517"],
  ["kg", (value) => value === "" || /^\d{1,6}(\.\d{1,3})?$/.test(value), "82517"],
  ["specialField1", (value) => value === "" || /^(\d+\$[^$#]{1,100}#)+$/.test(value), "82517"],
]

/** Collected at the door: cash (0) or card (1); the amount with a dot. */
const COLLECTION: readonly Rule[] = [
  ["ttCollectionType", (value) => value === "0" || value === "1", "82513"],
  ["ttInvoiceAmount", (value) => value !== "", "82505"],
  ["ttInvoiceAmount", (value) => value.length <= 18, "82506"],
  // "Separator (.) olmalıdır"
  ["ttInvoiceAmount", (value) => /^\d+(\.\d{1,2})?$/.test(value), "82517"],
  ["ttDocumentId", (value) => value !== "", "82507"],
  ["ttDocumentId", (value) => /^\d{1,12}$/.test(value), "82508"],
  ["ttDocumentSaveType", (value) => value === "0" || value === "1", "82514"],
]

/** A card at the door also needs the instalments. */
const CARD: readonly Rule[] = [
  ["dcSelectedCredit", (value) => value !== "", "82509"],
  ["dcCreditRule", (value) => value !== "", "82511"],
  ["dcCreditRule", (value) => value === "0" || value === "1", "82518"],
]

const broken = (body: string, rules: readonly Rule[]): string | null =>
  rules.find(([name, holds]) => !holds(field(body, name)))?.[2] ?? null

/** The code Yurtiçi answers a parcel with: "0" when it takes it. */
export function parcelError(body: string): string {
  if (!ALWAYS_SENT.every((name) => present(body, name))) {
    return "82517"
  }
  const collected = field(body, "ttCollectionType")
  return (
    broken(body, PARCEL) ??
    (collected === "" ? null : broken(body, COLLECTION)) ??
    (collected === "1" ? broken(body, CARD) : null) ??
    "0"
  )
}

/** Yurtiçi's operation statuses, as its document's table numbers and words them. */
export const OPERATIONS = {
  NOP: { code: 0, message: "Kargo İşlem Görmemiş." },
  IND: { code: 1, message: "Kargo Teslimattadır." },
  RETURN: { code: 1, message: "İade isteği Alınmıştır" },
  ISR: { code: 2, message: "Kargo işlem görmüş, faturası henüz düzenlenmemiştir." },
  CNL: { code: 3, message: "Kargo Çıkışı Engellendi." },
  ISC: { code: 4, message: "Kargo daha önceden iptal edilmiştir." },
  DLV: { code: 5, message: "Kargo teslim edilmiştir." },
} as const

/** A line's operation, as `queryShipment` and `cancelShipment` give it. */
export const operation = (name: keyof typeof OPERATIONS): string => {
  const { code, message } = OPERATIONS[name]
  const status = name === "RETURN" ? "IND" : name
  return `<operationCode>${String(code)}</operationCode><operationMessage>${message}</operationMessage><operationStatus>${status}</operationStatus>`
}
