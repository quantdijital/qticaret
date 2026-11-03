import type { ExclusionReason, SkipCounts } from "./types"
import { noSkips } from "./types"

/**
 * Who a campaign leaves out (adr/0050 §3), decided by the recipient's
 * keyed hash alone: on the suppression list; no consent on the channel;
 * a consent İYS has not been told of yet; another bulk message within 24
 * hours. A person found twice (a customer who also subscribed) counts once.
 */

/** What the records say of one recipient on the campaign's channel. */
export interface RecipientFacts {
  suppressed: boolean
  consent: { status: "granted" | "revoked"; iys_status: string } | null
  /** Another campaign reached the address in the last 24 hours. */
  reachedLately: boolean
}

/** İYS has the consent (sent), or it came from İYS itself (not_required). */
const IYS_KNOWS = new Set(["sent", "not_required"])

/** Why the recipient gets nothing, or null when they get the campaign. */
export function exclusionOf(facts: RecipientFacts, frequencyCap: boolean): ExclusionReason | null {
  if (facts.suppressed) {
    return "suppressed"
  }
  if (facts.consent?.status !== "granted") {
    return "no_consent"
  }
  if (!IYS_KNOWS.has(facts.consent.iys_status)) {
    return "iys_pending"
  }
  if (frequencyCap && facts.reachedLately) {
    return "recent"
  }
  return null
}

/** A person the sources name: by hash, with the record their address is read from. */
export interface Candidate {
  hash: string
  source: "customer" | "consent"
  source_id: string
  customer_id: string | null
}

export interface Sorted {
  /** Everyone named, once each. */
  audience: number
  eligible: Candidate[]
  excluded: SkipCounts
}

/**
 * The audience sorted: each hash once (a customer record before a bare
 * consent, so the message can greet them by name), then each judged.
 * `invalid` counts those named without a usable address.
 */
export function sortAudience(
  candidates: Iterable<Candidate>,
  invalid: number,
  factsOf: (hash: string) => RecipientFacts,
  frequencyCap: boolean
): Sorted {
  const byHash = new Map<string, Candidate>()
  for (const candidate of candidates) {
    const known = byHash.get(candidate.hash)
    if (!known || (known.source === "consent" && candidate.source === "customer")) {
      byHash.set(candidate.hash, candidate)
    }
  }
  const excluded = noSkips()
  excluded.invalid_recipient = invalid
  const eligible: Candidate[] = []
  for (const candidate of byHash.values()) {
    const reason = exclusionOf(factsOf(candidate.hash), frequencyCap)
    if (reason) {
      excluded[reason] += 1
    } else {
      eligible.push(candidate)
    }
  }
  return { audience: byHash.size + invalid, eligible, excluded }
}
