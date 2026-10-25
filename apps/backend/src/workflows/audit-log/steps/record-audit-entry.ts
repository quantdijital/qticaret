import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { AUDIT_LOG_MODULE } from "../../../modules/audit-log"
import type AuditLogModuleService from "../../../modules/audit-log/service"
import type { AuditEntryInput } from "../../../modules/audit-log/service"

export type RecordAuditEntryInput = Omit<AuditEntryInput, "kind"> & {
  kind?: AuditEntryInput["kind"]
}

/**
 * A meaningful automatic action (an automatic 301, a job run, a retention
 * delete) written to the audit log as `system` (adr/0011). No compensation:
 * the log is append-only, and an attempt that was rolled back still happened.
 */
export const recordAuditEntryStep = createStep(
  "audit-log-record-entry",
  async (input: RecordAuditEntryInput, { container }) => {
    const service = container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
    const entry = await service.record({ ...input, kind: input.kind ?? "system" })
    return new StepResponse({ id: entry.id })
  }
)
