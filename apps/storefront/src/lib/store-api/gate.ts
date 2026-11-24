import {
  TURNSTILE_FAILED,
  TURNSTILE_FALLBACK_HEADER,
  TURNSTILE_REQUIRED,
  TURNSTILE_TOKEN_HEADER,
  TURNSTILE_UNAVAILABLE,
} from "@qticaret/types"
import type { TurnstileAsk } from "@qticaret/types"
import type { GatedChallenge } from "@qticaret/ui"
import { isStoreApiError } from "./errors"

/**
 * The backend's bot checks as the storefront's actions pass them on
 * (adr/0044 §1 and Ek 2026-11-24). The theme's form puts what the browser
 * got in its fields; the action, on the storefront's server, sends them to
 * the backend as headers and hands back what the backend asked for:
 * - `challenge` → `X-Challenge` (the soft limit's proof of work);
 * - `turnstile` → `X-Turnstile-Token` (Cloudflare's widget token);
 * - `turnstile_fallback` → `X-Turnstile-Fallback` (the proof answered in
 *   Turnstile's stead while Cloudflare cannot answer).
 * Nothing is kept; a field that is not of its shape is not sent.
 */

// `<token>.<nonce>`: the backend's signed challenge and the browser's number
const ANSWER = /^[\w.-]{1,300}$/
// Cloudflare's token: at most 2048 characters (its own bound), printable, no spaces
const TOKEN = /^[\x21-\x7e]{1,2048}$/

const FIELDS = [
  ["challenge", "x-challenge", ANSWER],
  ["turnstile", TURNSTILE_TOKEN_HEADER, TOKEN],
  ["turnstile_fallback", TURNSTILE_FALLBACK_HEADER, ANSWER],
] as const

/** The form's answers as the backend's headers; empty when it carries none. */
export function gateHeaders(form: FormData): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const [field, header, shape] of FIELDS) {
    const value = form.get(field)
    if (typeof value === "string" && shape.test(value)) {
      headers[header] = value
    }
  }
  return headers
}

/** `{ headers }` for a Store API call when the form answered something; nothing otherwise. */
export function gated(form: FormData): { headers?: Record<string, string> } {
  const headers = gateHeaders(form)
  return Object.keys(headers).length > 0 ? { headers } : {}
}

/** A 428's proof of work (adr/0044 §1), marked when it stands in for Turnstile; null otherwise. */
export function challengeOf(error: unknown): GatedChallenge | null {
  if (!isStoreApiError(error) || error.status !== 428) {
    return null
  }
  const body = error.body as { challenge?: Partial<GatedChallenge>; fallback?: unknown } | null
  const challenge = body?.challenge
  if (
    typeof challenge?.token !== "string" ||
    typeof challenge.salt !== "string" ||
    typeof challenge.bits !== "number"
  ) {
    return null
  }
  return {
    token: challenge.token,
    salt: challenge.salt,
    bits: challenge.bits,
    ...(body?.fallback === TURNSTILE_UNAVAILABLE ? { fallback: true } : {}),
  }
}

/** Turnstile wanted (428) or its token refused (403), for the form; null for any other failure. */
export function turnstileOf(error: unknown): TurnstileAsk | null {
  if (!isStoreApiError(error)) {
    return null
  }
  const wanted = error.status === 428 && error.messageKey === TURNSTILE_REQUIRED
  const refused = error.status === 403 && error.messageKey === TURNSTILE_FAILED
  if (!wanted && !refused) {
    return null
  }
  const action = (error.body as { turnstile?: { action?: unknown } } | null)?.turnstile?.action
  return { action: typeof action === "string" ? action : "", failed: refused }
}

export interface GateAsk {
  ok: false
  error: null
  challenge: GatedChallenge | null
  turnstile?: TurnstileAsk
}

/** What the form must do before the backend takes the send; null when the failure is another. */
export function gateAsk(error: unknown): GateAsk | null {
  const challenge = challengeOf(error)
  if (challenge) {
    return { ok: false, error: null, challenge }
  }
  const turnstile = turnstileOf(error)
  return turnstile ? { ok: false, error: null, challenge: null, turnstile } : null
}
