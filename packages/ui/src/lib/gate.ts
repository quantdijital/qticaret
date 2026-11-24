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
 * One action may pass two gates (a sign-in, then the verification code it
 * asks for): the form's own gate answers in `turnstile`, another in
 * `turnstile:<gate>` (and `turnstile_fallback:<gate>`).
 */

export interface GatedChallenge {
  token: string
  salt: string
  bits: number
  /** Asked in Turnstile's stead: answered in `turnstile_fallback`. */
  fallback?: boolean
  /** The gate it stands in for, when not the form's own. */
  action?: string
}

export interface GatedResult {
  ok: boolean
  error: string | null
  challenge?: GatedChallenge | null
  turnstile?: TurnstileAsk | null
  /**
   * Fields the action already acted on, for the send again: each named
   * field replaced by these values (none: taken out). A review's photos,
   * uploaded once, come back as their ids and the files stay home.
   */
  resume?: Record<string, string[]> | null
}

/** One gate's widget, as `useTurnstile` gives it; null without a site key. */
export interface GateHandle {
  /** Whether a send carries this gate's token from the start (every-send gates, or once one was asked). */
  eager: () => boolean
  /** A token for one send; null when there is no widget (no site key). */
  take: () => Promise<string | null>
  /** The token went with a send: reset, the next one prepared. */
  spent: () => void
}

/** A form's gates: its own first, then any other its action passes. */
export interface FormGates {
  own: string
  gates: Partial<Record<string, GateHandle | null>>
}

/** Where a gate's token goes in the form: the form's own in `turnstile`, another in `turnstile:<gate>`. */
export const tokenField = (gate: string, own: string) =>
  gate === own || gate === "" ? TURNSTILE_FIELD : `${TURNSTILE_FIELD}:${gate}`

/** Where a stand-in proof's answer goes, likewise. */
export const fallbackField = (gate: string | undefined, own: string) =>
  gate === undefined || gate === own || gate === ""
    ? TURNSTILE_FALLBACK_FIELD
    : `${TURNSTILE_FALLBACK_FIELD}:${gate}`

export const CHALLENGE_FAILED = "errors.challenge_failed"
export const TURNSTILE_FAILED = "errors.turnstile_failed"

// A proof of work may be asked again at a harder level; each gate's token is asked once more at most
const MAX_ROUNDS = 5

export interface GateHooks {
  /** A proof of work being solved (the button says "checking"). */
  checking?: (on: boolean) => void
}

export async function sendGated<R extends GatedResult>(
  send: (form: FormData) => Promise<R>,
  form: FormData,
  gates: FormGates | null,
  hooks: GateHooks = {}
): Promise<R> {
  const own = gates?.own ?? ""
  const handleOf = (gate: string) => gates?.gates[gate === "" ? own : gate] ?? null
  const carried = new Set<string>()
  const attach = async (gate: string): Promise<boolean> => {
    const token = await handleOf(gate)?.take()
    if (!token) {
      return false
    }
    form.set(tokenField(gate, own), token)
    carried.add(gate)
    return true
  }
  const once = async (): Promise<R> => {
    // Every gate that wants a token from the start (or was asked once) gets a fresh one
    for (const [gate, handle] of Object.entries(gates?.gates ?? {})) {
      if (handle?.eager() && !carried.has(gate)) {
        await attach(gate).catch(() => false)
      }
    }
    try {
      return await send(form)
    } finally {
      // Single use, each of them: a token or a stand-in proof is never sent twice
      for (const key of [...form.keys()]) {
        if (key === TURNSTILE_FALLBACK_FIELD || key.startsWith(`${TURNSTILE_FALLBACK_FIELD}:`)) {
          form.delete(key)
        }
      }
      for (const gate of carried) {
        form.delete(tokenField(gate, own))
        handleOf(gate)?.spent()
      }
      carried.clear()
    }
  }
  const refused = (result: R, error: string): R => ({
    ...result,
    ok: false,
    error,
    challenge: null,
    turnstile: null,
    resume: null,
  })

  let result = await once()
  const asked = new Set<string>()
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { challenge, turnstile, resume } = result
    for (const [field, values] of Object.entries(resume ?? {})) {
      form.delete(field)
      for (const value of values) {
        form.append(field, value)
      }
    }
    if (challenge) {
      hooks.checking?.(true)
      try {
        const nonce = await solveChallenge(challenge)
        form.set(
          challenge.fallback ? fallbackField(challenge.action, own) : "challenge",
          challengeAnswer(challenge.token, nonce)
        )
      } catch {
        return refused(result, CHALLENGE_FAILED)
      } finally {
        hooks.checking?.(false)
      }
    } else if (turnstile && !turnstile.failed && !asked.has(turnstile.action)) {
      asked.add(turnstile.action)
      try {
        // Taken now: the gate is armed, and `once` sends this token
        if (!(await attach(turnstile.action))) {
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
