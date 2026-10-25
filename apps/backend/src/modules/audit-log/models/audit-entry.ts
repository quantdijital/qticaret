import { model } from "@medusajs/framework/utils"

/**
 * One audited event (adr/0011): an admin mutation, a read of personal data
 * or a meaningful automatic action. Append-only: the service exposes no
 * update or delete, and F16 revokes UPDATE/DELETE on the table.
 */
export const AuditEntry = model
  .define("audit_entry", {
    id: model.id({ prefix: "aud" }).primaryKey(),
    kind: model.enum(["mutation", "sensitive_read", "system"]),
    actor_type: model.text().nullable(),
    actor_id: model.text().nullable(),
    // HTTP method and route pattern (`POST /admin/products/:id`) or a system action name
    action: model.text(),
    resource_type: model.text().nullable(),
    resource_id: model.text().nullable(),
    outcome: model.number().nullable(),
    changes: model.json().nullable(),
    request_id: model.text().nullable(),
    // Personal data: kept for the retention period docs/12 sets, erased in F13
    ip: model.text().nullable(),
    user_agent: model.text().nullable(),
  })
  .indexes([{ on: ["resource_type", "resource_id"] }, { on: ["actor_id"] }, { on: ["created_at"] }])
