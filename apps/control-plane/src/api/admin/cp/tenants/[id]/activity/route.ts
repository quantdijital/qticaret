import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CP_AUDIT_MODULE } from "../../../../../../modules/cp-audit"
import type CpAuditModuleService from "../../../../../../modules/cp-audit/service"
import { tenantParam, tenantsOf } from "../../params"
import type { GetActivityType } from "../../validators"
import { staffNames } from "../../views"

// The record's own reads and its making (the first status row says it) stay out
const NOT_ACTIVITY = ["GET /admin/cp/tenants/:id", "POST /admin/cp/tenants"]

interface Item {
  id: string
  kind: "status" | "action"
  at: Date
  actor_id: string | null
  action?: string
  changes?: Record<string, unknown> | null
  from_status?: string | null
  to_status?: string
  reason_code?: string
}

/**
 * GET /admin/cp/tenants/:id/activity (all staff): what happened to the
 * shop, newest first (adr/0061 §2): its status changes and every change
 * staff made to it, from the audit log (done ones, and TCKN reads), with
 * who did it. The audit's place and request ids stay in the audit log.
 * Payments and setup runs join with C16 and C10.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, GetActivityType>,
  res: MedusaResponse
): Promise<void> {
  const tenant = await tenantParam(req)
  const { limit, before } = req.validatedQuery as GetActivityType
  const until = before ? { created_at: { $lt: new Date(before) } } : {}
  const [changes, entries] = await Promise.all([
    tenantsOf(req).listTenantStatusChanges(
      { tenant_id: tenant.id, ...until },
      {
        select: ["id", "from_status", "to_status", "reason_code", "actor", "created_at"],
        order: { created_at: "DESC" },
        take: limit,
      }
    ),
    req.scope.resolve<CpAuditModuleService>(CP_AUDIT_MODULE).listCpAuditEntries(
      {
        resource_type: "tenant",
        resource_id: tenant.id,
        outcome: { $lt: 400 },
        action: { $nin: NOT_ACTIVITY },
        ...until,
      },
      {
        select: ["id", "actor_id", "action", "changes", "created_at"],
        order: { created_at: "DESC" },
        take: limit,
      }
    ),
  ])
  const items: Item[] = [
    ...changes.map((change) => ({
      id: change.id,
      kind: "status" as const,
      at: change.created_at,
      actor_id: change.actor === "system" ? null : change.actor,
      from_status: change.from_status,
      to_status: change.to_status,
      reason_code: change.reason_code,
    })),
    ...entries.map((entry) => ({
      id: entry.id,
      kind: "action" as const,
      at: entry.created_at,
      actor_id: entry.actor_id,
      action: entry.action,
      changes: entry.changes,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit)
  const names = await staffNames(
    req,
    items.map((item) => item.actor_id)
  )
  const last = items[items.length - 1]
  res.json({
    items: items.map(({ actor_id, ...item }) => ({
      ...item,
      actor: actor_id ? (names[actor_id] ?? null) : null,
    })),
    next_before: items.length === limit && last ? new Date(last.at).toISOString() : null,
  })
}
