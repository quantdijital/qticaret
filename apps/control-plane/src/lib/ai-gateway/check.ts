import type { Logger, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  AI_FAKE_TARGET,
  AI_SERVICE_CHECKS,
  AI_SERVICE_TARGETS,
} from "@qticaret/types/control-plane"
import type { AiServiceCheck, AiServiceTarget } from "@qticaret/types/control-plane"
import { PLATFORM_OWNER, aiProviderKeyName } from "../vault/secret-names"
import { vaultIn } from "../../workflows/modules"
import { credentialHeader } from "./headers"
import { providerKeysHeld } from "./keys"
import type { ProviderFetch } from "./forward"
import { FAKE_URL_ENV } from "./target"

type Container = Pick<MedusaContainer, "resolve">

/**
 * "Test the connection" (adr/0071 §3, adr/0085 §2): the platform's key
 * for a service proved by the service's cheapest call that generates
 * nothing (`AI_SERVICE_CHECKS`: a model list, Photoroom's account, the
 * status of a request Bria never had), as the
 * shop's own check does (apps/backend lib/ai/account-check.ts). The
 * address is the table's alone, `https`, on the service's hosts; no
 * redirect followed; a short time and a small answer cap. The key is
 * opened for the call only and zeroed after; no credit moves, no ledger
 * row is written. What comes back is a verdict, never the provider's
 * answer, header or status text (a refusal may quote the key).
 *
 * - `no_key`: the platform holds no key for it.
 * - `unexpected` too when the vault cannot open the key it holds (logged).
 * - `rejected`: the service refused the key (401; 403 where documented).
 * - `unreachable`: no answer to judge (network, 408, 429, 5xx).
 * - `timeout`: past the time.
 * - `unexpected`: an answer out of the documentation (or a redirect).
 */

export type ProviderCheckReason = "no_key" | "rejected" | "unreachable" | "timeout" | "unexpected"

export type ProviderCheck = { ok: true } | { ok: false; reason: ProviderCheckReason }

export const PROVIDER_CHECK_TIMEOUT_MS = 8_000
// A model list is kilobytes; anything far larger is not one
export const PROVIDER_CHECK_MAX_ANSWER_BYTES = 512 * 1024

/** The fake service's check (NODE_ENV test only, on the loopback): its `/models`. */
export const FAKE_CHECK_PATH = "/models"

interface CheckTarget {
  url: URL
  auth: AiServiceCheck["auth"]
  answer: AiServiceCheck["answer"]
  documented: boolean
}

function fakeCheck(): CheckTarget | null {
  const base = process.env[FAKE_URL_ENV]
  if (process.env["NODE_ENV"] !== "test" || base === undefined || !URL.canParse(base)) {
    return null
  }
  const root = new URL(base)
  if (root.protocol !== "http:" || root.hostname !== "127.0.0.1") {
    return null
  }
  return {
    url: new URL(FAKE_CHECK_PATH, root),
    auth: "bearer",
    answer: "model_list",
    documented: true,
  }
}

/** Where a service's check goes, from the table only; null where it may go nowhere. */
export function checkTargetOf(service: string): CheckTarget | null {
  if (service === AI_FAKE_TARGET.id) {
    return fakeCheck()
  }
  if (!Object.hasOwn(AI_SERVICE_CHECKS, service) || !Object.hasOwn(AI_SERVICE_TARGETS, service)) {
    return null
  }
  const check = AI_SERVICE_CHECKS[service as keyof typeof AI_SERVICE_CHECKS] as AiServiceCheck
  const hosts = (AI_SERVICE_TARGETS[service as keyof typeof AI_SERVICE_TARGETS] as AiServiceTarget)
    .hosts
  if (!URL.canParse(check.url)) {
    return null
  }
  const url = new URL(check.url)
  const clean =
    url.protocol === "https:" &&
    url.port === "" &&
    url.search === "" &&
    url.hash === "" &&
    url.username === "" &&
    url.password === ""
  return clean && hosts.includes(url.hostname)
    ? { url, auth: check.auth, answer: check.answer, documented: check.documented !== false }
    : null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/**
 * A documented answer: `{ object: "list", data: [...] }`, Photoroom's
 * `images`, or a Bria status (`status`, `UNKNOWN` for a request it never had).
 */
function isDocumented(answer: CheckTarget["answer"], body: Buffer): boolean {
  try {
    const parsed: unknown = JSON.parse(body.toString("utf8"))
    if (!isRecord(parsed)) {
      return false
    }
    if (answer === "bria_status") {
      return typeof parsed["status"] === "string"
    }
    return answer === "model_list"
      ? parsed["object"] === "list" && Array.isArray(parsed["data"])
      : isRecord(parsed["images"])
  } catch {
    return false
  }
}

/**
 * Bria's own "no such request" (a 404): a JSON object with its `status`
 * or its error object. The shop's check reads it the same way
 * (`apps/backend/src/lib/ai/account-check.ts`).
 */
function isBriaNotFound(body: Buffer): boolean {
  try {
    const parsed: unknown = JSON.parse(body.toString("utf8"))
    return isRecord(parsed) && (typeof parsed["status"] === "string" || isRecord(parsed["error"]))
  } catch {
    return false
  }
}

/** The answer's bytes up to the cap; null past it (the rest is not read). */
async function readCapped(response: Response): Promise<Buffer | null> {
  const max = PROVIDER_CHECK_MAX_ANSWER_BYTES
  const declared = Number(response.headers.get("content-length") ?? "")
  if (Number.isFinite(declared) && declared > max) {
    await response.body?.cancel().catch(() => undefined)
    return null
  }
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of (response.body ?? []) as AsyncIterable<Uint8Array>) {
    size += chunk.byteLength
    if (size > max) {
      return null
    }
    chunks.push(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength))
  }
  return Buffer.concat(chunks, size)
}

function verdictOf(target: CheckTarget, status: number, body: Buffer | null): ProviderCheck {
  if (status === 401 || (status === 403 && target.documented)) {
    return { ok: false, reason: "rejected" }
  }
  if (status === 408 || status === 429 || status >= 500) {
    return { ok: false, reason: "unreachable" }
  }
  // Bria: "the request_id does not exist" is said only to a key it took (a 401 otherwise),
  // and only in its own JSON; a bare, HTML or empty 404 says nothing of the key
  if (status === 404 && target.answer === "bria_status") {
    return body !== null && isBriaNotFound(body)
      ? { ok: true }
      : { ok: false, reason: "unreachable" }
  }
  if (status >= 200 && status < 300 && body !== null && isDocumented(target.answer, body)) {
    return { ok: true }
  }
  return { ok: false, reason: "unexpected" }
}

// The request never left, or was cut on the way: no answer to judge
const NO_ANSWER: ReadonlySet<string> = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EAI_AGAIN",
  "UND_ERR_SOCKET",
])

const causeCode = (error: unknown): string => {
  const cause = (error as { cause?: { code?: unknown } } | null)?.cause
  return typeof cause?.code === "string" ? cause.code : ""
}

// The vault holds no such key (any more): `openSecret`'s own refusal
const secretGone = (error: unknown): boolean => {
  const { type, message } = (error ?? {}) as { type?: unknown; message?: unknown }
  return type === MedusaError.Types.NOT_FOUND && message === "cp.secret_unknown"
}

const kindOf = (error: unknown): string =>
  error instanceof Error ? error.name : error === null ? "null" : typeof error

/** One check of the platform's key for `service`; `options` for tests only. */
export async function checkProviderKey(
  container: Container,
  service: string,
  options: { fetch?: ProviderFetch; timeoutMs?: number } = {}
): Promise<ProviderCheck> {
  const target = checkTargetOf(service)
  if (target === null) {
    return { ok: false, reason: "unexpected" }
  }
  if (!(await providerKeysHeld(container)).has(service)) {
    return { ok: false, reason: "no_key" }
  }
  let key: Buffer | null = null
  const deadline = AbortSignal.timeout(options.timeoutMs ?? PROVIDER_CHECK_TIMEOUT_MS)
  try {
    try {
      key = await vaultIn(container).openSecret(PLATFORM_OWNER, aiProviderKeyName(service))
    } catch (error) {
      // Retired meanwhile: nothing was sent
      if (secretGone(error)) {
        return { ok: false, reason: "no_key" }
      }
      // PR #374 review Y4: the vault failed (no KEK, a broken envelope);
      // logged by the error's kind alone, never its text
      container
        .resolve<Logger>(ContainerRegistrationKeys.LOGGER)
        .error(`ai.provider_check.vault_failed ${JSON.stringify({ service, err: kindOf(error) })}`)
      return { ok: false, reason: "unexpected" }
    }
    const value = key.toString("utf8")
    const response = await (options.fetch ?? fetch)(target.url, {
      method: "GET",
      headers: { ...credentialHeader(target.auth, value), accept: "application/json" },
      redirect: "error",
      signal: deadline,
    })
    return verdictOf(target, response.status, await readCapped(response))
  } catch (error) {
    if (deadline.aborted) {
      return { ok: false, reason: "timeout" }
    }
    return { ok: false, reason: NO_ANSWER.has(causeCode(error)) ? "unreachable" : "unexpected" }
  } finally {
    key?.fill(0)
  }
}
