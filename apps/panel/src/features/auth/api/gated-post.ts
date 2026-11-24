import {
  TURNSTILE_FAILED,
  TURNSTILE_FALLBACK_HEADER,
  TURNSTILE_REQUIRED,
  TURNSTILE_TOKEN_HEADER,
  TURNSTILE_UNAVAILABLE,
} from "@qticaret/types"
import { challengeHeader, solveChallenge } from "@/lib/challenge"
import type { Challenge } from "@/lib/challenge"

/** The sign-in page's Turnstile widget (`useStaffTurnstile`); null without a site key. */
export interface StaffGate {
  /** A token for one request; null when there is none to be had. */
  take: () => Promise<string | null>
  /** The token went with a request: reset, the next one prepared. */
  spent: () => void
}

export interface GatedAnswer<T> {
  status: number
  body: T & {
    message?: string
    /** The backend's key; a sign-in route answers the panel with its sentence in `message` (adr/0021). */
    code?: string
    challenge?: Challenge
    fallback?: string
  }
}

// A proof of work may be asked again at a harder level, after Turnstile's stand-in too
const MAX_ROUNDS = 4

async function post<T>(
  path: string,
  body: unknown,
  headers: Record<string, string>
): Promise<GatedAnswer<T>> {
  const response = await fetch(new URL(path, window.location.origin), {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", accept: "application/json", ...headers },
    body: JSON.stringify(body),
  })
  const answer = (await response.json().catch(() => ({}))) as GatedAnswer<T>["body"]
  return { status: response.status, body: answer }
}

/** A failure that is Turnstile's: the token refused (403), or none to be had after asking (428). */
export function isTurnstileRefusal(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  return code === TURNSTILE_FAILED || code === TURNSTILE_REQUIRED
}

/** The answer's key: `code` from a session client's sentence, else `message`. */
export const answerKey = (body: { message?: unknown; code?: unknown }): string | null =>
  typeof body.code === "string" ? body.code : typeof body.message === "string" ? body.message : null

/**
 * A sign-in page's request behind the backend's bot checks (adr/0044 §1
 * and Ek 2026-11-24), its answer's body kept (the SDK keeps only the
 * message): Turnstile's token with the first request; asked again (428
 * `fraud.turnstile_required`), one more token; a proof of work solved in
 * the browser and sent in `X-Challenge`, or in `X-Turnstile-Fallback`
 * when it stands in for Turnstile. A 403 `fraud.turnstile_failed` is
 * handed back: the page says so and the next try takes a fresh token.
 */
export async function postGated<T>(
  path: string,
  body: unknown,
  gate: StaffGate | null
): Promise<GatedAnswer<T>> {
  const headers: Record<string, string> = {}
  let carried = false
  const attach = async (): Promise<boolean> => {
    const token = await gate?.take().catch(() => null)
    if (!token) {
      return false
    }
    headers[TURNSTILE_TOKEN_HEADER] = token
    carried = true
    return true
  }
  const once = async (): Promise<GatedAnswer<T>> => {
    try {
      return await post<T>(path, body, headers)
    } finally {
      // Single use, each of them
      delete headers[TURNSTILE_FALLBACK_HEADER]
      delete headers[TURNSTILE_TOKEN_HEADER]
      if (carried) {
        carried = false
        gate?.spent()
      }
    }
  }

  await attach()
  let answer = await once()
  let asked = false
  for (let round = 0; round < MAX_ROUNDS && answer.status === 428; round++) {
    const challenge = answer.body.challenge
    if (challenge) {
      const nonce = await solveChallenge(challenge)
      const [, value] = Object.entries(challengeHeader(challenge.token, nonce))[0] ?? []
      if (value === undefined) {
        break
      }
      headers[
        answer.body.fallback === TURNSTILE_UNAVAILABLE ? TURNSTILE_FALLBACK_HEADER : "x-challenge"
      ] = value
    } else if (answerKey(answer.body) === TURNSTILE_REQUIRED && !asked) {
      asked = true
      if (!(await attach())) {
        break
      }
    } else {
      break
    }
    answer = await once()
  }
  return answer
}
