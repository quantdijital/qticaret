import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
} from "@medusajs/framework/utils"
import { ed25519KeyId, publicKeyFromRaw } from "@qticaret/server-kit"
import type { UsageSetup } from "@qticaret/types/control-plane"
import type { TenantKeyStatus } from "./models/tenant-key"
import { FleetReleases } from "./service-releases"

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

export interface TenantKeyView {
  id: string
  tenant_id: string
  kid: string
  public_key: string
  status: TenantKeyStatus
  retired_at: Date | null
  created_at: Date
}

const PUBLIC_KEY = /^[A-Za-z0-9_-]{43}$/

/** The key id a raw Ed25519 public key (base64url) has; null when it is not one. */
function kidOf(publicKey: string): string | null {
  if (!PUBLIC_KEY.test(publicKey)) {
    return null
  }
  try {
    return ed25519KeyId(publicKeyFromRaw(Buffer.from(publicKey, "base64url")))
  } catch {
    return null
  }
}

async function lockTenant(sharedContext: Context, tenantId: string): Promise<void> {
  await (sharedContext.transactionManager as Executor).execute(
    "SELECT pg_advisory_xact_lock(hashtext(?))",
    [`tenant_key:${tenantId}`]
  )
}

const FIELDS = [
  "id",
  "tenant_id",
  "kid",
  "public_key",
  "status",
  "retired_at",
  "created_at",
] as const

/**
 * What the control plane knows of the shops it runs, beyond their records
 * (adr/0061 §2 `fleet`). C8: the shops' public keys. C9: their plan
 * documents (`FleetDocuments`, service-documents.ts). C13: their usage
 * snapshots and health probes (`FleetMonitoring`, service-monitoring.ts).
 * C18: the releases and each shop's target (`FleetReleases`, service-releases.ts).
 */
class FleetModuleService extends FleetReleases {
  /**
   * The public key a shop's signed request may be checked against (Ek C9):
   * its `active` or `next` key by `kid`, never a retired one and never
   * another shop's. Null when there is none: the caller answers as for a
   * wrong signature, so it tells no one whether the shop exists.
   */
  @InjectManager()
  async trustedTenantKey(
    tenantId: string,
    kid: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<string | null> {
    const [row] = await this.listTenantKeys(
      { tenant_id: tenantId, kid, status: ["active", "next"] },
      { select: ["public_key"], take: 1 },
      sharedContext
    )
    return row?.public_key ?? null
  }

  @InjectManager()
  async tenantKeys(
    tenantId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<TenantKeyView[]> {
    const rows = await this.listTenantKeys(
      { tenant_id: tenantId },
      { select: [...FIELDS], order: { created_at: "ASC" }, take: 100 },
      sharedContext
    )
    return rows
  }

  /**
   * A shop's new public key: `active` when it has none, `next` while a
   * rotation moves it (refused while another `next` waits). Its `kid` is
   * derived here from the key itself; a caller's that differs is refused
   * (review L3): a row can never name another key's id.
   */
  @InjectTransactionManager()
  async registerTenantKey(
    input: { tenant_id: string; kid: string; public_key: string },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<TenantKeyView> {
    if (kidOf(input.public_key) !== input.kid) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "cp.tenant_key_invalid")
    }
    await lockTenant(sharedContext, input.tenant_id)
    const current = await this.tenantKeys(input.tenant_id, sharedContext)
    if (current.some((key) => key.status === "next")) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.tenant_key_next_exists")
    }
    const status = current.some((key) => key.status === "active") ? "next" : "active"
    const [created] = await this.createTenantKeys([{ ...input, status }], sharedContext)
    return created as unknown as TenantKeyView
  }

  /** The shop moved to its `next` key: it becomes `active`, the old one `retired`. */
  @InjectTransactionManager()
  async promoteTenantKey(
    tenantId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ from: string | null; to: string }> {
    // The same lock as a new key's: a promotion and a registration never interleave
    await lockTenant(sharedContext, tenantId)
    const current = await this.tenantKeys(tenantId, sharedContext)
    const next = current.find((key) => key.status === "next")
    if (!next) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.tenant_key_no_next")
    }
    const active = current.find((key) => key.status === "active")
    const manager = sharedContext.transactionManager as Executor
    await manager.execute(
      `UPDATE tenant_key SET status = 'retired', retired_at = now(), updated_at = now()
        WHERE tenant_id = ? AND status = 'active' AND deleted_at IS NULL`,
      [tenantId]
    )
    await manager.execute(
      "UPDATE tenant_key SET status = 'active', updated_at = now() WHERE id = ?",
      [next.id]
    )
    return { from: active?.kid ?? null, to: next.kid }
  }

  /**
   * Ek C21: each shop's setup checklist from its latest usage report, for
   * the shops list (one page, at most 100). A shop without a report, or
   * whose latest came from an older release without the field, is absent.
   */
  @InjectManager()
  async latestSetups(
    tenantIds: readonly string[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Map<string, UsageSetup>> {
    if (tenantIds.length === 0) {
      return new Map()
    }
    const rows = (await (sharedContext.manager as Executor).execute(
      `SELECT t.id AS tenant_id, u.setup
         FROM unnest(ARRAY[${tenantIds.map(() => "?").join(", ")}]::text[]) AS t(id)
         CROSS JOIN LATERAL (
           SELECT setup FROM usage_snapshot
            WHERE tenant_id = t.id AND deleted_at IS NULL ORDER BY reported_at DESC LIMIT 1
         ) u
        WHERE u.setup IS NOT NULL`,
      [...tenantIds]
    )) as { tenant_id: string; setup: UsageSetup }[]
    return new Map(rows.map((row) => [row.tenant_id, row.setup]))
  }

  /** The undo of `registerTenantKey` in a failed issue. */
  @InjectTransactionManager()
  async removeTenantKey(id: string, @MedusaContext() sharedContext: Context = {}): Promise<void> {
    await this.deleteTenantKeys([id], sharedContext)
  }
}

export default FleetModuleService
