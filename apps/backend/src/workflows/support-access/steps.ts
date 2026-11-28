import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ConflictError } from "../../lib/errors"
import { errorSummary, logger } from "../../lib/logging"
import { notificationText } from "../../lib/notifications/messages"
import { supportStore } from "../../lib/support-access/store"
import type { SupportEndReason, SupportSession } from "../../lib/support-access/store"
import { AUDIT_LOG_MODULE } from "../../modules/audit-log"
import type AuditLogModuleService from "../../modules/audit-log/service"
import { STAFF_ROLES_MODULE } from "../../modules/staff-roles"
import type StaffRolesModuleService from "../../modules/staff-roles/service"
import { sendMessageWorkflow } from "../messaging/send-message"

/**
 * The steps of a support session (adr/0061 Ek "Destek erişimi", Karar
 * 3–6). Each part is a plain function for its tests.
 */

type Container = Pick<MedusaContainer, "resolve">

export const SUPPORT_RESOURCE = "support_session"

/** Who and where, for the shop's audit entries of a session. */
export interface RequestFacts {
  request_id: string | null
  ip: string | null
  user_agent: string | null
}

const msUntil = (iso: string, now: number) => Math.max(1000, Date.parse(iso) - now)

/**
 * The grant's id claimed once and its session kept until it ends; a grant
 * seen before is `support.grant_used` (409). The claim outlives the
 * session by its skew, so a grant cannot come back while it could verify.
 */
export async function openSession(session: SupportSession, now: number): Promise<void> {
  const store = supportStore()
  const claimed = await store.claimGrant(
    session.grant_id,
    msUntil(session.expires_at, now) + 5 * 60_000
  )
  if (!claimed) {
    throw new ConflictError("support.grant_used")
  }
  await store.put(session, msUntil(session.expires_at, now))
}

export const openSupportSessionStep = createStep(
  "support-access-open-session",
  async (input: { session: SupportSession }) => {
    await openSession(input.session, Date.now())
    return new StepResponse(input.session, input.session)
  },
  async (session) => {
    // A later step failed: the session is closed, the grant stays used
    if (session) {
      await endSession(session.grant_id, "expired", Date.now()).catch(() => undefined)
    }
  }
)

/** Marks the session ended (its record kept till its time, for the owner's list); null if gone. */
export async function endSession(
  grantId: string,
  reason: SupportEndReason,
  now: number
): Promise<SupportSession | null> {
  const store = supportStore()
  const session = await store.get(grantId)
  if (!session || session.ended_reason || now >= Date.parse(session.expires_at)) {
    return null
  }
  const ended: SupportSession = {
    ...session,
    ended_at: new Date(now).toISOString(),
    ended_reason: reason,
  }
  await store.put(ended, msUntil(session.expires_at, now))
  return ended
}

export async function recordSupportEvent(
  container: Container,
  input: {
    action: "support_access.started" | "support_access.ended" | "support_access.refused"
    grant_id: string | null
    actor_id: string | null
    changes: Record<string, unknown>
    outcome: number
    facts: RequestFacts
  }
): Promise<void> {
  await container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).record({
    kind: "system",
    action: input.action,
    actor_type: input.actor_id ? "user" : "system",
    actor_id: input.actor_id,
    resource_type: SUPPORT_RESOURCE,
    resource_id: input.grant_id,
    outcome: input.outcome,
    changes: input.changes,
    ...input.facts,
  })
}

export const recordSupportStartStep = createStep(
  "support-access-record-start",
  async (input: { session: SupportSession; facts: RequestFacts }, { container }) => {
    const { session } = input
    await recordSupportEvent(container, {
      action: "support_access.started",
      grant_id: session.grant_id,
      actor_id: session.actor_id,
      outcome: 200,
      changes: {
        operator_id: session.operator.id,
        operator_name: session.operator.name,
        operator_role: session.operator.role,
        reason: session.reason,
        expires_at: session.expires_at,
      },
      facts: input.facts,
    })
    return new StepResponse(true)
  }
)

/** "14:35" in the shop's time (Europe/Istanbul). */
export const shopTime = (iso: string): string =>
  new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
    hour12: false,
  }).format(new Date(iso))

/** The owners' user ids, read from the role table. */
async function ownerIds(container: Container): Promise<string[]> {
  const roles = await container
    .resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE)
    .listStaffRoles({ role: "owner" }, { select: ["user_id"], take: 50 })
  return roles.map((row) => row.user_id)
}

/**
 * The owners told (Karar 6): the bell, then each owner's own login by
 * e-mail (when the shop's mail goes out; else the bell is enough). Never
 * fails the session: a notice that cannot go is logged.
 */
export async function notifyOwners(container: Container, session: SupportSession): Promise<void> {
  const values = {
    operator: session.operator.name,
    reason: session.reason,
    ends_at: shopTime(session.expires_at),
  }
  try {
    await container.resolve(Modules.NOTIFICATION).createNotifications({
      to: "",
      channel: "feed",
      template: "admin-ui",
      trigger_type: "support_access.started",
      resource_id: session.grant_id,
      idempotency_key: `support_access.started:${session.grant_id}`,
      data: {
        kind: "support_access_started",
        ...values,
        ...notificationText("support_access.started", values),
      },
    })
  } catch (error) {
    logger.warn({ event: "support_access.bell_failed", err: errorSummary(error) })
  }
  try {
    for (const userId of await ownerIds(container)) {
      await sendMessageWorkflow(container as MedusaContainer).run({
        input: {
          template: "staff.support_access",
          resource_id: userId,
          key: session.grant_id,
          extra: values,
        },
      })
    }
  } catch (error) {
    logger.warn({ event: "support_access.mail_failed", err: errorSummary(error) })
  }
}

export const notifyOwnersStep = createStep(
  "support-access-notify-owners",
  async (input: { session: SupportSession }, { container }) => {
    await notifyOwners(container, input.session)
    return new StepResponse(true)
  }
)

/**
 * A session ended before its time (Karar 4, 6): by signing out, by the
 * owner, or by the switch turned off; the end in the audit log, by whom.
 * Nothing when it had already ended or run out.
 */
export const endSupportSessionStep = createStep(
  "support-access-end-session",
  async (
    input: {
      grant_id: string
      reason: SupportEndReason
      actor_id: string | null
      facts: RequestFacts
    },
    { container }
  ) => {
    const ended = await endSession(input.grant_id, input.reason, Date.now())
    if (ended) {
      await recordSupportEvent(container, {
        action: "support_access.ended",
        grant_id: ended.grant_id,
        actor_id: input.actor_id,
        outcome: 200,
        changes: { reason: input.reason, operator_name: ended.operator.name },
        facts: input.facts,
      })
    }
    return new StepResponse(ended)
  }
)
