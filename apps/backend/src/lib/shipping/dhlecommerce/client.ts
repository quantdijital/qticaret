import { registerProcessCache } from "../../cache/process-caches"
import { parseEnv } from "../../env"
import { ValidationError, isProviderError } from "../../errors"
import { DHL_CODES, DHL_ECOMMERCE_PROVIDER, field, invalid, oneOf, textOf } from "./answers"
import type { DhlEcomCredentials } from "./credentials"
import { dhlEcomBarcodeBody, dhlEcomOrderBody, dhlEcomRecipient } from "./mappers"
import type { DhlEcomShipmentInput } from "./mappers"
import { cityPathCode, findPlace, placeOf } from "./places"
import type { DhlEcomPlace } from "./places"
import { API, createDhlEcomSession } from "./session"
import type { DhlEcomOptions } from "./session"
import type { DhlEcomDelivery } from "./status"

/**
 * DHL eCommerce Türkiye's REST API (formerly MNG Kargo; its hosts are still
 * mngkargo.com.tr): docs/entegrasyonlar/dhlecommerce.md. Every call carries
 * the platform's app (`X-IBM-Client-Id`, `X-IBM-Client-Secret`, from the
 * server's environment) and, but for the il/ilçe lists, a JWT the shop's
 * customer number and password get, kept seven of its eight hours per
 * account and asked again once when refused. Neither the app, the password
 * nor the JWT reaches a log (the HTTP client logs fixed fields only) or a
 * refusal's sentence (`secrets`).
 */

export { DHL_ECOMMERCE_PROVIDER }
export { DHL_ECOMMERCE_LIVE_URL, DHL_ECOMMERCE_TEST_URL } from "./session"
export type { DhlEcomOptions } from "./session"

const PLACES_TTL_MS = 24 * 60 * 60 * 1000
/** How long to wait for DHL to find the receiver's branch (error 20001) before giving up. */
const BRANCH_WAITS_MS = [5_000, 10_000]

/** The parcel DHL made: its shipment number, and each piece's barcode and Zebra label. */
export interface DhlEcomBarcode {
  shipmentId: string
  invoiceId: string | null
  pieces: { barcode: string; zpl: string | null }[]
}

/** DHL's words for a status as we keep and show them: one line, printable, short. */
const statusWords = (text: string | null): string | null => {
  const line = text
    ?.replace(/[\p{Cc}\p{Cf}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120)
  return line === undefined || line === "" ? null : line
}

// What DHL prints as a barcode: printable ASCII a Code 128 B symbol takes
const BARCODE = /^[\x20-\x7E]{1,48}$/
const SHIPMENT_ID = /^[0-9A-Za-z]{4,30}$/

export function createDhlEcomApi(options: DhlEcomOptions = {}) {
  const session = createDhlEcomSession(options)
  const { baseOf, send, token, authed, sleep, now, places } = session
  const branchWaitsMs = session.branchWaitsMs ?? BRANCH_WAITS_MS

  /** A CBS Info list (no JWT), kept a day per host. */
  async function placeList(testMode: boolean, path: string): Promise<DhlEcomPlace[]> {
    const key = `${baseOf(testMode)}${path}`
    const kept = places.get(key)
    if (kept && kept.until > now()) {
      return kept.list
    }
    const body = await send(
      testMode,
      { method: "GET", path, idempotent: true, logPath: path.replace(/\/\d+$/, "/:code") },
      null,
      []
    )
    if (!Array.isArray(body)) {
      throw invalid()
    }
    const list = body.flatMap((row) => placeOf(row) ?? [])
    places.set(key, { list, until: now() + PLACES_TTL_MS })
    return list
  }

  /**
   * DHL's codes for the receiver's il and ilçe; refused here, before DHL
   * is asked anything, when DHL lists no such place.
   */
  async function placeCodes(testMode: boolean, city: string, town: string) {
    const il = findPlace(await placeList(testMode, `${API}/cbsinfoapi/getcities`), city)
    if (!il) {
      throw new ValidationError("dhlecommerce.place_unknown", {
        field: "shipping_address.province",
      })
    }
    const path = `${API}/cbsinfoapi/getdistricts/${cityPathCode(il.code)}`
    const ilce = findPlace(await placeList(testMode, path), town)
    if (!ilce) {
      throw new ValidationError("dhlecommerce.place_unknown", { field: "shipping_address.city" })
    }
    return { cityCode: il.code, districtCode: ilce.code }
  }

  /** Registers the receiver ahead of the order, so DHL finds its branch; safe to repeat. */
  async function createRecipient(credentials: DhlEcomCredentials, input: DhlEcomShipmentInput) {
    const path = `${API}/pluscmdapi/createRecipient`
    await authed(credentials, {
      method: "POST",
      path,
      json: { recipient: dhlEcomRecipient(input) },
      idempotent: true,
      logPath: path,
    })
  }

  /** Opens the order under our reference; an order DHL already has under it counts as opened. */
  async function createOrder(credentials: DhlEcomCredentials, input: DhlEcomShipmentInput) {
    const path = `${API}/standardcmdapi/createOrder`
    try {
      await authed(credentials, {
        method: "POST",
        path,
        json: dhlEcomOrderBody(input),
        idempotent: false,
        logPath: path,
      })
    } catch (error) {
      if (!(isProviderError(error) && error.providerCode === DHL_CODES.orderExists)) {
        throw error
      }
    }
  }

  /** Bills the order and gets its barcode once; not repeated on a failure whose outcome is unknown. */
  async function barcodeOnce(
    credentials: DhlEcomCredentials,
    input: DhlEcomShipmentInput
  ): Promise<DhlEcomBarcode> {
    const path = `${API}/barcodecmdapi/createbarcode`
    const row = oneOf(
      await authed(credentials, {
        method: "POST",
        path,
        json: dhlEcomBarcodeBody(input),
        idempotent: false,
        logPath: path,
      })
    )
    const shipmentId = textOf(field(row, "shipmentId"))
    const listed = field(row, "barcodes")
    const pieces = (Array.isArray(listed) ? listed : []).flatMap((each) => {
      const piece = oneOf(each)
      const barcode = textOf(field(piece, "barcode")) ?? ""
      const zpl = field(piece, "value")
      return BARCODE.test(barcode)
        ? [{ barcode, zpl: typeof zpl === "string" && zpl.length <= 200_000 ? zpl : null }]
        : []
    })
    if (!shipmentId || !SHIPMENT_ID.test(shipmentId) || pieces.length === 0) {
      throw invalid()
    }
    return { shipmentId, invoiceId: textOf(field(row, "invoiceId")), pieces }
  }

  /**
   * The barcode, waiting while DHL still looks for the receiver's branch
   * (20001, "VARIŞ ŞUBESİ BULUNAMADI"): a few seconds, then twice as long,
   * then the error goes back to the caller.
   */
  async function createBarcode(credentials: DhlEcomCredentials, input: DhlEcomShipmentInput) {
    for (const wait of [...branchWaitsMs, null]) {
      try {
        return await barcodeOnce(credentials, input)
      } catch (error) {
        const pending = isProviderError(error) && error.providerCode === DHL_CODES.branchNotFound
        if (!pending || wait === null) {
          throw error
        }
        await sleep(wait)
      }
    }
    throw invalid()
  }

  /** Withdraws the barcode: before the branch takes the parcel, on the day it was made. */
  async function cancelShipment(
    credentials: DhlEcomCredentials,
    referenceId: string,
    shipmentId: string
  ) {
    const path = `${API}/barcodecmdapi/cancelshipment`
    await authed(credentials, {
      method: "PUT",
      path,
      json: { referenceId, shipmentId },
      idempotent: true,
      logPath: path,
    })
  }

  /** Withdraws the order (after its barcode, when it has one). */
  async function cancelOrder(credentials: DhlEcomCredentials, referenceId: string) {
    await authed(credentials, {
      method: "PUT",
      path: [...`${API}/standardcmdapi/cancelorder`.split("/").slice(1), referenceId],
      idempotent: true,
      logPath: `${API}/standardcmdapi/cancelorder/:referenceId`,
    })
  }

  /** Where the parcel stands, by our reference; `found` false when DHL lists nothing for it. */
  async function status(
    credentials: DhlEcomCredentials,
    referenceId: string,
    signal?: AbortSignal
  ): Promise<DhlEcomDelivery> {
    const row = oneOf(
      await authed(credentials, {
        method: "GET",
        path: [...`${API}/standardqueryapi/getshipmentstatus`.split("/").slice(1), referenceId],
        idempotent: true,
        logPath: `${API}/standardqueryapi/getshipmentstatus/:referenceId`,
        signal,
      })
    )
    const code = Number(field(row, "shipmentStatusCode"))
    return {
      found: row !== null,
      code: Number.isSafeInteger(code) ? code : null,
      status: statusWords(textOf(field(row, "shipmentStatus"))),
      shipmentId: textOf(field(row, "shipmentId")),
      trackingUrl: textOf(field(row, "trackingUrl")),
    }
  }

  /**
   * Whether DHL takes the shop's customer number and password: a token
   * asked, nothing else. A refusal of the account is `secret_invalid`; the
   * platform's app without a subscription, or keys of the other
   * environment (20013), is no verdict on the shop's details and is thrown.
   */
  async function checkLogin(
    credentials: DhlEcomCredentials,
    options: { signal?: AbortSignal } = {}
  ): Promise<"valid" | "secret_invalid"> {
    try {
      await token(credentials, options.signal, true)
      return "valid"
    } catch (error) {
      if (
        isProviderError(error) &&
        !error.retryable &&
        // The gateway's 4xx, or DHL's own 401/403 code: a refusal of the account. Another
        // code (DHL answers its internal errors as HTTP 500 too) is no verdict on it
        /^(?:http|error)_4(?:01|03|00)$/.test(error.providerCode)
      ) {
        return "secret_invalid"
      }
      throw error
    }
  }

  return {
    placeCodes,
    createRecipient,
    createOrder,
    createBarcode,
    cancelShipment,
    cancelOrder,
    status,
    checkLogin,
  }
}

export type DhlEcomApi = ReturnType<typeof createDhlEcomApi>

let shared: DhlEcomApi | undefined
// A new client (circuit breaker, tokens, place lists) per spec file of a bundled test run
registerProcessCache(() => {
  shared = undefined
})

/**
 * One client set per process; a local fake's address in development and
 * tests (`DHL_ECOMMERCE_BASE_URL`), which answers at once: short waits for
 * the branch there.
 */
export function dhlEcomApi(): DhlEcomApi {
  const fake = parseEnv().DHL_ECOMMERCE_BASE_URL
  shared ??= createDhlEcomApi(fake ? { baseUrl: fake, branchWaitsMs: [50, 100] } : {})
  return shared
}
