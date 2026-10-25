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
const MAX_CHANGES_BYTES = 64 * 1024

const bounded = (value: string | null | undefined, max: number): string | null =>
  value === undefined || value === null ? null : value.slice(0, max)

function bytes(value: unknown): number {
  // undefined for undefined, despite the type
  const json: unknown = JSON.stringify(value)
  return typeof json === "string" ? Buffer.byteLength(json) : 0
}

/**
 * A change set over the budget keeps everything but the per-field `diff`,
 * which is cut at the budget with its full count; a hundred harmless price
 * changes must not hide the one that matters by wiping them all.
 */
function boundedChanges(changes: Record<string, unknown> | null | undefined) {
  if (changes === undefined || changes === null) {
    return null
  }
  if (bytes(changes) <= MAX_CHANGES_BYTES) {
    return changes
  }
  const { diff, ...rest } = changes
  if (diff !== null && typeof diff === "object") {
    const entries = Object.entries(diff)
    const kept: Record<string, unknown> = {}
    let size = bytes(rest) + 100
    for (const [key, value] of entries) {
      size += bytes(key) + bytes(value) + 2
      if (size > MAX_CHANGES_BYTES) {
        break
      }
      kept[key] = value
    }
    const cut = { ...rest, diff: kept, diff_truncated: true, diff_total: entries.length }
    if (bytes(cut) <= MAX_CHANGES_BYTES) {
      return cut
    }
  }
  return { truncated: true, fields: Object.keys(changes).slice(0, 200) }
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
    // The generated writer itself is closed below: entries go through here
    return await super.createAuditEntries(
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
  // or removed, and is created only through record() with its bounds. Field initialisers run after the base constructor, so these
  // replace the generated methods on every instance.
  override createAuditEntries = refuseWrite
  override updateAuditEntries = refuseWrite
  override deleteAuditEntries = refuseWrite
  override softDeleteAuditEntries = refuseWrite
  override restoreAuditEntries = refuseWrite
}

export default AuditLogModuleService
