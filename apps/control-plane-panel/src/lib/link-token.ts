/**
 * A link's token (an invitation, an enrolment after a 2FA reset) comes
 * after `#` (apps/control-plane src/lib/mail/invite.ts): no server's access
 * log and no other site's Referer sees it. The page reads it once and takes
 * it out of the address bar, so it is not left in the history or a
 * bookmark; it is kept in memory only, for as long as this page needs it.
 */

// base64url, and the dots of an invitation's signed token
const TOKEN = /^[A-Za-z0-9_.-]{16,4096}$/

/** The token in a hash (`#token=…`), or null when there is none or it is malformed. */
export function tokenOfHash(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, "")).get("token")
  return token !== null && TOKEN.test(token) ? token : null
}

// The last token taken, by page: a second read on the same page (React's
// development double render) finds the address bar already cleared
let taken: { path: string; token: string | null } | null = null

/** Reads the address bar's token and removes it from there (the path stays). */
export function takeLinkToken(): string | null {
  const path = window.location.pathname
  if (window.location.hash === "") {
    return taken?.path === path ? taken.token : null
  }
  const token = tokenOfHash(window.location.hash)
  taken = { path, token }
  window.history.replaceState(window.history.state, "", `${path}${window.location.search}`)
  return token
}

// The enrolment link's token, between its page and the setup (a sign-in may come between)
let enrolmentToken: string | null = null

export function holdEnrolmentToken(token: string | null): void {
  enrolmentToken = token
}

export const heldEnrolmentToken = (): string | null => enrolmentToken
