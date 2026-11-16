import type { QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { i18next } from "@/lib/i18n"
import { CURRENT_USER_KEY, currentUserQuery } from "./me"
import type { CurrentUser } from "./me"

/** Why the user could not be read: signed out (401, 403), too many requests (429), or no answer. */
export type SessionFailure = "signedOut" | "rateLimited" | "unavailable"

/** A longer `Retry-After` is not waited for: the page says so and offers its own retry. */
export const RETRY_AFTER_LIMIT_SECONDS = 10
/** One toast however many guards meet the same 429. */
export const RATE_LIMITED_TOAST_ID = "session-rate-limited"

/** No user read yet and none to be had now: the route shows "could not load, try again". */
export class SessionUnavailableError extends Error {
  constructor(readonly reason: Exclude<SessionFailure, "signedOut">) {
    super(`session.${reason}`)
    this.name = "SessionUnavailableError"
  }
}

export function sessionFailure(error: unknown): SessionFailure {
  const status = (error as { status?: unknown } | null)?.status
  if (status === 401 || status === 403) {
    return "signedOut"
  }
  return status === 429 ? "rateLimited" : "unavailable"
}

/** A 429's wait in milliseconds, when it is short enough to wait for once. */
function retryWait(error: unknown): number | null {
  const seconds = (error as { retry_after?: unknown } | null)?.retry_after
  return typeof seconds === "number" && seconds >= 0 && seconds <= RETRY_AFTER_LIMIT_SECONDS
    ? seconds * 1000
    : null
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

type Read = { user: CurrentUser } | { failure: SessionFailure; wait: number | null }

async function read(client: QueryClient): Promise<Read> {
  try {
    return { user: await client.query(currentUserQuery()) }
  } catch (error) {
    const failure = sessionFailure(error)
    return { failure, wait: failure === "rateLimited" ? retryWait(error) : null }
  }
}

/**
 * The signed-in user for a route's guard; null only when the API says there
 * is none (401, 403). Too many requests or no answer is not a sign-out:
 * - a user already read stays, so the screen does not jump to sign-in; a
 *   429 says so in a toast and one more read follows its `Retry-After`;
 * - with no user read yet, a short `Retry-After` is waited for once, then
 *   `SessionUnavailableError` for the route's "try again" page.
 */
export async function loadCurrentUser(client: QueryClient): Promise<CurrentUser | null> {
  const first = await read(client)
  if ("user" in first) {
    return first.user
  }
  if (first.failure === "signedOut") {
    return null
  }
  const known = client.getQueryData<CurrentUser>(CURRENT_USER_KEY)
  if (known) {
    if (first.failure === "rateLimited") {
      toast.error(i18next.t("session.rateLimited.toast"), { id: RATE_LIMITED_TOAST_ID })
      const { wait } = first
      if (wait !== null) {
        setTimeout(() => {
          void client.query(currentUserQuery()).catch(() => undefined)
        }, wait)
      }
    }
    return known
  }
  if (first.wait === null) {
    throw new SessionUnavailableError(first.failure)
  }
  await sleep(first.wait)
  const second = await read(client)
  if ("user" in second) {
    return second.user
  }
  if (second.failure === "signedOut") {
    return null
  }
  throw new SessionUnavailableError(second.failure)
}
