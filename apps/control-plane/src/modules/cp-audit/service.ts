import type { Context, InferTypeOf } from "@medusajs/framework/types"
import { InjectManager, MedusaContext, MedusaError, MedusaService } from "@medusajs/framework/utils"
import { CpAuditEntry } from "./models/cp-audit-entry"

export type CpAuditRecord = InferTypeOf<typeof CpAuditEntry>
export type CpAuditKind = CpAuditRecord["kind"]

export interface CpAuditInput {
  kind: CpAuditKind
  action: string
  actor_type?: string | null
  actor_id?: string | null
  resource_type?: string | null
  resource_id?: string | null
  outcome?: number | null
  changes?: Record<string, unknown> | null
  request_id?: string | null
  ip_hash?: string | null
}

const KINDS = new Set<CpAuditKind>(["mutation", "sensitive_read", "system"])
// Bounds so one request cannot write an unbounded row
const MAX_TEXT = 256
const MAX_CHANGES_BYTES = 16 * 1024

const bounded = (value: string | null | undefined): string | null =>
  value === undefined || value === null ? null : value.slice(0, MAX_TEXT)

function boundedChanges(changes: Record<string, unknown> | null | undefined) {
  if (changes === undefined || changes === null) {
    return null
  }
  return Buffer.byteLength(JSON.stringify(changes)) <= MAX_CHANGES_BYTES
    ? changes
    : { truncated: true, fields: Object.keys(changes).slice(0, 100) }
}

// No parameters: a call with the generated writer's arguments does not
// compile, and one that gets past the types still throws
function refuseWrite(): never {
  throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "audit entries are append-only")
}

/**
 * The control plane's append-only audit log (adr/0061 §3.5; the shop's
 * audit-log module, copied and narrowed: an IP hash instead of the address,
 * no browser, so nothing in it needs forgetting later). Record and list,
 * nothing else; F16 revokes UPDATE and DELETE on the table.
 */
class CpAuditModuleService extends MedusaService({ CpAuditEntry }) {
  @InjectManager()
  async record(
    input: CpAuditInput,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<CpAuditRecord> {
    if (!KINDS.has(input.kind)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "cp.audit_kind_invalid")
    }
    // The generated writer itself is closed below: entries go through here
    return await super.createCpAuditEntries(
      {
        kind: input.kind,
        action: input.action.slice(0, MAX_TEXT),
        actor_type: bounded(input.actor_type),
        actor_id: bounded(input.actor_id),
        resource_type: bounded(input.resource_type),
        resource_id: bounded(input.resource_id),
        outcome: input.outcome ?? null,
        changes: boundedChanges(input.changes),
        request_id: bounded(input.request_id),
        ip_hash: bounded(input.ip_hash),
      },
      sharedContext
    )
  }

  // The generated writers stay unreachable: an entry is never changed or
  // removed, and is created only through record() with its bounds
  override createCpAuditEntries = refuseWrite
  override updateCpAuditEntries = refuseWrite
  override deleteCpAuditEntries = refuseWrite
  override softDeleteCpAuditEntries = refuseWrite
  override restoreCpAuditEntries = refuseWrite
}

export default CpAuditModuleService
