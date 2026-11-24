import {
  TURNSTILE_FAILED,
  TURNSTILE_FALLBACK_HEADER,
  TURNSTILE_REQUIRED,
  TURNSTILE_TOKEN_HEADER,
  TURNSTILE_UNAVAILABLE,
} from "@qticaret/types/turnstile"
import type { TurnstileAsk, TurnstileGate } from "@qticaret/types"
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
// Cloudflare's token as the backend takes it: `[A-Za-z0-9._-]`, at most 2048 (its own bound)
const TOKEN = /^[\w.-]{1,2048}$/

// The form's own gate: its answers in the plain fields
const OWN_FIELDS = [
  ["challenge", "x-challenge", ANSWER],
  ["turnstile", TURNSTILE_TOKEN_HEADER, TOKEN],
  ["turnstile_fallback", TURNSTILE_FALLBACK_HEADER, ANSWER],
] as const

// Another gate the same action passes (a sign-in's verification code): `turnstile:<gate>`
const otherFields = (gate: string) =>
  [
    [`turnstile:${gate}`, TURNSTILE_TOKEN_HEADER, TOKEN],
    [`turnstile_fallback:${gate}`, TURNSTILE_FALLBACK_HEADER, ANSWER],
  ] as const

/**
 * The form's answers as the backend's headers; empty when it carries none.
 * `other`: a second gate's call in the same action (its own token, no proof
 * of the form's soft limit).
 */
export function gateHeaders(form: FormData, other?: TurnstileGate): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const [field, header, shape] of other ? otherFields(other) : OWN_FIELDS) {
    const value = form.get(field)
    if (typeof value === "string" && shape.test(value)) {
      headers[header] = value
    }
  }
  return headers
}

/** `{ headers }` for a Store API call when the form answered something; nothing otherwise. */
export function gated(form: FormData, other?: TurnstileGate): { headers?: Record<string, string> } {
  const headers = gateHeaders(form, other)
  return Object.keys(headers).length > 0 ? { headers } : {}
}

const GATE_OF = Symbol("gate")

/**
 * A second gate's call: a failure it throws is marked with the gate, so a
 * stand-in proof it asks for is answered in that gate's field.
 */
export async function underGate<T>(gate: TurnstileGate, call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (error) {
    if (isStoreApiError(error)) {
      Object.defineProperty(error, GATE_OF, { value: gate })
    }
    throw error
  }
}

const gateOfError = (error: unknown): string | undefined => {
  const gate = (error as { [GATE_OF]?: unknown } | null)?.[GATE_OF]
  return typeof gate === "string" ? gate : undefined
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
  const gate = gateOfError(error)
  return {
    token: challenge.token,
    salt: challenge.salt,
    bits: challenge.bits,
    ...(body?.fallback === TURNSTILE_UNAVAILABLE
      ? { fallback: true, ...(gate ? { action: gate } : {}) }
      : {}),
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
