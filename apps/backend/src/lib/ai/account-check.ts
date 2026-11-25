import { AI_SERVICE_CHECKS } from "@qticaret/types/control-plane"
import { logger } from "../logging"
import { isSafeFetchError, safeFetch } from "../security/safe-fetch"
import type { SafeFetchResponse } from "../security/safe-fetch"
import { registeredBodyError } from "./connectors/openai-response"
import type { AiErrorKey } from "./errors"
import { findAiService } from "./registry/services"
import type { AiService } from "./registry/services"

/**
 * "Test the connection" for an AI service (adr/0071 §3): the cheapest call
 * that proves the key, one that generates nothing and costs nothing: the
 * model list (Photoroom, which has none: its account details). The address
 * is fixed here and must be on the service's host list; the key goes in a
 * header only (the service's own); redirects are
 * refused; nothing of the answer but its status (and a registered code)
 * is read, logged or kept (§9).
 *
 * - `secret_invalid`: the service refused the key (401, 403, its own code).
 * - `unreachable`: the network, a timeout, 408, 429 or a 5xx; no verdict.
 * - `failed`: an answer out of the documentation; nothing is saved.
 */

export type AiAccountCheck = "valid" | "secret_invalid" | "unreachable" | "failed"

/*
 * The model list of each service, verified 2026-11-17 against:
 *   deepseek: https://api-docs.deepseek.com/api/list-models (GET /models, `object: "list"`,
 *     `data` of models) and https://api-docs.deepseek.com/ (base address
 *     https://api.deepseek.com, `Authorization: Bearer`)
 *   minimax: https://platform.minimax.io/docs/api-reference/models/openai/list-models
 *     (GET https://api.minimax.io/v1/models, "Bearer API_key, used for account
 *     verification", `object: "list"`, `data` of models)
 *   gemini: https://aistudio.google.com/docs/openai, "List models" (GET
 *     https://generativelanguage.googleapis.com/v1beta/openai/models,
 *     `Authorization: Bearer GEMINI_API_KEY`)
 * Not documented on these pages: their error statuses; the chat endpoint's documented
 * meanings (lib/ai/registry/services.ts) are taken for the same key.
 */
interface CheckCall {
  url: string
  /** Where the key goes: `Authorization: Bearer`, or the service's own header. */
  header: "bearer" | "x-api-key" | "api_token"
  /** What a documented answer looks like. */
  answer: "model_list" | "photoroom_account" | "bria_status"
  /**
   * false: the check itself is not fully documented, so an answer out of the
   * documentation says nothing about the key: only 401 refuses it (a 403
   * and anything else are no verdict: the key is saved as not checked).
   */
  documented?: false
}

const CHECKS: Readonly<Record<string, CheckCall>> = {
  deepseek: { url: "https://api.deepseek.com/models", header: "bearer", answer: "model_list" },
  minimax: { url: "https://api.minimax.io/v1/models", header: "bearer", answer: "model_list" },
  // Read 2026-11-25: Model Studio's pages (base-url, the OpenAI-compatible chat reference)
  // document no model list; the OpenAI-compatible address is tried, and only a 401 refuses
  // (a 403 there may be an overdue account or a model the key may not call: error-code)
  qwen: {
    url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models",
    header: "bearer",
    answer: "model_list",
    documented: false,
  },
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/models",
    header: "bearer",
    answer: "model_list",
  },
  // Verified 2026-11-18: https://docs.photoroom.com/getting-started/api-reference-openapi.md
  // ("Get current account details, including remaining image edits and monthly quota";
  // `images.available`, `images.subscription`, `plan`). The page shows no header for it;
  // `x-api-key` is the one every other Photoroom endpoint documents
  photoroom: {
    url: "https://image-api.photoroom.com/v2/account",
    header: "x-api-key",
    answer: "photoroom_account",
    documented: false,
  },
  // Verified 2026-11-25: Bria documents no account or key endpoint
  // (https://docs.bria.ai/getting-started/authentication.md: 401 for a missing, invalid or
  // revoked token). The status of a request it never had generates nothing
  // (https://docs.bria.ai/getting-started/async-requests: GET /v2/status/{request_id};
  // "a 404 means the request_id does not exist", or `status: UNKNOWN` "an unknown or
  // expired request_id"): an answer of that kind says the key was taken. That a
  // refused key gets its 401 before the lookup is not written down: not documented
  bria: {
    url: AI_SERVICE_CHECKS.bria.url,
    header: "api_token",
    answer: "bria_status",
    documented: false,
  },
}

// A person waits at the panel (lib/integrations/account-check.ts gives 8 s in all)
const CHECK_TIMEOUT_MS = 8_000
// A model list is kilobytes; anything far larger is not one
const MAX_RESPONSE_BYTES = 1024 * 1024

export interface AiAccountCheckOptions {
  /** Tests only. */
  fetch?: typeof safeFetch
  nodeEnv?: string | undefined
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** The registered address, or null: nothing but this table names where a check goes. */
function checkUrlOf(service: AiService): URL | null {
  const raw = CHECKS[service.id]?.url
  if (raw === undefined || !URL.canParse(raw)) {
    return null
  }
  const url = new URL(raw)
  return url.protocol === "https:" && url.search === "" && service.hosts.includes(url.hostname)
    ? url
    : null
}

/** A model list as documented: `{ object: "list", data: [...] }`. */
function isDocumentedAnswer(answer: CheckCall["answer"], body: Buffer): boolean {
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
 * or its error object. The control plane's check reads it the same way
 * (`apps/control-plane/src/lib/ai-gateway/check.ts`).
 */
function isBriaNotFound(body: Buffer): boolean {
  try {
    const parsed: unknown = JSON.parse(body.toString("utf8"))
    return isRecord(parsed) && (typeof parsed["status"] === "string" || isRecord(parsed["error"]))
  } catch {
    return false
  }
}

/** A registered body code by what it means; any other is an answer out of the documentation. */
const BODY_VERDICTS: Readonly<Partial<Record<AiErrorKey, AiAccountCheck>>> = {
  "ai.key_rejected": "secret_invalid",
  // The key was taken; what is left on the account is the service's own matter
  "ai.provider_balance": "valid",
  "ai.provider_quota": "valid",
  "ai.provider_busy": "unreachable",
  "ai.provider_unavailable": "unreachable",
  "ai.timeout": "unreachable",
}

function verdictOf(service: AiService, response: SafeFetchResponse): [AiAccountCheck, string] {
  const { status } = response
  const code = `http_${String(status)}`
  // A refused key whatever a body code beside it says
  if (status === 401 || status === 403) {
    return ["secret_invalid", code]
  }
  // MiniMax answers some failures with 200 and its own code in the body
  const registered = registeredBodyError(service, response.body)
  if (registered) {
    return [BODY_VERDICTS[registered.key] ?? "failed", `body_${String(registered.code)}`]
  }
  // Prepaid credit or balance used up: the key itself was accepted
  if (status === 402) {
    return ["valid", code]
  }
  if (status === 408 || status === 429 || status >= 500) {
    return ["unreachable", code]
  }
  // Bria: "no such request" is said only to a key it took (CHECKS above), and only in its
  // own JSON; a bare, HTML or empty 404 (a proxy, a moved path) says nothing of the key
  if (status === 404 && CHECKS[service.id]?.answer === "bria_status") {
    return isBriaNotFound(response.body) ? ["valid", code] : ["unreachable", "not_bria_404"]
  }
  if (status >= 200 && status < 300) {
    const answer = CHECKS[service.id]?.answer ?? "model_list"
    return isDocumentedAnswer(answer, response.body)
      ? ["valid", code]
      : ["failed", "not_a_documented_answer"]
  }
  return ["failed", code]
}

/** A failure before any answer; only its kind is kept, the error may quote the request. */
function verdictOfThrown(error: unknown): [AiAccountCheck, string] {
  if (!isSafeFetchError(error)) {
    return ["failed", "unexpected"]
  }
  const reachable = !["timeout", "aborted", "dns_failed", "request_failed"].includes(error.reason)
  return [reachable ? "failed" : "unreachable", error.reason]
}

/** Whether the service is one that never leaves the machine (the fake, in tests). */
const isLocal = (service: AiService): boolean =>
  service.hosts.length === 0 &&
  Object.values(service.capabilities).every(
    (target) => target.connector === "fake" || target.connector === "fake-image"
  )

export async function checkAiAccount(
  serviceId: string,
  apiKey: string,
  signal: AbortSignal,
  options: AiAccountCheckOptions = {}
): Promise<AiAccountCheck> {
  const service = findAiService(serviceId, options.nodeEnv)
  if (service === null) {
    return "failed"
  }
  if (isLocal(service)) {
    return "valid"
  }
  const url = checkUrlOf(service)
  const call = CHECKS[service.id]
  if (url === null || call === undefined) {
    return "failed"
  }
  const auth: Record<string, string> =
    call.header === "bearer"
      ? { Authorization: `Bearer ${apiKey}` }
      : call.header === "api_token"
        ? { api_token: apiKey }
        : { "x-api-key": apiKey }
  let verdict: [AiAccountCheck, string]
  try {
    const response = await (options.fetch ?? safeFetch)(url, {
      method: "GET",
      headers: { ...auth, Accept: "application/json" },
      redirect: "error",
      timeoutMs: CHECK_TIMEOUT_MS,
      maxResponseBytes: MAX_RESPONSE_BYTES,
      signal,
    })
    verdict = verdictOf(service, response)
  } catch (error) {
    verdict = verdictOfThrown(error)
  }
  const [checked, code] = verdict
  // Where the check's own answer is not documented only a 401 refuses the key: a 403 may
  // mean a plan or a scope this endpoint wants, and anything else is no verdict either
  const undocumentedNoVerdict =
    call.documented === false &&
    (checked === "failed" || (checked === "secret_invalid" && code === "http_403"))
  const outcome = undocumentedNoVerdict ? "unreachable" : checked
  if (outcome !== "valid") {
    // The outcome and a code of ours: never the body, the headers or the address's query
    logger.warn({ event: "ai.account_check_failed", service: service.id, outcome, code })
  }
  return outcome
}

/**
 * Whether a key for this service may replace a working one unchecked: its
 * check is not documented enough to hold a save back (Photoroom). The key
 * is then kept as "not checked" and the panel warns; a 401 still
 * stops the save.
 */
export const replacesUnchecked = (serviceId: string): boolean =>
  CHECKS[serviceId]?.documented === false

/** The check `CHECKERS` runs for an AI service: its one secret is the key. */
export const aiAccountChecker =
  (serviceId: string) =>
  (account: { secrets: Record<string, string> }, signal: AbortSignal): Promise<AiAccountCheck> => {
    const apiKey = account.secrets["api_key"]
    return apiKey ? checkAiAccount(serviceId, apiKey, signal) : Promise.resolve("secret_invalid")
  }
