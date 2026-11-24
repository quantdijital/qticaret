import { z } from "@medusajs/framework/zod"
import { createHttpClient } from "../../clients"
import type { HttpClient, HttpClientOptions } from "../../clients"
import { escapeXml } from "../../clients/xml"
import { parseEnv } from "../../env"
import { ProviderError } from "../../errors"
import { registerProcessCache } from "../../cache/process-caches"

/**
 * Netgsm's SMS service (adr/0036), as its own SDK calls it: an XML order
 * to `/sms/send/xml` answered `00 <job id>` or an error code, and the
 * sender names (`/sms/header`) for checking an account. The shop's own
 * account: its sender name is registered to its company. Commercial
 * messages go with İYS filter 11, so Netgsm checks İYS as well.
 */

export const NETGSM_PROVIDER = "netgsm"
export const NETGSM_URL = "https://api.netgsm.com.tr"

export interface NetgsmAccount {
  usercode: string
  password: string
  /** The sender name (başlık) registered to the shop. */
  msgheader: string
}

export interface NetgsmCredentialsSource {
  settings: Record<string, unknown>
  secrets: Record<string, string>
}

/** The account as the panel stored it (adr/0027); null when a part is missing. */
export function netgsmAccountOf(account: NetgsmCredentialsSource | null): NetgsmAccount | null {
  const usercode = account?.secrets["usercode"]
  const password = account?.secrets["password"]
  const msgheader = account?.settings["msgheader"]
  return usercode && password && typeof msgheader === "string" && msgheader.trim() !== ""
    ? { usercode, password, msgheader: msgheader.trim() }
    : null
}

// Netgsm's codes: 20 text, 30 login, 40 sender name, 50/51 İYS, 70 parameters, 80/85 limits
const refused = (code: string) =>
  new ProviderError({
    provider: NETGSM_PROVIDER,
    providerCode: /^\d{2}$/.test(code) ? `error_${code}` : "rejected",
    retryable: false,
  })

/** A Turkish mobile number as Netgsm takes it: 90 and ten digits. */
const netgsmNumber = (phone: string): string => phone.replace(/\D/g, "").replace(/^0/, "90")

// Fields of an answer that say how it went, not which names the account has
const STATUS_FIELDS = new Set(["code", "description", "error", "message", "status"])

/**
 * The sender names in a JSON answer, wherever the account's version puts
 * them: the strings in its lists and values, never a key, nor a status field.
 */
function headerNames(value: unknown, depth = 0): string[] {
  if (typeof value === "string") {
    return value.length <= 40 ? [value] : []
  }
  if (depth > 3 || typeof value !== "object" || value === null) {
    return []
  }
  const entries = Array.isArray(value)
    ? value.map((each): [string, unknown] => ["", each])
    : Object.entries(value)
  return entries.flatMap(([key, each]) =>
    STATUS_FIELDS.has(key.toLowerCase()) ? [] : headerNames(each, depth + 1)
  )
}

export function createNetgsmApi(options: Partial<Omit<HttpClientOptions, "provider">> = {}) {
  const client: HttpClient = createHttpClient({
    ...options,
    baseUrl: options.baseUrl ?? NETGSM_URL,
    provider: NETGSM_PROVIDER,
  })

  /** Sends one SMS; not repeated when its outcome is unknown (Netgsm takes no key). */
  async function send(
    account: NetgsmAccount,
    input: { to: string; text: string; commercial: boolean }
  ): Promise<{ jobId: string }> {
    const field = (name: string, value: string) => `<${name}>${escapeXml(value)}</${name}>`
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?><mainbody><header>` +
      `<company dil="TR">Netgsm</company>` +
      field("usercode", account.usercode) +
      field("password", account.password) +
      field("type", "1:n") +
      field("msgheader", account.msgheader) +
      // 0: information; 11: commercial to a person, checked against İYS
      field("filter", input.commercial ? "11" : "0") +
      field("encoding", "TR") +
      `</header><body>` +
      field("msg", input.text) +
      field("no", netgsmNumber(input.to)) +
      `</body></mainbody>`
    const answer = await client.request({
      method: "POST",
      path: "/sms/send/xml",
      xml,
      idempotent: false,
      schema: z.string(),
    })
    const [code = "", jobId = ""] = answer.trim().split(/\s+/)
    if (!["00", "01", "02"].includes(code) || !/^\d{1,20}$/.test(jobId)) {
      throw refused(code)
    }
    return { jobId }
  }

  /**
   * Whether Netgsm takes the login, and knows the sender name on it: its
   * list of sender names, a read any account may make.
   */
  async function checkAccount(
    account: NetgsmAccount,
    options: { signal?: AbortSignal } = {}
  ): Promise<"valid" | "merchant_invalid" | "secret_invalid"> {
    const answer = await client.request({
      method: "POST",
      path: "/sms/header",
      json: { usercode: account.usercode, password: account.password },
      idempotent: true,
      ...(options.signal ? { signal: options.signal } : {}),
      // A JSON list of names, or plain lines and codes on older accounts
      textAnswer: true,
      schema: z.string(),
    })
    const trimmed = answer.trim()
    let names: string[]
    try {
      const parsed: unknown = JSON.parse(trimmed)
      // A bare code ("30") parses as JSON too
      const code =
        typeof parsed === "object" && parsed !== null ? (parsed as { code?: unknown }).code : parsed
      if (String(code) === "30") {
        return "secret_invalid"
      }
      names = headerNames(parsed)
    } catch {
      // An older plain answer: a code, or the names one per line
      if (/^30\b/.test(trimmed)) {
        return "secret_invalid"
      }
      names = trimmed.split(/\r?\n|<br\s*\/?>/i).map((line) => line.trim())
    }
    const wanted = account.msgheader.toLocaleUpperCase("tr")
    return names.some((name) => name.toLocaleUpperCase("tr") === wanted)
      ? "valid"
      : "merchant_invalid"
  }

  return { send, checkAccount }
}

export type NetgsmApi = ReturnType<typeof createNetgsmApi>

let shared: { key: string; api: NetgsmApi } | undefined
// A new client (and circuit breaker) per spec file of a bundled test run
registerProcessCache(() => {
  shared = undefined
})

/** One client per address; a local fake server's in development (`NETGSM_BASE_URL`). */
export function netgsmApi(): NetgsmApi {
  const fake = parseEnv().NETGSM_BASE_URL
  const key = fake ?? NETGSM_URL
  if (shared?.key !== key) {
    shared = { key, api: createNetgsmApi(fake ? { baseUrl: fake } : {}) }
  }
  return shared.api
}
