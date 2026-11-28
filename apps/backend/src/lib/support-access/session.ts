import { SUPPORT_ACTOR_PREFIX } from "@qticaret/types/control-plane"
import type { SupportGrantDocument } from "@qticaret/types/control-plane"
import type { SupportEndReason, SupportSession } from "./store"

/**
 * A support session's identity (adr/0061 Ek "Destek erişimi", Karar 1): a
 * synthetic actor, `qtsup_` and the grant's random part, with no user row,
 * login, password or 2FA in the shop. Pure helpers for the guard, the
 * routes and the workflows.
 */

const GRANT_PREFIX = "sgr_"

export const isSupportActor = (actorId: unknown): boolean =>
  typeof actorId === "string" && actorId.startsWith(SUPPORT_ACTOR_PREFIX)

export const supportActorOf = (grantId: string): string =>
  `${SUPPORT_ACTOR_PREFIX}${grantId.slice(GRANT_PREFIX.length)}`

export const grantIdOfActor = (actorId: string): string =>
  `${GRANT_PREFIX}${actorId.slice(SUPPORT_ACTOR_PREFIX.length)}`

/** The record a redeemed grant opens. */
export function sessionOfGrant(grant: SupportGrantDocument, now: Date): SupportSession {
  return {
    grant_id: grant.grant_id,
    actor_id: supportActorOf(grant.grant_id),
    operator: { ...grant.operator },
    reason: grant.reason,
    started_at: now.toISOString(),
    expires_at: new Date(grant.expires_at * 1000).toISOString(),
  }
}

/** Open, or why it is not: ended before its time, past it, or the owner's switch off. */
export function sessionState(
  session: SupportSession | null,
  options: { now: number; enabled: boolean }
): "open" | SupportEndReason | "missing" {
  if (session === null) {
    return "missing"
  }
  if (session.ended_reason) {
    return session.ended_reason
  }
  if (options.now >= Date.parse(session.expires_at)) {
    return "expired"
  }
  return options.enabled ? "open" : "disabled"
}

/** How the panel names the session's user (`GET /admin/users/me`). */
export function supportUser(session: SupportSession) {
  return {
    id: session.actor_id,
    email: "",
    first_name: "Platform desteği",
    last_name: session.operator.name,
    avatar_url: null,
    metadata: null,
    created_at: session.started_at,
    updated_at: session.started_at,
    deleted_at: null,
  }
}

/** What `GET /admin/staff/me` tells the panel of the session (its strip). */
export function supportView(session: SupportSession) {
  return {
    operator_name: session.operator.name,
    reason: session.reason,
    started_at: session.started_at,
    expires_at: session.expires_at,
  }
}
