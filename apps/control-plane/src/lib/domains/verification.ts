import { randomBytes } from "node:crypto"
import { isIP } from "node:net"
import type { DomainCheckError, DomainVerification } from "../tenants/kinds"

/**
 * A custom domain's proof (F16.7, adr/0061 §2): the shop publishes a TXT
 * record `_qticaret-verify.<host>` holding `qticaret-verify=<token>`; the
 * control plane only asks DNS for it (no connection to the host itself).
 * Once proved the domain is `verified`; once it also points at the
 * platform's edge (`CP_DOMAIN_CNAME_TARGET`, `CP_DOMAIN_A_TARGETS`) it is
 * `active`. TLS for it is the server's (F16), not decided here.
 */

export const TXT_PREFIX = "_qticaret-verify"
export const TXT_VALUE_PREFIX = "qticaret-verify="

/** 32 hex characters: unguessable, so no one else's record can prove it. */
export const newVerificationToken = (): string => randomBytes(16).toString("hex")

export const txtNameOf = (hostname: string): string => `${TXT_PREFIX}.${hostname}`
export const txtValueOf = (token: string): string => `${TXT_VALUE_PREFIX}${token}`

/** Where a domain is to point: a host for a CNAME, addresses for an apex's A/AAAA. */
export interface RoutingTarget {
  cname: string | null
  addresses: string[]
}

const HOST = /^(?=.{1,253}$)(?:(?!-)[a-z0-9-]{1,63}(?<!-)\.)+[a-z][a-z0-9-]*$/

/** `CP_DOMAIN_CNAME_TARGET` and `CP_DOMAIN_A_TARGETS` read; throws on a malformed value. */
export function parseRoutingTarget(cname?: string, addresses?: string): RoutingTarget {
  const trimmed = cname?.trim().toLowerCase().replace(/\.$/, "") ?? ""
  const host = trimmed === "" ? null : trimmed
  if (host !== null && !HOST.test(host)) {
    throw new Error("must be a host name")
  }
  const list = (addresses ?? "")
    .split(",")
    .map((each) => each.trim().toLowerCase())
    .filter(Boolean)
  if (list.some((each) => isIP(each) === 0) || list.length > 16) {
    throw new Error("must list IP addresses")
  }
  return { cname: host, addresses: list }
}

/** Whether a host is a zone's apex (two labels; a CNAME is not allowed there). */
export const isApex = (hostname: string): boolean => hostname.split(".").length === 2

/** The records the panel shows the shop's owner: the proof, then where to point. */
export interface DnsInstructions {
  txt: { name: string; value: string }
  routing: { type: "CNAME" | "A"; name: string; values: string[] } | null
}

export function dnsInstructions(
  hostname: string,
  token: string,
  target: RoutingTarget
): DnsInstructions {
  const txt = { name: txtNameOf(hostname), value: txtValueOf(token) }
  // A subdomain points by CNAME; an apex by A records (or its DNS host's CNAME flattening)
  if (target.cname && !(isApex(hostname) && target.addresses.length > 0)) {
    return { txt, routing: { type: "CNAME", name: hostname, values: [target.cname] } }
  }
  if (target.addresses.length > 0) {
    return { txt, routing: { type: "A", name: hostname, values: target.addresses } }
  }
  return { txt, routing: null }
}

/** What DNS said: the proof, and where the host points. */
export type TxtFinding = "match" | "mismatch" | "missing" | "unavailable"
export type RoutingFinding = "match" | "mismatch" | "missing" | "unknown" | "unavailable"

export interface DnsFinding {
  txt: TxtFinding
  routing: RoutingFinding
}

/** A domain's check state as the row holds it. */
export interface CheckState {
  verification: DomainVerification
  verification_error: DomainCheckError | null
  verified_at: Date | null
  check_attempts: number
  created_at: Date
}

export interface CheckOutcome {
  verification: DomainVerification
  verification_error: DomainCheckError | null
  verified_at: Date | null
  last_checked_at: Date
  next_check_at: Date | null
  check_attempts: number
}

const MINUTE = 60_000
/** A pending domain is proved within a week or given up (a manual check can still prove it). */
export const PENDING_MAX_AGE_MS = 7 * 24 * 60 * MINUTE
/** A pending domain's checks: 1, 2, 4… minutes apart, at most an hour. */
export const PENDING_MAX_GAP_MS = 60 * MINUTE
/** A proved domain is checked again once a day: its routing, and that the proof is still there. */
export const PROVED_GAP_MS = 24 * 60 * MINUTE

export function pendingGap(attempts: number): number {
  return Math.min(2 ** Math.min(Math.max(attempts - 1, 0), 16) * MINUTE, PENDING_MAX_GAP_MS)
}

const txtError: Record<Exclude<TxtFinding, "match">, DomainCheckError> = {
  missing: "txt_missing",
  mismatch: "txt_mismatch",
  unavailable: "dns_unavailable",
}

function routingError(routing: RoutingFinding): DomainCheckError | null {
  if (routing === "missing") {
    return "routing_missing"
  }
  return routing === "mismatch" ? "routing_mismatch" : null
}

/**
 * The domain's next state after a check (pure; the rules F16.7 sets):
 * - the proof found: `active` when it points at the platform, else `verified`
 *   (with why it is not active, when the target is known);
 * - a proved domain whose proof is gone stays proved, warned (`txt_lost`):
 *   taking a live storefront's address away is not the check's to do;
 * - DNS not answering changes no state, only the reason;
 * - a pending domain unproved past its week is `failed` (`expired`); the
 *   job stops, a manual check (`manual`) may still prove it.
 */
export function nextCheckState(
  state: CheckState,
  finding: DnsFinding,
  now: Date,
  options: { manual?: boolean } = {}
): CheckOutcome {
  const attempts = state.check_attempts + 1
  const base = { last_checked_at: now, check_attempts: attempts }
  const proved = state.verification === "verified" || state.verification === "active"
  if (finding.txt === "match") {
    // DNS not answering for the routing keeps what was known
    const routing =
      finding.routing === "unavailable"
        ? state.verification === "active"
          ? "match"
          : "unknown"
        : finding.routing
    return {
      ...base,
      verification: routing === "match" ? "active" : "verified",
      verification_error: routingError(routing),
      verified_at: state.verified_at ?? now,
      next_check_at: new Date(now.getTime() + PROVED_GAP_MS),
    }
  }
  if (proved) {
    return {
      ...base,
      verification: state.verification,
      verification_error: finding.txt === "unavailable" ? "dns_unavailable" : "txt_lost",
      verified_at: state.verified_at,
      next_check_at: new Date(now.getTime() + PROVED_GAP_MS),
    }
  }
  const error = txtError[finding.txt]
  const expired = now.getTime() - new Date(state.created_at).getTime() >= PENDING_MAX_AGE_MS
  if (state.verification === "failed" || (expired && !options.manual)) {
    return {
      ...base,
      verification: "failed",
      verification_error: state.verification === "failed" ? error : "expired",
      verified_at: null,
      next_check_at: null,
    }
  }
  return {
    ...base,
    verification: "pending",
    verification_error: error,
    verified_at: null,
    next_check_at: new Date(now.getTime() + pendingGap(attempts)),
  }
}
