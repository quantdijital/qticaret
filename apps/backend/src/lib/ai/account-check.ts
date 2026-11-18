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
  header: "bearer" | "x-api-key"
  /** What a documented answer looks like. */
  answer: "model_list" | "photoroom_account"
}

const CHECKS: Readonly<Record<string, CheckCall>> = {
  deepseek: { url: "https://api.deepseek.com/models", header: "bearer", answer: "model_list" },
  minimax: { url: "https://api.minimax.io/v1/models", header: "bearer", answer: "model_list" },
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
    return answer === "model_list"
      ? parsed["object"] === "list" && Array.isArray(parsed["data"])
      : isRecord(parsed["images"])
  } catch {
    return false
  }
}

/** A registered body code by what it means; any other is an answer out of the documentation. */
const BODY_VERDICTS: Readonly<Partial<Record<AiErrorKey, AiAccountCheck>>> = {
  "ai.key_rejected": "secret_invalid",
  // The key was taken; what is left on the account is the service's own matter
  "ai.provider_balance": "valid",
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
    call.header === "bearer" ? { Authorization: `Bearer ${apiKey}` } : { "x-api-key": apiKey }
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
  const [outcome, code] = verdict
  if (outcome !== "valid") {
    // The outcome and a code of ours: never the body, the headers or the address's query
    logger.warn({ event: "ai.account_check_failed", service: service.id, outcome, code })
  }
  return outcome
}

/** The check `CHECKERS` runs for an AI service: its one secret is the key. */
export const aiAccountChecker =
  (serviceId: string) =>
  (account: { secrets: Record<string, string> }, signal: AbortSignal): Promise<AiAccountCheck> => {
    const apiKey = account.secrets["api_key"]
    return apiKey ? checkAiAccount(serviceId, apiKey, signal) : Promise.resolve("secret_invalid")
  }
