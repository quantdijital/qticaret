import { randomBytes } from "node:crypto"
import type { IncomingMessage } from "node:http"
import type { AdvanceMode } from "../carrier/tracking"
import type { FakeDhlEcomAccount, FakeDhlEcomApp } from "./fake-server"
import { moveOrder, statusOfOrder } from "./shipments"
import type { FakeDhlEcomOrder } from "./shipments"

/**
 * The fake DHL eCommerce's calls (`./fake-server`): the gateway's checks,
 * then each operation's rules and answers. The refusal codes are the ones
 * the open source clients report (3002, 20001, 26056); the others are the
 * fake's own, in DHL's shape.
 */

export interface FakeDhlEcomState {
  app: FakeDhlEcomApp
  account: FakeDhlEcomAccount
  orders: Map<string, FakeDhlEcomOrder>
  recipients: Set<string>
  /** JWT → when it stops being taken. */
  tokens: Map<string, number>
  held: Set<string>
  queued: Map<string, string[]>
  unsubscribed: Set<string>
  requests: { method: string; path: string; body: unknown }[]
  advance: AdvanceMode
  tokenTtlMs: number
  cities: { code: string; name: string }[]
  districts: (cityCode: string) => unknown[]
  shipmentNumber: () => string
}

interface Answer {
  status: number
  json?: unknown
}

const API = "/mngapi/api"

// Which API product each operation belongs to: an app without its subscription is refused
const PRODUCTS: Readonly<Record<string, string>> = {
  token: "identity",
  createRecipient: "plus",
  createOrder: "standard",
  cancelorder: "standard",
  createbarcode: "barcode",
  cancelshipment: "barcode",
  getshipmentstatus: "query",
  getcities: "cbs",
  getdistricts: "cbs",
}

const gateway = (more: string): Answer => ({
  status: 401,
  json: { httpCode: "401", httpMessage: "Unauthorized", moreInformation: more },
})

/** DHL's refusal: HTTP 500 and its code, as its API answers most of them. */
const refusal = (code: string, description: string, status = 500): Answer => ({
  status,
  json: { error: { code, message: description, description } },
})

type Row = Record<string, unknown>
const rowOf = (value: unknown): Row =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Row) : {}
const text = (row: Row, name: string): string => (typeof row[name] === "string" ? row[name] : "")
const num = (row: Row, name: string): number =>
  typeof row[name] === "number" ? row[name] : Number.NaN

const recipientKey = (recipient: Row): string =>
  [text(recipient, "fullName"), num(recipient, "districtCode"), text(recipient, "address")]
    .join("|")
    .toLocaleLowerCase("tr")

/** What DHL refuses of a recipient, by its code; null when it takes it. */
function recipientRefusal(recipient: Row): Answer | null {
  if (text(recipient, "customerId") !== "" && text(recipient, "fullName") !== "") {
    return refusal("26057", "MÜŞTERİ NUMARASI İLE AD SOYAD BİRLİKTE GÖNDERİLEMEZ")
  }
  if (!/^\d{10}$/.test(text(recipient, "mobilePhoneNumber"))) {
    return refusal("26050", "CEP TELEFONU 10 HANELİ OLMALIDIR")
  }
  if (text(recipient, "email") === "") {
    return refusal("26053", "E-POSTA ADRESİ BOŞ OLAMAZ")
  }
  if (!/^\d{10,11}$/.test(text(recipient, "taxNumber"))) {
    return refusal("26056", "VERGİ/TC KİMLİK NUMARASI BOŞ OLAMAZ")
  }
  if (
    !Number.isInteger(num(recipient, "cityCode")) ||
    !Number.isInteger(num(recipient, "districtCode"))
  ) {
    return refusal("26058", "İL/İLÇE KODU HATALI")
  }
  return null
}

const zplOf = (order: FakeDhlEcomOrder, barcode: string): string =>
  `^XA^CI28^FO40,40^A0N,40,40^FDDHL eCommerce^FS^FO40,120^BCN,120,Y,N,N^FD${barcode}^FS^FO40,300^A0N,30,30^FD${order.recipientName}^FS^XZ`

function createOrder(state: FakeDhlEcomState, body: Row, forced: string | undefined): Answer {
  const order = rowOf(body["order"])
  const recipient = rowOf(body["recipient"])
  const pieces = Array.isArray(body["orderPieceList"]) ? body["orderPieceList"].map(rowOf) : []
  const referenceId = text(order, "referenceId").toUpperCase()
  if (forced && forced !== "lost") {
    return refusal(forced, "HATA")
  }
  if (state.orders.has(referenceId)) {
    return refusal("3002", "BU SİPARİS NUMARASINA AİT KAYIT ZATEN VAR!")
  }
  const refused = recipientRefusal(recipient)
  if (refused) {
    return refused
  }
  if (referenceId === "" || referenceId.length > 30 || pieces.length === 0) {
    return refusal("26001", "SİPARİŞ BİLGİLERİ EKSİK")
  }
  state.orders.set(referenceId, {
    referenceId,
    customer: state.account.customerNumber,
    recipientName: text(recipient, "fullName"),
    address: text(recipient, "address"),
    city: text(recipient, "cityName"),
    district: text(recipient, "districtName"),
    cityCode: num(recipient, "cityCode"),
    districtCode: num(recipient, "districtCode"),
    phone: text(recipient, "mobilePhoneNumber"),
    email: text(recipient, "email"),
    taxNumber: text(recipient, "taxNumber"),
    taxOffice: text(recipient, "taxOffice"),
    desi: pieces.reduce((sum, piece) => sum + (num(piece, "desi") || 0), 0),
    kg: pieces.reduce((sum, piece) => sum + (num(piece, "kg") || 0), 0),
    isCOD: num(order, "isCOD") || 0,
    codAmount: num(order, "codAmount") || 0,
    shipmentId: null,
    barcodes: [],
    barcodeCanceled: false,
    canceled: false,
    step: -1,
    moves: [{ stage: "created", at: new Date().toISOString() }],
  })
  if (forced === "lost") {
    return { status: 500 }
  }
  return {
    status: 200,
    json: [
      { orderInvoiceId: `SIP${referenceId}`, orderInvoiceDetailId: "1", shipperBranchCode: "034" },
    ],
  }
}

function createBarcode(state: FakeDhlEcomState, body: Row, forced: string | undefined): Answer {
  const referenceId = text(body, "referenceId").toUpperCase()
  const order = state.orders.get(referenceId)
  if (forced && forced !== "lost") {
    return refusal(forced, forced === "20001" ? "VARIŞ ŞUBESİ BULUNAMADI" : "HATA")
  }
  if (!order || order.canceled) {
    return refusal("30010", "SİPARİŞ BULUNAMADI")
  }
  if (order.shipmentId && !order.barcodeCanceled) {
    return refusal("30011", "BU SİPARİŞİN BARKODU ZATEN VAR")
  }
  // No recipient registered first: DHL has not found the branch yet
  const registered = [...state.recipients].some((key) =>
    key.endsWith(`|${String(order.districtCode)}|${order.address}`.toLocaleLowerCase("tr"))
  )
  if (!registered) {
    return refusal("20001", "VARIŞ ŞUBESİ BULUNAMADI")
  }
  order.shipmentId = state.shipmentNumber()
  order.barcodeCanceled = false
  order.barcodes = [`C@${randomBytes(6).toString("hex").toUpperCase()}@H2`]
  if (forced === "lost") {
    return { status: 500 }
  }
  return {
    status: 200,
    json: [
      {
        referenceId,
        invoiceId: `FM${String(Math.floor(Math.random() * 900_000) + 100_000)}`,
        shipmentId: order.shipmentId,
        barcodes: order.barcodes.map((barcode, index) => ({
          pieceNumber: index + 1,
          barcode,
          value: zplOf(order, barcode),
        })),
      },
    ],
  }
}

function status(state: FakeDhlEcomState, referenceId: string): Answer {
  const order = state.orders.get(referenceId.toUpperCase())
  if (!order) {
    return { status: 200, json: [] }
  }
  if (state.advance === "on-read" && !state.held.has(order.referenceId)) {
    moveOrder(order, order.step + 1)
  }
  const now = statusOfOrder(order)
  return {
    status: 200,
    json: [
      {
        orderId: `SIP${order.referenceId}`,
        referenceId: order.referenceId,
        shipmentId: order.shipmentId ?? "",
        shipmentStatusCode: now.code,
        shipmentStatus: now.status,
        isDelivered: now.code === 5 ? 1 : 0,
        trackingUrl: "",
      },
    ],
  }
}

/** The answer to one request, after the gateway's checks. */
export function answerOf(state: FakeDhlEcomState, req: IncomingMessage, raw: string): Answer {
  const path = (req.url ?? "").split("?")[0] ?? ""
  let body: unknown
  try {
    body = raw === "" ? null : (JSON.parse(raw) as unknown)
  } catch {
    return refusal("400", "GEÇERSİZ İSTEK", 400)
  }
  state.requests.push({ method: req.method ?? "GET", path, body })
  if (!path.startsWith(`${API}/`)) {
    return { status: 404, json: { httpCode: "404", httpMessage: "Not Found" } }
  }
  const parts = path
    .slice(API.length + 1)
    .split("/")
    .map(decodeURIComponent)
  const name = parts.length >= 2 ? (parts[1] ?? "") : (parts[0] ?? "")
  const product = PRODUCTS[name]
  if (!product) {
    return { status: 404, json: { httpCode: "404", httpMessage: "Not Found" } }
  }
  if (
    req.headers["x-ibm-client-id"] !== state.app.clientId ||
    req.headers["x-ibm-client-secret"] !== state.app.clientSecret
  ) {
    return gateway("Client id not registered.")
  }
  if (state.unsubscribed.has(product)) {
    return gateway("Cannot find valid subscription for the incoming API request.")
  }
  if (product !== "cbs" && name !== "token") {
    const jwt = (req.headers.authorization ?? "").replace(/^Bearer /, "")
    const until = state.tokens.get(jwt)
    if (until === undefined || until < Date.now()) {
      return gateway("Invalid token.")
    }
  }
  const forced = state.queued.get(name)?.shift()
  const row = rowOf(body)
  switch (name) {
    case "token": {
      if (forced) {
        return refusal(forced, "HATA")
      }
      const known =
        text(row, "customerNumber") === state.account.customerNumber &&
        text(row, "password") === state.account.password
      if (!known) {
        return refusal("401", "MÜŞTERİ NUMARASI VEYA ŞİFRE HATALI", 401)
      }
      const jwt = `eyJ${randomBytes(24).toString("base64url")}`
      state.tokens.set(jwt, Date.now() + state.tokenTtlMs)
      return { status: 200, json: { jwt, refreshToken: randomBytes(8).toString("hex") } }
    }
    case "createRecipient": {
      const recipient = rowOf(row["recipient"])
      const refused = recipientRefusal(recipient)
      if (refused) {
        return refused
      }
      state.recipients.add(recipientKey(recipient))
      return { status: 200, json: [{ shipperBranchCode: "034" }] }
    }
    case "createOrder":
      return createOrder(state, row, forced)
    case "createbarcode":
      return createBarcode(state, row, forced)
    case "cancelshipment": {
      const order = state.orders.get(text(row, "referenceId").toUpperCase())
      if (forced) {
        return refusal(forced, "HATA")
      }
      if (order?.shipmentId !== text(row, "shipmentId")) {
        return refusal("30010", "GÖNDERİ BULUNAMADI")
      }
      // Once the branch has it, a barcode stays
      if (order.step >= 0) {
        return refusal("30020", "ŞUBE KABULÜ YAPILMIŞ GÖNDERİ İPTAL EDİLEMEZ")
      }
      order.barcodeCanceled = true
      return { status: 200, json: [{ referenceId: order.referenceId, isCanceled: true }] }
    }
    case "cancelorder": {
      const order = state.orders.get((parts[2] ?? "").toUpperCase())
      if (forced) {
        return refusal(forced, "HATA")
      }
      if (!order) {
        return refusal("30010", "SİPARİŞ BULUNAMADI")
      }
      if (order.shipmentId && !order.barcodeCanceled) {
        return refusal("30021", "BARKODU OLAN SİPARİŞ İPTAL EDİLEMEZ; ÖNCE BARKODU İPTAL EDİN")
      }
      order.canceled = true
      return { status: 200, json: [{ referenceId: order.referenceId, isCanceled: true }] }
    }
    case "getshipmentstatus":
      return forced ? refusal(forced, "HATA") : status(state, parts[2] ?? "")
    case "getcities":
      return { status: 200, json: state.cities }
    case "getdistricts":
      return { status: 200, json: state.districts(parts[2] ?? "") }
    default:
      return { status: 404 }
  }
}
