import { model } from "@medusajs/framework/utils"

/**
 * One audited event (adr/0061 §3.5; the shop's audit-log module, copied):
 * a staff mutation, a sensitive read, or a system action. Append-only. The
 * client's address is kept only as a keyed hash (`ip_hash`): enough to tell
 * two requests came from the same place, nothing to read back. No browser,
 * no request body: a mutation records its body's field names, never values.
 */
export const CpAuditEntry = model
  .define("cp_audit_entry", {
    id: model.id({ prefix: "cpaud" }).primaryKey(),
    kind: model.enum(["mutation", "sensitive_read", "system"]),
    actor_type: model.text().nullable(),
    actor_id: model.text().nullable(),
    // HTTP method and route pattern (`POST /admin/cp/staff/members/:id`) or a system action
    action: model.text(),
    resource_type: model.text().nullable(),
    resource_id: model.text().nullable(),
    outcome: model.number().nullable(),
    changes: model.json().nullable(),
    request_id: model.text().nullable(),
    ip_hash: model.text().nullable(),
  })
  .indexes([{ on: ["resource_type", "resource_id"] }, { on: ["actor_id"] }, { on: ["created_at"] }])
