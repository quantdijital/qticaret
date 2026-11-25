import { answerContentType, providerHeaders } from "./headers"
import { platformFault, readableAnswerType } from "./provider-errors"
import type { GatewayTarget } from "./target"

/**
 * One provider call (adr/0085 §2): to the target's fixed address, no
 * redirect followed, within its time, its answer read up to a cap and
 * never streamed on. What comes back is only what the gateway needs: the
 * status, the type and the bytes of an answer, or the kind of failure
 * (never the thrown error's text: it may quote the request).
 *
 * - `answered`: the provider gave a status (any).
 * - `not_connected`: the request never reached it (no address, refused,
 *   unreachable): nothing could be charged for it there.
 * - `timeout`: past the time; the work may have been done and billed.
 * - `failed`: a reset, a cut or too large answer, a redirect: it may
 *   have been done too.
 */

export type ForwardOutcome =
  | { kind: "answered"; status: number; contentType: string; body: Buffer }
  | { kind: "not_connected" | "timeout" | "failed"; code: string }

export type ProviderFetch = (url: URL, init: RequestInit) => Promise<Response>

export interface ForwardInput {
  target: GatewayTarget
  key: Buffer
  body: Buffer
  contentType: string
  timeoutMs: number
  maxAnswerBytes: number
  fetch?: ProviderFetch
}

// The request never left (the shop's `NEVER_CONNECTED`, lib/ai/connectors/openai-compatible.ts)
const NEVER_CONNECTED: ReadonlySet<string> = new Set([
  "ECONNREFUSED",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EAI_AGAIN",
])

const causeCode = (error: unknown): string => {
  const cause = (error as { cause?: { code?: unknown } } | null)?.cause
  return typeof cause?.code === "string" ? cause.code : ""
}

/** The answer's bytes up to `max`; null past it (the rest is not read). */
async function readCapped(response: Response, max: number): Promise<Buffer | null> {
  const declared = Number(response.headers.get("content-length") ?? "")
  if (Number.isFinite(declared) && declared > max) {
    await response.body?.cancel().catch(() => undefined)
    return null
  }
  if (response.body === null) {
    return Buffer.alloc(0)
  }
  const chunks: Buffer[] = []
  let size = 0
  // Leaving the loop early cancels the stream: the rest is never read
  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    size += chunk.byteLength
    if (size > max) {
      return null
    }
    chunks.push(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength))
  }
  return Buffer.concat(chunks, size)
}

export async function forwardCall(input: ForwardInput): Promise<ForwardOutcome> {
  const { target } = input
  const deadline = AbortSignal.timeout(input.timeoutMs)
  let response: Response
  try {
    response = await (input.fetch ?? fetch)(target.url, {
      method: "POST",
      headers: providerHeaders(target.auth, input.key, input.contentType),
      body: input.body,
      redirect: "error",
      signal: deadline,
    })
  } catch (error) {
    if (deadline.aborted) {
      return { kind: "timeout", code: "timeout" }
    }
    const code = causeCode(error)
    return NEVER_CONNECTED.has(code)
      ? { kind: "not_connected", code: "connect_failed" }
      : { kind: "failed", code: "request_failed" }
  }
  try {
    const body = await readCapped(response, input.maxAnswerBytes)
    if (body === null) {
      return { kind: "failed", code: "answer_too_large" }
    }
    const contentType = answerContentType(response.headers.get("content-type"))
    const ok = response.status >= 200 && response.status < 300
    // A success the shop cannot read (D2): no answer, the work maybe done
    if (ok && !readableAnswerType(contentType)) {
      return { kind: "failed", code: "answer_type" }
    }
    return { kind: "answered", status: response.status, contentType, body }
  } catch {
    return deadline.aborted
      ? { kind: "timeout", code: "timeout" }
      : { kind: "failed", code: "answer_cut" }
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** MiniMax's code in a 200 body (`base_resp.status_code`), or null. */
function bodyCodeOf(body: Buffer): number | null {
  if (body.length === 0 || body.length > 2 * 1024 * 1024) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(body.toString("utf8"))
    const base = isRecord(parsed) ? parsed["base_resp"] : undefined
    const code = isRecord(base) ? base["status_code"] : undefined
    return typeof code === "number" && Number.isSafeInteger(code) && code !== 0 ? code : null
  } catch {
    return null
  }
}

/** Statuses where the provider did no work (the shop's `notTakenByService`). */
const NOT_TAKEN_STATUSES: ReadonlySet<number> = new Set([401, 402, 403, 429])

/**
 * Whether the provider never took the call (adr/0085 §1, the shop's
 * `notTakenByService`): never connected; a refused key (401, 403), no
 * balance (402), busy or out of quota (429), down (5xx); a 200 whose body
 * code says one of these; the platform's own failure (a 404, its key refused
 * in a 400: provider-errors.ts). A timeout, a cut answer, a 408 or any other
 * 4xx may have been charged: the credits stay.
 */
export function notTaken(outcome: ForwardOutcome, target: GatewayTarget): boolean {
  if (outcome.kind === "not_connected") {
    return true
  }
  if (outcome.kind !== "answered") {
    return false
  }
  const { status } = outcome
  // The platform's own failure (a model gone, its key refused in a 400): not the shop's to pay
  if (NOT_TAKEN_STATUSES.has(status) || status >= 500 || platformFault(status, outcome.body)) {
    return true
  }
  if (status >= 200 && status < 300 && target.notTakenBodyCodes.length > 0) {
    const code = bodyCodeOf(outcome.body)
    return code !== null && target.notTakenBodyCodes.includes(code)
  }
  return false
}
