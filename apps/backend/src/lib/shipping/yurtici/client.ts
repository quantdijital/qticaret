import { randomBytes } from "node:crypto"
import { z } from "@medusajs/framework/zod"
import { createHttpClient } from "../../clients"
import type { HttpClient, HttpClientOptions } from "../../clients"
import { findAll, findFirst, parseXml, soapEnvelope } from "../../clients/xml"
import type { XmlFields, XmlNode } from "../../clients/xml"
import { parseEnv } from "../../env"
import { ProviderError, isProviderError } from "../../errors"
import type { YurticiLogin } from "./credentials"
import { yurticiShipmentFields } from "./mappers"
import type { YurticiShipmentInput } from "./mappers"
import type { YurticiDelivery } from "./status"

/**
 * Yurtiçi Kargo's shipping order service (adr/0035): a JAX-WS SOAP
 * service whose answers carry `outFlag` 0 for success and an `errCode` per
 * parcel. Shapes from the service's own description (WSDL). Which login a
 * call uses is the caller's: the shop's account, or its separate account
 * for parcels paid at the door. Logins never reach a log (the HTTP client
 * logs fixed fields only).
 */

export const YURTICI_PROVIDER = "yurtici"
export const YURTICI_TEST_URL = "https://testws.yurticikargo.com"
export const YURTICI_LIVE_URL = "https://ws.yurticikargo.com"
const PATH = "/KOPSWebServices/ShippingOrderDispatcherServices"
const NAMESPACE = "http://yurticikargo.com.tr/ShippingOrderDispatcherServices"

const refused = (code: string | null) =>
  new ProviderError({
    provider: YURTICI_PROVIDER,
    providerCode: code && /^-?\d{1,8}$/.test(code) ? `error_${code}` : "rejected",
    retryable: false,
  })

const invalid = () =>
  new ProviderError({
    provider: YURTICI_PROVIDER,
    providerCode: "invalid_response",
    retryable: false,
  })

/** A child's own text (not a descendant's): the answers repeat names at each level. */
const own = (node: XmlNode, name: string): string | null => {
  const text = node.children.find((child) => child.name === name)?.text.trim() ?? ""
  return text === "" ? null : text
}

const succeeded = (code: string | null): boolean => code === null || code === "0"

/** The parcel's line in an answer, by our cargo key. */
const lineOf = (result: XmlNode, name: string, cargoKey: string): XmlNode | null =>
  findAll(result, name).find((line) => own(line, "cargoKey") === cargoKey) ?? null

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
    const text = await clientFor(testMode).request({
      method: "POST",
      path: PATH,
      // JAX-WS dispatches on the body; the description gives an empty action
      headers: { soapaction: '""' },
      xml: soapEnvelope({ namespace: NAMESPACE, operation, params, prefixed: true }),
      idempotent: extra.idempotent,
      logPath: `${PATH}#${operation}`,
      ...(extra.signal ? { signal: extra.signal } : {}),
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
      throw refused(findFirst(fault, "errorCode")?.text.trim() ?? null)
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
      throw refused(code)
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
    const line = lineOf(result, "shippingDeliveryDetailVO", cargoKey)
    if (!line || !succeeded(own(line, "errCode"))) {
      if (own(result, "outFlag") === "2") {
        throw refused(own(result, "errCode"))
      }
      return {
        found: false,
        operationCode: null,
        operationMessage: null,
        docId: null,
        trackingUrl: null,
        words: [],
      }
    }
    const item = findFirst(line, "shippingDeliveryItemDetailVO")
    const code = Number(own(line, "operationCode"))
    const read = (name: string) => (item ? own(item, name) : null)
    return {
      found: true,
      operationCode: Number.isInteger(code) ? code : null,
      operationMessage: own(line, "operationMessage"),
      docId: read("docId"),
      trackingUrl: read("trackingUrl"),
      words: [
        "cargoEventExplanation",
        "cargoReasonExplanation",
        "returnStatusExplanation",
        "rejectStatusExplanation",
      ].flatMap((name) => read(name) ?? []),
    }
  }

  /** Withdraws the parcel before its document is issued; already withdrawn counts as done. */
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
    const line = lineOf(result, "shippingCancelDetailVO", cargoKey)
    // 4 (ISC): canceled before, as a repeated withdrawal finds it
    if (line && own(line, "operationCode") === "4") {
      return
    }
    const code = line ? own(line, "errCode") : own(result, "errCode")
    if (own(result, "outFlag") !== "0" || !succeeded(code)) {
      throw refused(code)
    }
  }

  /**
   * Whether Yurtiçi takes the login: a query for a key nobody has, which
   * any account may make. A refused login is a fault or an answer with no
   * line for the key; an unknown key still gets its line.
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
      return result && lineOf(result, "shippingDeliveryDetailVO", key) ? "valid" : "secret_invalid"
    } catch (error) {
      // A JAX-WS service answers a refused login with a fault (HTTP 500)
      if (
        isProviderError(error) &&
        (error.providerCode === "http_500" || error.providerCode.startsWith("error_"))
      ) {
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
