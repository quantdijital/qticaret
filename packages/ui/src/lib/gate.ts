import type { TurnstileAsk } from "@qticaret/types"
import { challengeAnswer, solveChallenge } from "./challenge"
import { TURNSTILE_FALLBACK_FIELD, TURNSTILE_FIELD } from "./turnstile"

/**
 * A form's send past the backend's bot checks (adr/0044 §1 and Ek
 * 2026-11-24), the same for every theme's form:
 * - a gate that wants Turnstile on every send gets the token with the
 *   first send (`eager`); a gate that wants it past a limit, after its 428;
 * - 428 `fraud.turnstile_required`: a token, and the send once more;
 * - 403 `fraud.turnstile_failed`: the widget reset, the shopper told; the
 *   next send takes a fresh token;
 * - 428 proof of work: solved here and sent again, in `challenge` (the
 *   soft limit's) or in `turnstile_fallback` (Turnstile's stand-in while
 *   Cloudflare cannot answer); both may be asked of one send.
 */

export interface GatedChallenge {
  token: string
  salt: string
  bits: number
  /** Asked in Turnstile's stead: answered in `turnstile_fallback`. */
  fallback?: boolean
}

export interface GatedResult {
  ok: boolean
  error: string | null
  challenge?: GatedChallenge | null
  turnstile?: TurnstileAsk | null
}

/** A form's Turnstile widget, as `useTurnstile` gives it; null without a site key. */
export interface GateHandle {
  /** Whether this send carries a token from the start (every-send gates, or once one was asked). */
  eager: () => boolean
  /** A token for one send; null when there is no widget (no site key). */
  take: () => Promise<string | null>
  /** The token went with a send: reset, the next one prepared. */
  spent: () => void
}

export const CHALLENGE_FAILED = "errors.challenge_failed"
export const TURNSTILE_FAILED = "errors.turnstile_failed"

// A proof of work may be asked again at a harder level; Turnstile is asked once more at most
const MAX_ROUNDS = 4

export interface GateHooks {
  /** A proof of work being solved (the button says "checking"). */
  checking?: (on: boolean) => void
}

export async function sendGated<R extends GatedResult>(
  send: (form: FormData) => Promise<R>,
  form: FormData,
  gate: GateHandle | null,
  hooks: GateHooks = {}
): Promise<R> {
  let carried = false
  const attach = async (): Promise<boolean> => {
    const token = await gate?.take()
    if (!token) {
      return false
    }
    form.set(TURNSTILE_FIELD, token)
    carried = true
    return true
  }
  const once = async (): Promise<R> => {
    try {
      return await send(form)
    } finally {
      // Single use, as the token: a stand-in proof is never sent twice
      form.delete(TURNSTILE_FALLBACK_FIELD)
      if (carried) {
        carried = false
        form.delete(TURNSTILE_FIELD)
        gate?.spent()
      }
    }
  }
  const refused = (result: R, error: string): R => ({
    ...result,
    ok: false,
    error,
    challenge: null,
    turnstile: null,
  })

  if (gate?.eager()) {
    try {
      await attach()
    } catch {
      // No token to be had (the script blocked, the widget failed): the backend says what it wants
    }
  }
  let result = await once()
  let asked = false
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { challenge, turnstile } = result
    if (challenge) {
      hooks.checking?.(true)
      try {
        const nonce = await solveChallenge(challenge)
        form.set(
          challenge.fallback ? TURNSTILE_FALLBACK_FIELD : "challenge",
          challengeAnswer(challenge.token, nonce)
        )
      } catch {
        return refused(result, CHALLENGE_FAILED)
      } finally {
        hooks.checking?.(false)
      }
    } else if (turnstile && !turnstile.failed && !asked) {
      asked = true
      try {
        if (!(await attach())) {
          return refused(result, TURNSTILE_FAILED)
        }
      } catch {
        return refused(result, TURNSTILE_FAILED)
      }
    } else {
      break
    }
    result = await once()
  }
  if (result.challenge) {
    return refused(result, CHALLENGE_FAILED)
  }
  if (result.turnstile) {
    return refused(result, TURNSTILE_FAILED)
  }
  return result
}
