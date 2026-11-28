import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sessionState } from "../../../lib/support-access/session"
import { supportStore } from "../../../lib/support-access/store"
import { AUDIT_LOG_MODULE } from "../../../modules/audit-log"
import type AuditLogModuleService from "../../../modules/audit-log/service"
import { SUPPORT_RESOURCE } from "../../../workflows/support-access"
import { supportEnabled } from "../../http/support-guard"

const HISTORY = 20

const text = (value: unknown): string | null => (typeof value === "string" ? value : null)

/**
 * GET /admin/support-access (adr/0061 Ek "Destek erişimi", Karar 6; the
 * owner's alone, `OWNER_ONLY`): whether the platform's support may come
 * in, the sessions open now (who, why, until when) and the last twenty
 * sign-ins from the audit log, each with how it ended.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const enabled = await supportEnabled(req)
  const now = Date.now()
  const open = (await supportStore().list())
    .filter((session) => sessionState(session, { now, enabled }) === "open")
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .map((session) => ({
      grant_id: session.grant_id,
      operator_name: session.operator.name,
      reason: session.reason,
      started_at: session.started_at,
      expires_at: session.expires_at,
    }))
  const audit = req.scope.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
  const started = await audit.listAuditEntries(
    { resource_type: SUPPORT_RESOURCE, action: "support_access.started" },
    { order: { created_at: "DESC" }, take: HISTORY }
  )
  const grantIds = started.map((entry) => entry.resource_id).filter((id): id is string => !!id)
  const ends =
    grantIds.length > 0
      ? await audit.listAuditEntries(
          {
            resource_type: SUPPORT_RESOURCE,
            action: "support_access.ended",
            resource_id: grantIds,
          },
          { take: HISTORY * 2 }
        )
      : []
  const endOf = new Map(ends.map((entry) => [entry.resource_id, entry]))
  const history = started.map((entry) => {
    const changes = (entry.changes ?? {}) as Record<string, unknown>
    const end = entry.resource_id ? endOf.get(entry.resource_id) : undefined
    const endChanges = (end?.changes ?? {}) as Record<string, unknown>
    return {
      grant_id: entry.resource_id,
      operator_name: text(changes["operator_name"]),
      reason: text(changes["reason"]),
      started_at: entry.created_at,
      expires_at: text(changes["expires_at"]),
      ended_at: end?.created_at ?? null,
      ended_reason: text(endChanges["reason"]),
    }
  })
  res.setHeader("Cache-Control", "no-store")
  res.json({ enabled, sessions: open, history })
}
