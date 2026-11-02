import { z } from "@medusajs/framework/zod"
import { createHttpClient, safeTransport } from "../../clients"
import type { HttpClient, HttpClientOptions } from "../../clients"
import { findAll, findFirst, parseXml, soapEnvelope, textOf } from "../../clients/xml"
import type { XmlFields, XmlNode } from "../../clients/xml"
import { parseEnv } from "../../env"
import { ProviderError, isProviderError } from "../../errors"
import type { ArasCredentials } from "./credentials"
import { arasOrderFields } from "./mappers"
import type { ArasOrderInput } from "./mappers"

/**
 * Aras Kargo's customer service (adr/0035): a .NET SOAP service whose
 * operations answer `ResultCode` 0 for success. Its documentation comes
 * with a contract; the shapes here follow the test service's own
 * description (WSDL). The shop's user name and password go in every call
 * and never into a log (the HTTP client logs fixed fields only).
 */

export const ARAS_PROVIDER = "aras"
export const ARAS_TEST_URL = "https://customerservicestest.araskargo.com.tr"
/** Not confirmed by Aras yet: the panel takes the address Aras gives with the contract. */
export const ARAS_LIVE_URL = "https://customerws.araskargo.com.tr"
const PATH = "/arascargoservice/arascargoservice.asmx"
const NAMESPACE = "http://tempuri.org/"

/** An address Aras gives: its own hosts only, on https's own port (the panel stores it; adr/0035). */
export const isArasServiceUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.port === "" &&
      /(^|\.)araskargo\.com\.tr$/.test(url.hostname)
    )
  } catch {
    return false
  }
}

const refused = (code: string | null) =>
  new ProviderError({
    provider: ARAS_PROVIDER,
    providerCode: code && /^-?\d{1,6}$/.test(code) ? `error_${code}` : "rejected",
    retryable: false,
  })

const invalid = () =>
  new ProviderError({ provider: ARAS_PROVIDER, providerCode: "invalid_response", retryable: false })

/** One row of a .NET DataSet answer: its columns by name. */
export type ArasRow = Record<string, string>

export function createArasApi(options: Partial<Omit<HttpClientOptions, "provider">> = {}) {
  const clients = new Map<string, HttpClient>()
  const fake = options.baseUrl
  const clientFor = (credentials: ArasCredentials): HttpClient => {
    const base =
      fake ?? credentials.serviceUrl ?? (credentials.testMode ? ARAS_TEST_URL : ARAS_LIVE_URL)
    let client = clients.get(base)
    if (!client) {
      // An address the shop entered goes through the guarded transport (no private address)
      const entered = fake === undefined && credentials.serviceUrl !== null
      client = createHttpClient({
        ...options,
        baseUrl: base,
        provider: ARAS_PROVIDER,
        ...(entered ? { transport: safeTransport } : {}),
      })
      clients.set(base, client)
    }
    return client
  }

  async function call(
    credentials: ArasCredentials,
    operation: string,
    params: XmlFields,
    idempotent: boolean
  ): Promise<XmlNode> {
    const text = await clientFor(credentials).request({
      method: "POST",
      path: PATH,
      headers: { soapaction: `"${NAMESPACE}${operation}"` },
      xml: soapEnvelope({ namespace: NAMESPACE, operation, params }),
      idempotent,
      logPath: `${PATH}#${operation}`,
      schema: z.string(),
    })
    let tree: XmlNode
    try {
      tree = parseXml(text)
    } catch {
      throw invalid()
    }
    if (findFirst(tree, "Fault")) {
      throw refused(null)
    }
    return tree
  }

  /** Hands the parcel's order to Aras; not repeated on a failure whose outcome is unknown. */
  async function setOrder(credentials: ArasCredentials, input: ArasOrderInput): Promise<void> {
    const tree = await call(
      credentials,
      "SetOrder",
      {
        orderInfo: { Order: [arasOrderFields(credentials, input)] },
        userName: credentials.username,
        password: credentials.password,
      },
      false
    )
    const result = findFirst(tree, "OrderResultInfo")
    if (!result) {
      throw invalid()
    }
    const code = textOf(result, "ResultCode")
    if (code !== "0") {
      throw refused(code)
    }
  }

  /** The parcel's label as a PDF (base64), or null when Aras gives none. */
  async function label(credentials: ArasCredentials, integrationCode: string) {
    const tree = await call(
      credentials,
      "GetArasBarcode",
      { Username: credentials.username, Password: credentials.password, integrationCode },
      true
    )
    const code = textOf(tree, "ResultCode")
    if (code !== "0") {
      throw refused(code)
    }
    const pdf = findAll(findFirst(tree, "ZebraPdf") ?? tree, "string")
      .map((node) => node.text.trim())
      .find((text) => text !== "")
    return pdf ?? null
  }

  /** Withdraws the order before Aras picks the parcel up; safe to repeat. */
  async function cancel(credentials: ArasCredentials, integrationCode: string): Promise<void> {
    const tree = await call(
      credentials,
      "CancelDispatch",
      { userName: credentials.username, password: credentials.password, integrationCode },
      true
    )
    const code = textOf(tree, "ResultCode")
    if (code !== "0") {
      throw refused(code)
    }
  }

  /** Where the parcel stands, as rows of Aras's DataSet (its columns verified with a real account). */
  async function cargoInfo(
    credentials: ArasCredentials,
    integrationCode: string
  ): Promise<ArasRow[]> {
    const tree = await call(
      credentials,
      "GetCargoInfo",
      {
        username: credentials.username,
        password: credentials.password,
        customerCode: credentials.customerCode ?? "",
        integrationCode,
      },
      true
    )
    const data = findFirst(tree, "diffgram")?.children[0]
    return (data?.children ?? []).map((row) =>
      Object.fromEntries(row.children.map((column) => [column.name, column.text.trim()]))
    )
  }

  /** Whether Aras takes the user name and password: a read any account may make. */
  async function checkCredentials(
    credentials: ArasCredentials,
    options: { signal?: AbortSignal } = {}
  ): Promise<"valid" | "secret_invalid"> {
    try {
      const tree = await clientFor(credentials).request({
        method: "POST",
        path: PATH,
        headers: { soapaction: `"${NAMESPACE}GetOrderWithIntegrationCode"` },
        xml: soapEnvelope({
          namespace: NAMESPACE,
          operation: "GetOrderWithIntegrationCode",
          params: {
            userName: credentials.username,
            password: credentials.password,
            integrationCode: "QTCHECK",
          },
        }),
        logPath: `${PATH}#GetOrderWithIntegrationCode`,
        // A read: a refused login answers at once, nothing is done twice
        idempotent: true,
        ...(options.signal ? { signal: options.signal } : {}),
        schema: z.string(),
      })
      let answer: XmlNode
      try {
        answer = parseXml(tree)
      } catch {
        throw invalid()
      }
      return findFirst(answer, "Fault") ? "secret_invalid" : "valid"
    } catch (error) {
      // A .NET service answers a refused login with a fault (HTTP 500), which
      // the HTTP client reads as `error_<fault code>`
      if (
        isProviderError(error) &&
        (error.providerCode === "http_500" || error.providerCode.startsWith("error_"))
      ) {
        return "secret_invalid"
      }
      throw error
    }
  }

  return { setOrder, label, cancel, cargoInfo, checkCredentials }
}

export type ArasApi = ReturnType<typeof createArasApi>

let shared: ArasApi | undefined

/** One client set per process; a local fake server's address in development (`ARAS_BASE_URL`). */
export function arasApi(): ArasApi {
  const fake = parseEnv().ARAS_BASE_URL
  shared ??= createArasApi(fake ? { baseUrl: fake } : {})
  return shared
}
