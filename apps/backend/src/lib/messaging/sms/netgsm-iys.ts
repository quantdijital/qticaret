import { z } from "@medusajs/framework/zod"
import { createHttpClient } from "../../clients"
import type { HttpClient, HttpClientOptions } from "../../clients"
import { parseEnv } from "../../env"
import { ProviderError } from "../../errors"
import { NETGSM_PROVIDER, NETGSM_URL } from "./netgsm"
import type { NetgsmCredentialsSource } from "./netgsm"

/**
 * İYS through the shop's Netgsm account (F10 M11, adr/0038 §2), as
 * Netgsm's own İYS package calls it: `POST /iys/add` with the login and
 * the brand code in the body's `header`, the consents in `body.data`;
 * answered `code` 0 with a `uid`, or a code and an error.
 */

export interface IysAccount {
  usercode: string
  password: string
  /** The number İYS gave the shop's brand. */
  brandCode: string
}

export type IysChannel = "email" | "sms" | "call"

export interface IysRecord {
  type: "MESAJ" | "ARAMA" | "EPOSTA"
  source: string
  /** `+905XXXXXXXXX` or an e-mail address. */
  recipient: string
  status: "ONAY" | "RET"
  /** Türkiye's time, `YYYY-MM-DD HH:mm:ss`. */
  consentDate: string
  recipientType: "BIREYSEL" | "TACIR"
}

const BRAND_CODE = /^\d{1,12}$/

/** The account with its İYS brand code; null until the shop has entered both. */
export function iysAccountOf(account: NetgsmCredentialsSource | null): IysAccount | null {
  const usercode = account?.secrets["usercode"]
  const password = account?.secrets["password"]
  const brandCode = account?.settings["iys_brand_code"]
  return usercode && password && typeof brandCode === "string" && BRAND_CODE.test(brandCode)
    ? { usercode, password, brandCode }
    : null
}

const TYPES = { email: "EPOSTA", sms: "MESAJ", call: "ARAMA" } as const

/**
 * Where the consent was given, in İYS's words. A storefront's page is the
 * web; what staff record in the panel was given in person or on paper; an
 * import came from another electronic record.
 */
const SOURCES: Readonly<Record<string, string>> = {
  checkout: "HS_WEB",
  account: "HS_WEB",
  unsubscribe: "HS_WEB",
  panel: "HS_FIZIKSEL_ORTAM",
  import: "HS_EORTAM",
}

// `sv-SE` writes dates as İYS reads them: 2026-10-29 00:13:08
const ISTANBUL = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

/**
 * A consent as İYS takes it; null for one İYS does not take from us (it
 * came from İYS itself, or its address is no phone or e-mail İYS knows).
 */
export function iysRecordOf(
  consent: {
    channel: IysChannel
    status: "granted" | "revoked"
    source: string
    changed_at: Date | string
  },
  address: string
): IysRecord | null {
  const source = SOURCES[consent.source]
  const recipient = consent.channel === "email" ? address.trim().toLowerCase() : address.trim()
  const valid =
    consent.channel === "email"
      ? /^[^\s@]+@[^\s@]+$/.test(recipient)
      : /^\+905\d{9}$/.test(recipient)
  if (!source || !valid) {
    return null
  }
  return {
    type: TYPES[consent.channel],
    source,
    recipient,
    status: consent.status === "granted" ? "ONAY" : "RET",
    consentDate: ISTANBUL.format(new Date(consent.changed_at)),
    recipientType: "BIREYSEL",
  }
}

const IysAnswer = z.looseObject({
  code: z.union([z.string(), z.number()]),
  error: z.union([z.string(), z.boolean()]).optional(),
  uid: z.string().optional(),
})

export function createNetgsmIysApi(options: Partial<Omit<HttpClientOptions, "provider">> = {}) {
  const client: HttpClient = createHttpClient({
    ...options,
    baseUrl: options.baseUrl ?? NETGSM_URL,
    provider: NETGSM_PROVIDER,
  })

  /**
   * Tells İYS of one consent. Sent again it changes nothing, so a lost
   * answer is tried again. A refusal names its code (`iys_70`: a field
   * İYS does not take; `iys_30`: the login; `iys_40`: the brand code).
   */
  async function add(account: IysAccount, record: IysRecord): Promise<{ uid: string }> {
    const answer = await client.request({
      method: "POST",
      path: "/iys/add",
      json: {
        header: {
          username: account.usercode,
          password: account.password,
          brandCode: account.brandCode,
        },
        body: { data: [record] },
      },
      idempotent: true,
      schema: IysAnswer,
    })
    const code = String(answer.code)
    if (code !== "0" || !answer.uid) {
      throw new ProviderError({
        provider: NETGSM_PROVIDER,
        providerCode: /^\d{1,3}$/.test(code) ? `iys_${code}` : "iys_rejected",
        retryable: false,
      })
    }
    return { uid: answer.uid }
  }

  return { add }
}

export type NetgsmIysApi = ReturnType<typeof createNetgsmIysApi>

let shared: { key: string; api: NetgsmIysApi } | undefined

/** One client per address; a local fake server's in development (`NETGSM_BASE_URL`). */
export function netgsmIysApi(): NetgsmIysApi {
  const fake = parseEnv().NETGSM_BASE_URL
  const key = fake ?? NETGSM_URL
  if (shared?.key !== key) {
    shared = { key, api: createNetgsmIysApi(fake ? { baseUrl: fake } : {}) }
  }
  return shared.api
}
