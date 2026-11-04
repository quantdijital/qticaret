import { randomBytes } from "node:crypto"
import { z } from "@medusajs/framework/zod"
import { createHttpClient } from "../../clients"
import type { HttpClient, HttpClientOptions } from "../../clients"
import { readSoapFault } from "../../clients/soap-fault"
import { findFirst, parseXml, soapEnvelope, textOf } from "../../clients/xml"
import type { XmlFields, XmlNode } from "../../clients/xml"
import { parseEnv } from "../../env"
import { isProviderError } from "../../errors"
import {
  KEY_NOT_FOUND,
  LOGIN_REFUSED_CODES,
  YURTICI_PROVIDER,
  deliveryOf,
  invalid,
  lineOf,
  own,
  refused,
  succeeded,
  withdrawalRefusal,
} from "./answers"
import type { YurticiLogin } from "./credentials"
import { yurticiShipmentFields } from "./mappers"
import type { YurticiShipmentInput } from "./mappers"
import type { YurticiDelivery } from "./status"

/**
 * Yurtiçi Kargo's shipping order service (adr/0035): a JAX-WS SOAP
 * service, its answers read in `./answers`. Shapes from the service's own
 * description (WSDL) and Yurtiçi's "Web Servis Giden Kargo Teknik Döküman
 * V3" (docs/entegrasyonlar/yurtici.md). Which login a call uses is the
 * caller's: the shop's account, or its separate account for parcels paid
 * at the door. Logins never reach a log (the HTTP client logs fixed fields
 * only).
 */

export { YURTICI_PROVIDER }
export const YURTICI_TEST_URL = "https://testws.yurticikargo.com"
export const YURTICI_LIVE_URL = "https://ws.yurticikargo.com"
const PATH = "/KOPSWebServices/ShippingOrderDispatcherServices"
const NAMESPACE = "http://yurticikargo.com.tr/ShippingOrderDispatcherServices"

// The login a call carries: masked in the sentence a refusal keeps for staff
const loginOf = (params: XmlFields): string[] =>
  [params["wsUserName"], params["wsPassword"]].filter(
    (value): value is string => typeof value === "string"
  )

export function createYurticiApi(options: Partial<Omit<HttpClientOptions, "provider">> = {}) {
  const clients = new Map<string, HttpClient>()
  const clientFor = (testMode: boolean): HttpClient => {
    const base = options.baseUrl ?? (testMode ? YURTICI_TEST_URL : YURTICI_LIVE_URL)
    let client = clients.get(base)
    if (!client) {
      client = createHttpClient({ ...options, baseUrl: base, provider: YURTICI_PROVIDER })
      clients.set(base, client)
    }
    return client
  }

  async function call(
    testMode: boolean,
    operation: string,
    params: XmlFields,
    extra: { idempotent: boolean; signal?: AbortSignal | undefined }
  ): Promise<XmlNode> {
    const secrets = loginOf(params)
    const text = await clientFor(testMode).request({
      method: "POST",
      path: PATH,
      // JAX-WS dispatches on the body; the description gives an empty action
      headers: { soapaction: '""' },
      xml: soapEnvelope({ namespace: NAMESPACE, operation, params, prefixed: true }),
      idempotent: extra.idempotent,
      logPath: `${PATH}#${operation}`,
      ...(extra.signal ? { signal: extra.signal } : {}),
      secrets,
      schema: z.string(),
    })
    let tree: XmlNode
    try {
      tree = parseXml(text)
    } catch {
      throw invalid()
    }
    const fault = findFirst(tree, "Fault")
    if (fault) {
      const { text: said } = readSoapFault(fault)
      throw refused(textOf(fault, "errorCode"), said ?? null, secrets)
    }
    return tree
  }

  /** Opens the parcel under our cargo key; not repeated on a failure whose outcome is unknown. */
  async function createShipment(
    login: YurticiLogin,
    testMode: boolean,
    input: YurticiShipmentInput
  ): Promise<void> {
    const tree = await call(
      testMode,
      "createShipment",
      {
        wsUserName: login.username,
        wsPassword: login.password,
        userLanguage: "TR",
        ShippingOrderVO: [yurticiShipmentFields(input)],
      },
      { idempotent: false }
    )
    const result = findFirst(tree, "ShippingOrderResultVO")
    if (!result) {
      throw invalid()
    }
    const line = lineOf(result, "shippingOrderDetailVO", input.cargoKey)
    const code = line ? own(line, "errCode") : own(result, "errCode")
    if (own(result, "outFlag") !== "0" || !succeeded(code)) {
      const said = (line ? own(line, "errMessage") : null) ?? own(result, "outResult")
      throw refused(code, said, [login.username, login.password])
    }
  }

  /** Where the parcel stands; `found` false when this login does not know the key. */
  async function query(
    login: YurticiLogin,
    testMode: boolean,
    cargoKey: string,
    signal?: AbortSignal
  ): Promise<YurticiDelivery> {
    const tree = await call(
      testMode,
      "queryShipment",
      {
        wsUserName: login.username,
        wsPassword: login.password,
        wsLanguage: "TR",
        keys: [cargoKey],
        // 0: the keys are cargo keys
        keyType: 0,
        addHistoricalData: false,
        onlyTracking: false,
      },
      { idempotent: true, signal }
    )
    const result = findFirst(tree, "ShippingDeliveryVO")
    if (!result) {
      throw invalid()
    }
    return deliveryOf(result, cargoKey)
  }

  /**
   * Withdraws the parcel before its document is issued; already withdrawn
   * counts as done. Only CNL and ISC are a withdrawal: once the document is
   * issued Yurtiçi takes the call as a return request (IND) and the parcel
   * comes back, and a delivered one (DLV) stays delivered.
   */
  async function cancel(login: YurticiLogin, testMode: boolean, cargoKey: string): Promise<void> {
    const tree = await call(
      testMode,
      "cancelShipment",
      {
        wsUserName: login.username,
        wsPassword: login.password,
        userLanguage: "TR",
        cargoKeys: [cargoKey],
      },
      { idempotent: true }
    )
    const result = findFirst(tree, "ShippingOrderResultVO")
    if (!result) {
      throw invalid()
    }
    const refusal = withdrawalRefusal(result, cargoKey)
    if (refusal) {
      throw refusal
    }
  }

  /**
   * Whether Yurtiçi takes the login: a query for a key nobody has, which
   * any account may make. A refused login is a login fault
   * (`LOGIN_REFUSED_CODES`) or an answer with no line for the key; an
   * unknown key gets a line of its own code (82519, "this user has no
   * such key"), which names the user it found.
   */
  async function checkLogin(
    login: YurticiLogin,
    testMode: boolean,
    options: { signal?: AbortSignal } = {}
  ): Promise<"valid" | "secret_invalid"> {
    // A new key each time: Yurtiçi refuses the same query twice in a minute
    const key = `QTCHECK${randomBytes(4).toString("hex").toUpperCase()}`
    try {
      const tree = await call(
        testMode,
        "queryShipment",
        {
          wsUserName: login.username,
          wsPassword: login.password,
          wsLanguage: "TR",
          keys: [key],
          keyType: 0,
          addHistoricalData: false,
          onlyTracking: true,
        },
        { idempotent: true, signal: options.signal }
      )
      const result = findFirst(tree, "ShippingDeliveryVO")
      const line = result ? lineOf(result, "shippingDeliveryDetailVO", key) : null
      return line && (own(line, "cargoKey") === key || own(line, "errCode") === KEY_NOT_FOUND)
        ? "valid"
        : "secret_invalid"
    } catch (error) {
      // A JAX-WS service answers a refused login with a fault (HTTP 500); a
      // 500 without one, or another fault, is no verdict on the login
      if (isProviderError(error) && LOGIN_REFUSED_CODES.has(error.providerCode)) {
        return "secret_invalid"
      }
      throw error
    }
  }

  return { createShipment, query, cancel, checkLogin }
}

export type YurticiApi = ReturnType<typeof createYurticiApi>

let shared: YurticiApi | undefined

/** One client set per process; a local fake server's address in development (`YURTICI_BASE_URL`). */
export function yurticiApi(): YurticiApi {
  const fake = parseEnv().YURTICI_BASE_URL
  shared ??= createYurticiApi(fake ? { baseUrl: fake } : {})
  return shared
}
