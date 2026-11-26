import { randomInt } from "node:crypto"
import { z } from "@medusajs/framework/zod"
import { registerProcessCache } from "../../cache/process-caches"
import { createHttpClient } from "../../clients"
import type { HttpClient, HttpClientOptions } from "../../clients"
import { readSoapFault } from "../../clients/soap-fault"
import { findFirst, parseXml, soapEnvelope } from "../../clients/xml"
import type { XmlFields, XmlNode, XmlValue } from "../../clients/xml"
import { parseEnv } from "../../env"
import { PTT_OK, PTT_PROVIDER, invalid, refusalOf, refused } from "./answers"
import { pttBarcodeOf, serialOf } from "./barcode"
import { pttSecrets } from "./credentials"
import type { PttCredentials } from "./credentials"
import { pttShipmentFields } from "./mappers"
import type { PttShipmentInput } from "./mappers"

/**
 * PTT Kargo's web services (docs/entegrasyonlar/ptt.md): two Java/Axis2
 * SOAP services, the upload (`PttVeriYukleme`: `kabulEkle2`,
 * `barkodVeriSil`) and tracking (`GonderiTakipV2`: `gonderiSorgu2`, whose
 * only port is SOAP 1.2). Shapes from their public service descriptions
 * (WSDL): the operation and its wrapper in the service's namespace, the
 * fields qualified by the types' namespace (`xsd`). The addresses are
 * fixed here on https (the descriptions list http: the password would
 * travel in the clear). Each has a test service, used in test mode. The
 * account's values go in every call and never into a log (the HTTP client
 * logs fixed fields only) nor into a sentence staff read (masked).
 */

export { PTT_PROVIDER }
export const PTT_LIVE_URL = "https://pttws.ptt.gov.tr"

const UPLOAD = {
  live: "/PttVeriYukleme/services/Sorgu",
  test: "/PttVeriYuklemeTest/services/Sorgu",
}
const TRACK = { live: "/GonderiTakipV2/services/Sorgu", test: "/GonderiTakipV2Test/services/Sorgu" }
const UPLOAD_NS = "http://kabul.ptt.gov.tr"
const TRACK_NS = "http://takip.ptt.gov.tr"
// The web service user PTT's document fixes for every customer
const WS_USER = "PttWs"
// `gonderiTip` / `gonderiTur` as PTT's sample request sends them (its tables disagree)
const SHIPMENT_TYPE = "NORMAL"
const SHIPMENT_KIND = "KARGO"

/** One tracking event: PTT's status id (`gonderiDurumId`), its words, its time. */
export interface PttEvent {
  statusId: string | null
  said: string | null
  at: string | null
}

export interface PttTracking {
  /** PTT knows the barcode (it has events). */
  found: boolean
  events: PttEvent[]
}

/** Each field under the types' prefix, nested objects and lists alike. */
function qualified(fields: XmlFields): XmlFields {
  const each = (value: XmlValue): XmlValue => {
    if (Array.isArray(value)) {
      return (value as readonly XmlValue[]).map(each)
    }
    if (value !== null && typeof value === "object") {
      return qualified(value as XmlFields)
    }
    return value
  }
  return Object.fromEntries(
    Object.entries(fields).map(([name, value]) => [`ax:${name}`, each(value)])
  )
}

/** A child's trimmed text, directly under the node; null when absent or empty. */
const own = (node: XmlNode, name: string): string | null => {
  const text = node.children.find((child) => child.name === name)?.text.trim() ?? ""
  return text === "" ? null : text
}

const codeOf = (node: XmlNode, name: string): number | null => {
  const text = own(node, name)
  return text !== null && /^-?\d{1,9}$/.test(text) ? Number(text) : null
}

/** The upload's file name: unique per call and customer (`dosyaAdi`, at most 50). */
export const pttFileName = (reference: string, now = new Date()): string =>
  `${reference}-${now.toISOString().replace(/\D/g, "").slice(0, 14)}`

export function createPttApi(options: Partial<Omit<HttpClientOptions, "provider">> = {}) {
  const client: HttpClient = createHttpClient({
    ...options,
    baseUrl: options.baseUrl ?? PTT_LIVE_URL,
    provider: PTT_PROVIDER,
  })

  /** The operation's `return` element; a SOAP fault is PTT's refusal. */
  async function call(
    credentials: PttCredentials,
    service: "upload" | "track",
    operation: string,
    wrapper: string,
    fields: XmlFields,
    extra: { idempotent: boolean; signal?: AbortSignal | undefined }
  ): Promise<XmlNode> {
    const secrets = pttSecrets(credentials)
    const upload = service === "upload"
    const paths = upload ? UPLOAD : TRACK
    const path = credentials.testMode ? paths.test : paths.live
    const namespace = upload ? UPLOAD_NS : TRACK_NS
    const text = await client.request({
      method: "POST",
      path,
      // The upload on its SOAP 1.1 port; tracking has only the 1.2 one
      ...(upload
        ? { headers: { soapaction: `"urn:${operation}"` } }
        : { xmlType: `application/soap+xml; charset=utf-8; action="urn:${operation}"` }),
      xml: soapEnvelope({
        namespace,
        operation,
        params: { [`op:${wrapper}`]: qualified(fields) },
        prefixed: true,
        namespaces: { ax: `${namespace}/xsd` },
        version: upload ? "1.1" : "1.2",
      }),
      idempotent: extra.idempotent,
      logPath: `${path}#${operation}`,
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
      // Under HTTP 200: the HTTP client reads one under a 5xx as `error_<code>` itself
      throw refused(null, readSoapFault(fault).text ?? null, secrets, "error_fault")
    }
    const answer = findFirst(tree, `${operation}Response`)
    const result = answer?.children.find((child) => child.name === "return")
    if (!result) {
      throw invalid()
    }
    return result
  }

  /**
   * Loads the parcel under its barcode (`kabulEkle2`), one per file; not
   * repeated on a failure whose outcome is unknown. Done only when PTT
   * says 1 for the file and for the parcel's line.
   */
  async function upload(
    credentials: PttCredentials,
    input: PttShipmentInput,
    fileName: string
  ): Promise<void> {
    // The receiver too: PTT may quote a field it refuses (KVKK, security review 2026-11-26)
    const secrets = [
      ...pttSecrets(credentials),
      input.receiver.name,
      input.receiver.address,
      input.receiver.phone,
      input.receiver.phone.replace(/^0/, ""),
    ]
    const result = await call(
      credentials,
      "upload",
      "kabulEkle2",
      "input",
      {
        dongu: pttShipmentFields(input),
        dosyaAdi: fileName,
        gonderiTip: SHIPMENT_TYPE,
        gonderiTur: SHIPMENT_KIND,
        kullanici: WS_USER,
        musteriId: credentials.customerId,
        sifre: credentials.password,
      },
      { idempotent: false }
    )
    const lines = result.children.filter((child) => child.name === "dongu")
    const line = lines.find((each) => own(each, "barkod") === input.barcode) ?? lines[0]
    const code = codeOf(result, "hataKodu")
    if (code !== PTT_OK) {
      const said = [own(result, "aciklama"), line ? own(line, "donguAciklama") : null]
        .filter(Boolean)
        .join(" ")
      throw refused(code, said === "" ? null : said, secrets)
    }
    if (line && (codeOf(line, "donguHataKodu") !== PTT_OK || own(line, "donguSonuc") !== "true")) {
      throw refused(codeOf(line, "donguHataKodu"), own(line, "donguAciklama"), secrets)
    }
  }

  /** Deletes a parcel PTT has not accepted at a branch yet (`barkodVeriSil`). */
  async function remove(
    credentials: PttCredentials,
    barcode: string,
    fileName: string
  ): Promise<void> {
    const result = await call(
      credentials,
      "upload",
      "barkodVeriSil",
      "inpDelete",
      {
        barcode,
        dosyaAdi: fileName,
        musteriId: credentials.customerId,
        sifre: credentials.password,
      },
      { idempotent: true }
    )
    const code = codeOf(result, "hataKodu")
    if (code !== PTT_OK) {
      throw refused(code, own(result, "aciklama"), pttSecrets(credentials))
    }
  }

  /**
   * The parcel's events by its barcode (`gonderiSorgu2`); `found` false
   * while PTT has none. A refusal naming the account is thrown
   * (`login_refused`); any other answer without events is a barcode PTT
   * does not know yet. Only PTT's own columns are read: never the
   * receiver, the sender or who signed (`ALICI`, `GONDEREN`, `TESALAN`).
   */
  async function track(
    credentials: PttCredentials,
    barcode: string,
    signal?: AbortSignal
  ): Promise<PttTracking> {
    const result = await call(
      credentials,
      "track",
      "gonderiSorgu2",
      "input",
      { barkod: barcode, kullanici: credentials.customerId, sifre: credentials.password },
      { idempotent: true, signal }
    )
    const events = result.children
      .filter((child) => child.name === "dongu")
      .map((row) => ({
        order: codeOf(row, "siraNo"),
        statusId: own(row, "gonderiDurumId"),
        said: own(row, "ISLEM"),
        at: own(row, "ITARIH"),
      }))
    if (events.length === 0) {
      const said = own(result, "sonucAciklama")
      if (refusalOf(said) === "login") {
        throw refused(codeOf(result, "sonucKodu"), said, pttSecrets(credentials), "login_refused")
      }
      return { found: false, events: [] }
    }
    // By PTT's own sequence when every event has one, else as listed
    const ordered = events.every((event) => event.order !== null)
      ? [...events].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      : events
    return {
      found: true,
      events: ordered.map(({ statusId, said, at }) => ({ statusId, said, at })),
    }
  }

  /**
   * Whether PTT takes the account: a query for a barcode nobody has.
   * Tracking is the one read with the account; a refusal naming it is
   * `secret_invalid`, anything else a working account (PTT's words for a
   * wrong password are to confirm with a real account).
   */
  async function checkLogin(
    credentials: PttCredentials,
    options: { signal?: AbortSignal } = {}
  ): Promise<"valid" | "secret_invalid"> {
    // 00 and ten random digits: outside the ranges PTT gives
    const barcode = pttBarcodeOf(serialOf(randomInt(0, 10_000_000_000)))
    try {
      await track(credentials, barcode, options.signal)
      return "valid"
    } catch (error) {
      if ((error as { providerCode?: string }).providerCode === "login_refused") {
        return "secret_invalid"
      }
      throw error
    }
  }

  return { upload, remove, track, checkLogin }
}

export type PttApi = ReturnType<typeof createPttApi>

let shared: PttApi | undefined
// A new client (and circuit breaker) per spec file of a bundled test run
registerProcessCache(() => {
  shared = undefined
})

/** One client per process; a local fake server's address in development (`PTT_BASE_URL`). */
export function pttApi(): PttApi {
  const fake = parseEnv().PTT_BASE_URL
  shared ??= createPttApi(fake ? { baseUrl: fake } : {})
  return shared
}
