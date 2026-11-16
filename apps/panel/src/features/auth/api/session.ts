import type { QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { i18next } from "@/lib/i18n"
import { USER_STALE_MS, currentUserQuery } from "./me"
import type { CurrentUser } from "./me"
import { STAFF_STALE_MS, staffQuery } from "./staff"
import type { StaffMe } from "./staff"

/** Why the user could not be read: signed out (401, 403), too many requests (429), or no answer. */
export type SessionFailure = "signedOut" | "rateLimited" | "unavailable"

/** A longer `Retry-After` is not waited for: the page says so and offers its own retry. */
export const RETRY_AFTER_LIMIT_SECONDS = 10
/** One toast however many guards meet the same 429. */
export const RATE_LIMITED_TOAST_ID = "session-rate-limited"
/**
 * How long past its due read what was read before still stands when the
 * API cannot answer: five minutes; after that, the "try again" page.
 */
export const KNOWN_GRACE_MS = 5 * 60_000

/** No user read (recently) and none to be had now: the route shows "could not load, try again". */
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

/** Whether what was read at `updatedAt` still stands: no older than its staleness and the grace. */
const withinGrace = (updatedAt: number, staleMs: number): boolean =>
  Date.now() - updatedAt <= staleMs + KNOWN_GRACE_MS

function recentUser(client: QueryClient): CurrentUser | undefined {
  const state = client.getQueryState(currentUserQuery().queryKey)
  return state?.data && withinGrace(state.dataUpdatedAt, USER_STALE_MS) ? state.data : undefined
}

function recentStaff(client: QueryClient): StaffMe | undefined {
  const state = client.getQueryState(staffQuery().queryKey)
  return state?.data && withinGrace(state.dataUpdatedAt, STAFF_STALE_MS) ? state.data : undefined
}

/** Where a sign-out found outside a navigation sends the browser (a seam for the tests). */
export const signInPage = {
  open: (href: string) => {
    window.location.assign(href)
  },
}

/** Signed out for the API: nothing read is kept, and the browser goes to sign-in. */
function signOutHere(client: QueryClient): void {
  client.clear()
  const back = `${window.location.pathname}${window.location.search}`
  signInPage.open(`/login?redirect=${encodeURIComponent(back)}`)
}

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
 * is none (401, 403), with everything read cleared. Too many requests or
 * no answer is not a sign-out:
 * - a user read in the last minutes stays, so the screen does not jump to
 *   sign-in; a 429 says so in a toast and one more read follows its
 *   `Retry-After` (a 401 then signs out here);
 * - with none read (or too long ago), a short `Retry-After` is waited for
 *   once, then `SessionUnavailableError` for the route's "try again" page.
 */
export async function loadCurrentUser(client: QueryClient): Promise<CurrentUser | null> {
  const first = await read(client)
  if ("user" in first) {
    return first.user
  }
  if (first.failure === "signedOut") {
    client.clear()
    return null
  }
  const known = recentUser(client)
  if (known) {
    if (first.failure === "rateLimited") {
      toast.error(i18next.t("session.rateLimited.toast"), { id: RATE_LIMITED_TOAST_ID })
      const { wait } = first
      if (wait !== null) {
        setTimeout(() => {
          void read(client).then((later) => {
            if ("failure" in later && later.failure === "signedOut") {
              signOutHere(client)
            }
          })
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
    client.clear()
    return null
  }
  throw new SessionUnavailableError(second.failure)
}

/**
 * The staff member's role and 2FA state for the guard; null when the API
 * says the session is gone (401, 403). No answer is never "no 2FA to ask":
 * the role read in the last minutes stands, or `SessionUnavailableError`
 * (fail closed; the API refuses an unpassed 2FA session anyway).
 */
export async function loadStaff(client: QueryClient): Promise<StaffMe | null> {
  try {
    return await client.query(staffQuery())
  } catch (error) {
    const failure = sessionFailure(error)
    if (failure === "signedOut") {
      client.clear()
      return null
    }
    const known = recentStaff(client)
    if (known) {
      return known
    }
    throw new SessionUnavailableError(failure)
  }
}
