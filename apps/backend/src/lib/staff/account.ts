import { randomBytes } from "node:crypto"
import { decryptPii, encryptPii } from "@qticaret/server-kit"
import { panelUrl } from "../env"

/**
 * A staff member's own account (the owner, 2026-11-06): their job title,
 * kept in the user's metadata (Medusa's user has no field for it), and the
 * link that moves their login to a new address.
 */

/** The user metadata key of the job title ("Unvan"). */
export const JOB_TITLE_KEY = "job_title"
export const MAX_JOB_TITLE = 80

/** The job title in a user's metadata, or null. */
export function jobTitleOf(metadata: Record<string, unknown> | null | undefined): string | null {
  const value = metadata?.[JOB_TITLE_KEY]
  return typeof value === "string" && value.trim() !== "" ? value : null
}

/**
 * The metadata with the job title set, everything else kept. A title taken
 * off is written as null: whether Medusa merges metadata or replaces it,
 * the old one is gone.
 */
export function withJobTitle(
  metadata: Record<string, unknown> | null | undefined,
  title: string | null
): Record<string, unknown> {
  return { ...(metadata ?? {}), [JOB_TITLE_KEY]: title }
}

/** How long a new address's confirmation link holds, as an invitation's. */
export const EMAIL_CHANGE_TTL_MS = 24 * 60 * 60 * 1000

/** What an address change's link carries, sealed: nobody reads or changes it. */
export interface EmailChangeClaim {
  user_id: string
  /** The login address when it was asked: once it changes, the link is spent. */
  from: string
  to: string
  /** Milliseconds since the epoch. */
  expires_at: number
  /** Once used, used up (shared counters, adr/0040's code-once pattern). */
  nonce: string
}

// Bound as associated data: a sealed value of another kind does not open as this
const CONTEXT = "staff.email_change"

const isClaim = (value: unknown): value is EmailChangeClaim => {
  const claim = value as Partial<EmailChangeClaim> | null
  return (
    typeof claim?.user_id === "string" &&
    typeof claim.from === "string" &&
    typeof claim.to === "string" &&
    typeof claim.expires_at === "number" &&
    typeof claim.nonce === "string"
  )
}

/** A new change's claim: who, from where to where, until when, and its one-time nonce. */
export function newEmailChange(
  input: { user_id: string; from: string; to: string },
  now: number = Date.now()
): EmailChangeClaim {
  return {
    ...input,
    expires_at: now + EMAIL_CHANGE_TTL_MS,
    nonce: randomBytes(16).toString("hex"),
  }
}

/** The link's token: the claim sealed (AES-256-GCM), URL-safe. */
export function sealEmailChange(claim: EmailChangeClaim, key: Buffer): string {
  const sealed = encryptPii(JSON.stringify(claim), key, CONTEXT)
  return Buffer.from(sealed, "base64").toString("base64url")
}

/** The waiting change as stored (the latest ask), or null when it is not one. */
export function parseEmailChange(stored: string | null): EmailChangeClaim | null {
  if (!stored) {
    return null
  }
  try {
    const claim: unknown = JSON.parse(stored)
    return isClaim(claim) ? claim : null
  } catch {
    return null
  }
}

/** The claim of a token that opens and has not run out; null for any other. */
export function openEmailChange(
  token: string,
  key: Buffer,
  now: number = Date.now()
): EmailChangeClaim | null {
  try {
    const sealed = Buffer.from(token, "base64url").toString("base64")
    const claim: unknown = JSON.parse(decryptPii(sealed, key, CONTEXT))
    return isClaim(claim) && claim.expires_at > now ? claim : null
  } catch {
    return null
  }
}

/**
 * The panel's page that confirms the new address. The token after `#`, as
 * an invitation's: no access log or Referer sees it.
 */
export const emailChangeLink = (token: string, base: string = panelUrl()): string =>
  `${base}/confirm-email#${new URLSearchParams({ token }).toString()}`

// A key of this process alone: what it seals opens nowhere else and at no later start
const PROCESS_KEY = randomBytes(32)
// Long enough for the request that seals it, nothing more
const REQUEST_BLOB_MS = 2 * 60 * 1000

/**
 * A secret as a workflow carries it (security review 2026-11-06; docs/04:
 * workflows carry only sealed blobs): sealed under this process's own key,
 * bound to its purpose and user, good for the request that sealed it.
 */
export function sealForRequest(
  value: string,
  binding: string,
  now: number = Date.now(),
  key: Buffer = PROCESS_KEY
): string {
  return encryptPii(JSON.stringify({ v: value, x: now + REQUEST_BLOB_MS }), key, binding)
}

/** What `sealForRequest` sealed, for the same binding while it holds; otherwise it throws. */
export function openForRequest(
  blob: string,
  binding: string,
  now: number = Date.now(),
  key: Buffer = PROCESS_KEY
): string {
  const opened = JSON.parse(decryptPii(blob, key, binding)) as { v?: unknown; x?: unknown }
  if (typeof opened.v !== "string" || typeof opened.x !== "number" || opened.x <= now) {
    throw new Error("staff.sealed_value_expired")
  }
  return opened.v
}
