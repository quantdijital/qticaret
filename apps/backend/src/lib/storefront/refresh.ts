import { createHmac, randomBytes } from "node:crypto"
import { BlockList, isIP } from "node:net"
import type { MedusaContainer } from "@medusajs/framework/types"
import { isLocalEnv, parseEnv, storefrontOrigin } from "../env"
import type { Env } from "../env"
import { errorSummary, logger } from "../logging"
import {
  DEFAULT_ALLOWED_PORTS,
  isBlockedAddress,
  isSafeFetchError,
  safeFetch,
} from "../security/safe-fetch"
import type { SafeFetchOptions, SafeFetchResponse } from "../security/safe-fetch"
import { systemResolver } from "../security/safe-fetch/resolver"
import { createSafeFetch } from "../security/safe-fetch/safe-fetch"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { SectionName, SeoSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

/**
 * Tells the storefront's server to forget its shop-wide answers now
 * (adr/0048 ek 2026-11-03): without it a publication or a settings save
 * shows within the storefront's one-minute cache. `POST <origin>/api/yenile`
 * with `{ scopes, at, nonce }`, signed with the secret both servers already
 * hold (`STOREFRONT_IP_SECRET`, adr/0046 §5): the HMAC-SHA256 of
 * `<at>.<nonce>.<scopes joined by ",">`. One attempt of 3 seconds; the
 * minute's cache is the fallback, so nothing here ever fails the caller.
 */

/** What changed, in this order on the wire; the storefront maps each to its caches. */
export const REFRESH_SCOPES = ["layout", "settings", "menus", "legal", "content", "site"] as const
export type RefreshScope = (typeof REFRESH_SCOPES)[number]

export const REFRESH_PATH = "/api/yenile"

export const REFRESH_HEADERS = {
  time: "x-qt-refresh-time",
  signature: "x-qt-refresh-signature",
} as const

const TIMEOUT_MS = 3000
// The storefront answers 204; anything long is not its answer
const MAX_RESPONSE_BYTES = 4096

/** The scopes once each, in the wire order (`REFRESH_SCOPES`). */
export const refreshScopes = (scopes: readonly RefreshScope[]): RefreshScope[] =>
  REFRESH_SCOPES.filter((scope) => scopes.includes(scope))

/**
 * What a settings section's save may change on the storefront. `site` is
 * the edge's own answer (indexing, canonical host, maintenance); `legal`
 * the legal texts, whose tokens read the shop's details.
 */
const SECTION_SCOPES: Partial<Record<SectionName, readonly RefreshScope[]>> = {
  storefront: ["settings"],
  theme: ["settings"],
  promotions: ["settings"],
  // The logo in the storefront's frame (`/store/seo/site`)
  appearance: ["settings"],
  store: ["settings", "legal"],
  legal: ["settings", "legal"],
  maintenance: ["settings", "site"],
  seo: ["settings", "site"],
}

export const scopesForSection = (section: SectionName): RefreshScope[] => [
  ...(SECTION_SCOPES[section] ?? []),
]

export function signRefresh(
  secret: string,
  unixSeconds: number,
  nonce: string,
  scopes: readonly RefreshScope[]
): string {
  return createHmac("sha256", secret)
    .update(`${String(unixSeconds)}.${nonce}.${scopes.join(",")}`)
    .digest("hex")
}

export interface RefreshRequest {
  body: string
  headers: Record<string, string>
}

/** The request's body and headers: the time in both, a fresh nonce, the signature. */
export function refreshRequest(
  secret: string,
  scopes: readonly RefreshScope[],
  unixSeconds = Math.floor(Date.now() / 1000),
  nonce = randomBytes(16).toString("hex")
): RefreshRequest {
  const ordered = refreshScopes(scopes)
  return {
    body: JSON.stringify({ scopes: ordered, at: unixSeconds, nonce }),
    headers: {
      "content-type": "application/json",
      [REFRESH_HEADERS.time]: String(unixSeconds),
      [REFRESH_HEADERS.signature]: signRefresh(secret, unixSeconds, nonce, ordered),
    },
  }
}

export interface RefreshTarget {
  url: string
  /** Set by the operator (`STOREFRONT_ORIGIN` or the local default), not by the shop. */
  configured: boolean
}

/**
 * Where the signal goes: `STOREFRONT_ORIGIN` (on a developer's machine
 * localhost:8000 when unset, never a live shop's host), else the shop's
 * canonical host once deployed, else nowhere.
 */
export function refreshTarget(
  env: Pick<Env, "STOREFRONT_ORIGIN" | "NODE_ENV">,
  canonicalHost: string | null
): RefreshTarget | null {
  const origin = storefrontOrigin(env)
  if (origin) {
    return { url: `${origin}${REFRESH_PATH}`, configured: true }
  }
  return canonicalHost
    ? { url: `https://${canonicalHost}${REFRESH_PATH}`, configured: false }
    : null
}

type Fetch = (url: string, options: SafeFetchOptions) => Promise<SafeFetchResponse>

const loopback = new BlockList()
loopback.addSubnet("127.0.0.0", 8, "ipv4")
loopback.addAddress("::1", "ipv6")

const isLoopback = (address: string): boolean => {
  const family = isIP(address)
  return family !== 0 && loopback.check(address, family === 4 ? "ipv4" : "ipv6")
}

// The storefront on this machine: `localhost` is not in DNS (c-ares skips /etc/hosts)
const localFetch: Fetch = createSafeFetch({
  resolve: (hostname, signal) =>
    hostname === "localhost"
      ? Promise.resolve([{ address: "127.0.0.1", family: 4 }])
      : systemResolver(hostname, signal),
  isAddressAllowed: (address) => isLoopback(address) || !isBlockedAddress(address),
})

/**
 * The SSRF rules (docs/04) for this one call. On a developer's machine and
 * in tests the storefront runs on loopback, so loopback is allowed there
 * and only there; every other private address stays refused everywhere.
 */
export const refreshFetch = (env: Pick<Env, "NODE_ENV">): Fetch =>
  isLocalEnv(env) ? localFetch : safeFetch

/** The ports the target may use: an operator's own port, the web's two otherwise. */
const portsFor = (target: RefreshTarget): readonly number[] => {
  if (!target.configured) {
    return DEFAULT_ALLOWED_PORTS
  }
  const url = new URL(target.url)
  const port = url.port === "" ? (url.protocol === "https:" ? 443 : 80) : Number(url.port)
  return [...new Set([...DEFAULT_ALLOWED_PORTS, port])]
}

export type RefreshOutcome = "sent" | "failed" | "skipped"

export interface RefreshDependencies {
  env?: Pick<Env, "NODE_ENV" | "STOREFRONT_ORIGIN" | "STOREFRONT_IP_SECRET">
  fetch?: Fetch
}

async function canonicalHostOf(container: Pick<MedusaContainer, "resolve">) {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const seo = (await settings.getSection("seo")) as unknown as SeoSettings
  return seo.canonical_host
}

async function send(
  container: Pick<MedusaContainer, "resolve">,
  scopes: RefreshScope[],
  deps: RefreshDependencies
): Promise<RefreshOutcome> {
  const env = deps.env ?? parseEnv()
  const secret = env.STOREFRONT_IP_SECRET
  if (!secret) {
    logger.debug({ event: "storefront.refresh_skipped", reason: "no_secret" })
    return "skipped"
  }
  // The shop's host is read only when no origin is set (or the local default)
  const target = refreshTarget(env, storefrontOrigin(env) ? null : await canonicalHostOf(container))
  if (!target) {
    logger.debug({ event: "storefront.refresh_skipped", reason: "no_target" })
    return "skipped"
  }
  const request = refreshRequest(secret, scopes)
  try {
    const answer = await (deps.fetch ?? refreshFetch(env))(target.url, {
      method: "POST",
      headers: request.headers,
      body: request.body,
      timeoutMs: TIMEOUT_MS,
      maxResponseBytes: MAX_RESPONSE_BYTES,
      maxRedirects: 0,
      redirect: "error",
      allowedPorts: portsFor(target),
    })
    if (answer.status >= 200 && answer.status < 300) {
      logger.info({ event: "storefront.refresh_sent", status: answer.status, scopes })
      return "sent"
    }
    logger.warn({
      event: "storefront.refresh_failed",
      status: answer.status,
      reason: "status_not_ok",
      scopes,
    })
  } catch (error) {
    logger.warn({ event: "storefront.refresh_failed", scopes, ...failureOf(error) })
  }
  return "failed"
}

/**
 * Why the signal failed, for its log line. The reason only (`timeout`,
 * `address_not_allowed`…): the URL is not logged. A storefront that
 * answered and whose body was too long to read is classified by its status:
 * a 500's error page is `status_not_ok` (the storefront failed), not a
 * size problem; only a 2xx with an oversized body is `response_too_large`.
 */
export function failureOf(error: unknown): Record<string, unknown> {
  if (!isSafeFetchError(error)) {
    return { err: errorSummary(error) }
  }
  const status = error.status
  if (status === undefined) {
    return { reason: error.reason }
  }
  const ok = status >= 200 && status < 300
  return { status, reason: ok ? error.reason : "status_not_ok" }
}

/**
 * Sends the signal for `scopes` and says how it went; never throws. A
 * storefront that is down, slow or refusing costs a log line, and the
 * change shows within the minute as before.
 */
export async function refreshStorefront(
  container: Pick<MedusaContainer, "resolve">,
  scopes: readonly RefreshScope[],
  deps: RefreshDependencies = {}
): Promise<RefreshOutcome> {
  const ordered = refreshScopes(scopes)
  if (ordered.length === 0) {
    return "skipped"
  }
  try {
    return await send(container, ordered, deps)
  } catch (error) {
    // The settings read or the environment: still nothing for the caller
    logger.warn({ event: "storefront.refresh_failed", scopes: ordered, err: errorSummary(error) })
    return "failed"
  }
}

/**
 * Under NODE_ENV=test the signal is off unless a test turns it on
 * (`QT_TEST_STOREFRONT_REFRESH=1`, like RATE_LIMIT_RELAXED): every other
 * suite's saves would knock on a storefront that is not there.
 */
export function isRefreshOn(env: NodeJS.ProcessEnv = process.env): boolean {
  return env["NODE_ENV"] !== "test" || env["QT_TEST_STOREFRONT_REFRESH"] === "1"
}
