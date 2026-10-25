import { z } from "@medusajs/framework/zod"

// docs/04: list endpoints page at most 100 records
export const AUDIT_LOG_MAX_LIMIT = 100

const text = z.string().trim().min(1).max(256)

export const AdminGetAuditLog = z.object({
  kind: z.enum(["mutation", "sensitive_read", "system"]).optional(),
  resource_type: text.optional(),
  resource_id: text.optional(),
  actor_id: text.optional(),
  created_after: z.coerce.date().optional(),
  created_before: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(AUDIT_LOG_MAX_LIMIT).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
export type AdminGetAuditLogType = z.infer<typeof AdminGetAuditLog>
