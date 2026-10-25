import type { Context, InferTypeOf } from "@medusajs/framework/types"
import { InjectManager, MedusaContext, MedusaError, MedusaService } from "@medusajs/framework/utils"
import { AuditEntry } from "./models/audit-entry"

export type AuditEntryRecord = InferTypeOf<typeof AuditEntry>
export type AuditKind = AuditEntryRecord["kind"]

export interface AuditEntryInput {
  kind: AuditKind
  action: string
  actor_type?: string | null
  actor_id?: string | null
  resource_type?: string | null
  resource_id?: string | null
  outcome?: number | null
  changes?: Record<string, unknown> | null
  request_id?: string | null
  ip?: string | null
  user_agent?: string | null
}

const KINDS = new Set<AuditKind>(["mutation", "sensitive_read", "system"])
// Bounds so one request cannot write an unbounded row
const MAX_TEXT = 256
const MAX_USER_AGENT = 512
const MAX_CHANGES_BYTES = 16 * 1024

const bounded = (value: string | null | undefined, max: number): string | null =>
  value === undefined || value === null ? null : value.slice(0, max)

function boundedChanges(changes: Record<string, unknown> | null | undefined) {
  if (changes === undefined || changes === null) {
    return null
  }
  // A change set that big is summarised by its field names
  return Buffer.byteLength(JSON.stringify(changes)) > MAX_CHANGES_BYTES
    ? { truncated: true, fields: Object.keys(changes).slice(0, 200) }
    : changes
}

// No parameters: a call with the generated writer's arguments does not
// compile, and one that gets past the types still throws
function refuseWrite(): never {
  throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "audit entries are append-only")
}

/** Append-only audit log (F2.5, adr/0011): record and list, nothing else. */
class AuditLogModuleService extends MedusaService({ AuditEntry }) {
  @InjectManager()
  async record(
    input: AuditEntryInput,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<AuditEntryRecord> {
    if (!KINDS.has(input.kind)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "audit_log.kind_invalid")
    }
    return await this.createAuditEntries(
      {
        kind: input.kind,
        action: input.action.slice(0, MAX_TEXT),
        actor_type: bounded(input.actor_type, MAX_TEXT),
        actor_id: bounded(input.actor_id, MAX_TEXT),
        resource_type: bounded(input.resource_type, MAX_TEXT),
        resource_id: bounded(input.resource_id, MAX_TEXT),
        outcome: input.outcome ?? null,
        changes: boundedChanges(input.changes),
        request_id: bounded(input.request_id, MAX_TEXT),
        ip: bounded(input.ip, MAX_TEXT),
        user_agent: bounded(input.user_agent, MAX_USER_AGENT),
      },
      sharedContext
    )
  }

  // The generated writers stay unreachable: an audit entry is never changed
  // or removed. Field initialisers run after the base constructor, so these
  // replace the generated methods on every instance.
  override updateAuditEntries = refuseWrite
  override deleteAuditEntries = refuseWrite
  override softDeleteAuditEntries = refuseWrite
  override restoreAuditEntries = refuseWrite
}

export default AuditLogModuleService
