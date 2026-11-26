import { randomBytes } from "node:crypto"
import { z } from "@medusajs/framework/zod"
import { registerProcessCache } from "../../cache/process-caches"
import { createHttpClient } from "../../clients"
import type { HttpClient, HttpClientOptions } from "../../clients"
import { readSoapFault } from "../../clients/soap-fault"
import { findFirst, parseXml, soapEnvelope, textOf } from "../../clients/xml"
import type { XmlFields, XmlNode } from "../../clients/xml"
import { parseEnv } from "../../env"
import { isProviderError } from "../../errors"
import {
  CREATED_PHRASES,
  DELETED_PHRASES,
  SURAT_PROVIDER,
  WITHDRAWN_PHRASES,
  invalid,
  refused,
  saysDone,
} from "./answers"
import { suratSecrets } from "./credentials"
import type { SuratCredentials } from "./credentials"
import { suratShipmentFields } from "./mappers"
import type { SuratShipmentInput } from "./mappers"
import { suratTrackingOf } from "./tracking"
import type { SuratTracking } from "./tracking"

/**
 * Sürat Kargo's web service (docs/entegrasyonlar/surat.md): a .NET ASMX
 * SOAP service at one address, with no test service. Operations and
 * parameters from its public service description (WSDL). Free-text
 * answers are judged in `./answers`; tracking strings are read in
 * `./tracking`. The account's values go in every call and never into a
 * log (the HTTP client logs fixed fields only) nor into a sentence staff
 * read (masked).
 */

export { SURAT_PROVIDER }
export const SURAT_LIVE_URL = "https://webservices.suratkargo.com.tr"
const PATH = "/services.asmx"
const NAMESPACE = "http://tempuri.org/"

/** Why the cancel route stopped: Sürat brings the parcel back instead of deleting it. */
export const SURAT_WITHDRAW_REQUESTED = "withdraw_requested"

// A label PDF of Sürat's: a few pages at most (base64 is 4/3 of the bytes)
const MAX_LABEL_BASE64 = 2 * 1024 * 1024

export function createSuratApi(options: Partial<Omit<HttpClientOptions, "provider">> = {}) {
  const client: HttpClient = createHttpClient({
    ...options,
    baseUrl: options.baseUrl ?? SURAT_LIVE_URL,
    provider: SURAT_PROVIDER,
  })

  /** The operation's result element (`<op>Result`); a SOAP fault is Sürat's refusal. */
  async function call(
    operation: string,
    params: XmlFields,
    extra: { idempotent: boolean; secrets: readonly string[]; signal?: AbortSignal | undefined }
  ): Promise<XmlNode | null> {
    const text = await client.request({
      method: "POST",
      path: PATH,
      headers: { soapaction: `"${NAMESPACE}${operation}"` },
      xml: soapEnvelope({ namespace: NAMESPACE, operation, params }),
      idempotent: extra.idempotent,
      logPath: `${PATH}#${operation}`,
      ...(extra.signal ? { signal: extra.signal } : {}),
      secrets: extra.secrets,
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
      throw refused(readSoapFault(fault).text ?? null, extra.secrets, "error_fault")
    }
    if (!findFirst(tree, `${operation}Response`)) {
      throw invalid()
    }
    return findFirst(tree, `${operation}Result`)
  }

  const resultText = (result: XmlNode | null): string | null => {
    const text = result?.text.trim() ?? ""
    return text === "" ? null : text
  }

  /**
   * Registers the parcel under our code; not repeated on a failure whose
   * outcome is unknown. Done only on a known success sentence.
   */
  async function createShipment(
    credentials: SuratCredentials,
    input: SuratShipmentInput
  ): Promise<void> {
    const secrets = suratSecrets(credentials)
    const said = resultText(
      await call(
        "GonderiyiKargoyaGonderYeni",
        {
          KullaniciAdi: credentials.shipping.username,
          Sifre: credentials.shipping.password,
          Gonderi: suratShipmentFields(input),
        },
        { idempotent: false, secrets }
      )
    )
    if (!saysDone(said, CREATED_PHRASES)) {
      throw refused(said, secrets)
    }
  }

  /**
   * Sürat's own label as a PDF (base64), when the account may make one
   * (`KargoBarkodu`; Sürat rarely grants it); null otherwise, whatever the
   * reason: our own label stands in.
   */
  async function label(credentials: SuratCredentials, code: string): Promise<string | null> {
    try {
      const result = await call(
        "KargoBarkodu",
        {
          cariKodu: credentials.tracking.username,
          WebPassword: credentials.tracking.password,
          ozelKargoTakipNo: code,
        },
        { idempotent: true, secrets: suratSecrets(credentials) }
      )
      const pdf = (result ? textOf(result, "PdfBarkod") : null)?.replace(/\s+/g, "") ?? ""
      // A PDF only ("%PDF" is "JVBER"), of a label's size
      return pdf.startsWith("JVBER") &&
        pdf.length <= MAX_LABEL_BASE64 &&
        /^[A-Za-z0-9+/]+=*$/.test(pdf)
        ? pdf
        : null
    } catch {
      return null
    }
  }

  /** Deletes the parcel before the branch has it; refused once it is on its way. */
  async function remove(credentials: SuratCredentials, code: string): Promise<void> {
    const secrets = suratSecrets(credentials)
    const said = resultText(
      await call(
        "GonderiSil",
        {
          cariKodu: credentials.tracking.username,
          WebPassword: credentials.tracking.password,
          ozelKargoTakipNo: code,
        },
        { idempotent: true, secrets }
      )
    )
    if (!saysDone(said, DELETED_PHRASES)) {
      throw refused(said, secrets)
    }
  }

  /** Asks Sürat to bring a parcel back that it can no longer delete (`GonderiGeriCek`). */
  async function withdraw(credentials: SuratCredentials, code: string): Promise<void> {
    const secrets = suratSecrets(credentials)
    const said = resultText(
      await call(
        "GonderiGeriCek",
        {
          KullaniciAdi: credentials.shipping.username,
          Sifre: credentials.shipping.password,
          OzelKargoTakipNo: code,
          IptalNeden: "Sipariş iptal edildi",
        },
        { idempotent: true, secrets }
      )
    )
    if (!saysDone(said, WITHDRAWN_PHRASES)) {
      throw refused(said, secrets)
    }
  }

  /** The parcel's movements by our code; `found` false while Sürat does not know it. */
  async function track(
    credentials: SuratCredentials,
    code: string,
    signal?: AbortSignal
  ): Promise<SuratTracking> {
    const secrets = suratSecrets(credentials)
    const result = await call(
      "KargoTakipHareketDetayi",
      {
        CariKodu: credentials.tracking.username,
        Sifre: credentials.tracking.password,
        WebSiparisKodu: code,
      },
      { idempotent: true, secrets, signal }
    )
    return suratTrackingOf(resultText(result), secrets)
  }

  /**
   * Whether Sürat takes the tracking login: a query for a code nobody has.
   * A refusal naming the login (or a fault) is `secret_invalid`; "not
   * found" is a login that works. Sürat has no read that checks the
   * shipping login alone: it is checked here only when it is the one pair.
   */
  async function checkLogin(
    credentials: SuratCredentials,
    options: { signal?: AbortSignal } = {}
  ): Promise<"valid" | "secret_invalid"> {
    const code = `QTCHECK${randomBytes(4).toString("hex").toUpperCase()}`
    try {
      await track(credentials, code, options.signal)
      return "valid"
    } catch (error) {
      if (
        isProviderError(error) &&
        (error.providerCode === "login_refused" || error.providerCode.startsWith("error_"))
      ) {
        return "secret_invalid"
      }
      throw error
    }
  }

  return { createShipment, label, remove, withdraw, track, checkLogin }
}

export type SuratApi = ReturnType<typeof createSuratApi>

let shared: SuratApi | undefined
// A new client (and circuit breaker) per spec file of a bundled test run
registerProcessCache(() => {
  shared = undefined
})

/** One client per process; a local fake server's address in development (`SURAT_BASE_URL`). */
export function suratApi(): SuratApi {
  const fake = parseEnv().SURAT_BASE_URL
  shared ??= createSuratApi(fake ? { baseUrl: fake } : {})
  return shared
}
