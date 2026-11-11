import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import { comparePlanSerial } from "@qticaret/types/control-plane"
import type Redis from "ioredis"
import { createRedisVersionSource, createVersionedCache } from "../../lib/cache"
import type { VersionedCache } from "../../lib/cache"
import { controlPlaneConfig } from "../../lib/control-plane/config"
import { createRedisClient } from "../../lib/redis"
import { ControlPlanePlan } from "./models/control-plane-plan"
import type { PlanSource } from "./models/control-plane-plan"
import { DEFAULT_PLAN_STATE } from "./types"
import type {
  ControlPlaneModuleOptions,
  PlanState,
  SignedPlanDocument,
  StoreResult,
  StoredPlan,
} from "./types"

export type { PlanState, StoreOutcome, StoreResult, StoredPlan } from "./types"

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

/** A row as `StoredPlan`, without its id. */
const storedOf = (row: StoredPlan & { id: string }): StoredPlan => ({
  tenant_id: row.tenant_id,
  serial: row.serial,
  document: row.document,
  kid: row.kid,
  signature: row.signature,
  received_at: row.received_at,
  confirmed_at: row.confirmed_at,
  source: row.source,
})

const FIELDS = [
  "tenant_id",
  "serial",
  "document",
  "kid",
  "signature",
  "received_at",
  "confirmed_at",
  "source",
] as const

/**
 * The plan document this shop last accepted (adr/0061 §3.3, §5.1, Ek C9)
 * and what it says, cached with the versioned pattern: every process sees
 * a new document within a second (Redis marker), within 30 seconds without
 * one. It stores only what the caller has verified (signature, shop id;
 * lib/control-plane/receive.ts) and applies the serial rule itself, under
 * a lock, so a push and a pull cannot race. Unmanaged (no public keys),
 * it reports `active` with no limits and stores nothing.
 */
class ControlPlaneModuleService extends MedusaService({ ControlPlanePlan }) {
  private readonly cache: VersionedCache<PlanState>

  constructor(container: Record<string, unknown>, options: ControlPlaneModuleOptions = {}) {
    // eslint-disable-next-line prefer-rest-params -- MedusaService needs every constructor argument
    super(...arguments)
    const { redisUrl } = options
    let client: Redis | undefined
    const source = redisUrl
      ? createRedisVersionSource(
          () => (client ??= createRedisClient(redisUrl, "control_plane")),
          options.versionKey ?? "qt:control-plane:version"
        )
      : null
    this.cache = createVersionedCache({
      name: "control_plane",
      source,
      load: () => this.loadState_(),
    })
  }

  @InjectManager()
  protected async loadState_(@MedusaContext() sharedContext: Context = {}): Promise<PlanState> {
    const config = controlPlaneConfig()
    if (!config.managed || config.tenantId === null) {
      return DEFAULT_PLAN_STATE(config.managed)
    }
    const stored = await this.storedPlan(config.tenantId, sharedContext)
    if (!stored) {
      return DEFAULT_PLAN_STATE(true)
    }
    const { document } = stored
    return {
      managed: true,
      status: document.status,
      package_code: document.package_code,
      limits: { ...document.limits },
      platform_flags: { ...document.platform_flags },
      billing: { ...document.billing },
      serial: stored.serial,
      issued_at: document.issued_at,
      received_at: stored.received_at,
      confirmed_at: stored.confirmed_at,
      source: stored.source,
    }
  }

  /** What the control plane says now (cached); unmanaged: `active`, no limits. */
  async planState(): Promise<PlanState> {
    return await this.cache.get()
  }

  /** The stored document for a shop id, read now (no cache). */
  @InjectManager()
  async storedPlan(
    tenantId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<StoredPlan | null> {
    const [row] = await this.listControlPlanePlans(
      { tenant_id: tenantId },
      { select: [...FIELDS], take: 1 },
      sharedContext
    )
    return (row as unknown as StoredPlan | undefined) ?? null
  }

  /**
   * A verified document against the stored one (`comparePlanSerial`): a
   * greater serial replaces it, the same serial changes nothing, a smaller
   * one (a replay) is `stale` and changes nothing at all. Only a pull
   * (whose answer is bound to the shop's own fresh nonce) moves
   * `confirmed_at`: a pushed document, even the current one replayed,
   * never makes the shop look in touch (C9 review L3).
   */
  async storePlanDocument(
    signed: SignedPlanDocument,
    source: PlanSource,
    now: Date = new Date()
  ): Promise<StoreResult> {
    const result = await this.storeInTransaction_(signed, source, now)
    if (result.outcome !== "stale") {
      await this.cache.invalidate()
    }
    return result
  }

  @InjectTransactionManager()
  protected async storeInTransaction_(
    signed: SignedPlanDocument,
    source: PlanSource,
    now: Date,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<StoreResult> {
    const tenantId = signed.document.tenant_id
    await (sharedContext.transactionManager as Executor).execute(
      "SELECT pg_advisory_xact_lock(hashtext(?))",
      [`control_plane_plan:${tenantId}`]
    )
    const [row] = (await this.listControlPlanePlans(
      { tenant_id: tenantId },
      { select: ["id", ...FIELDS], take: 1 },
      sharedContext
    )) as unknown as (StoredPlan & { id: string })[]
    const order = comparePlanSerial(row ? row.serial : null, signed.document.serial)
    if (order === "stale") {
      return { outcome: "stale", previous: null }
    }
    const pulled = source === "pull"
    if (order === "same" && row) {
      if (pulled) {
        await this.updateControlPlanePlans({ id: row.id, confirmed_at: now }, sharedContext)
      }
      return { outcome: "same", previous: null }
    }
    const values = {
      serial: signed.document.serial,
      document: signed.document as unknown as Record<string, unknown>,
      kid: signed.kid,
      signature: signed.signature,
      received_at: now,
      confirmed_at: pulled ? now : (row?.confirmed_at ?? null),
      source,
    }
    if (row) {
      await this.updateControlPlanePlans({ id: row.id, ...values }, sharedContext)
    } else {
      await this.createControlPlanePlans([{ tenant_id: tenantId, ...values }], sharedContext)
    }
    return { outcome: "applied", previous: row ? storedOf(row) : null }
  }

  /**
   * Puts the stored document back as it was before an `applied` (workflow
   * compensation), under the same lock and only while the row still holds
   * the serial being undone (C9 review M1): a newer document stored in
   * between is never overwritten by an older one.
   */
  async restorePlanDocument(
    tenantId: string,
    undoneSerial: number,
    previous: StoredPlan | null
  ): Promise<void> {
    await this.restoreInTransaction_(tenantId, undoneSerial, previous)
    await this.cache.invalidate()
  }

  @InjectTransactionManager()
  protected async restoreInTransaction_(
    tenantId: string,
    undoneSerial: number,
    previous: StoredPlan | null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    await (sharedContext.transactionManager as Executor).execute(
      "SELECT pg_advisory_xact_lock(hashtext(?))",
      [`control_plane_plan:${tenantId}`]
    )
    const [row] = (await this.listControlPlanePlans(
      { tenant_id: tenantId },
      { select: ["id", "serial"], take: 1 },
      sharedContext
    )) as unknown as { id: string; serial: number }[]
    if (row?.serial !== undoneSerial) {
      return
    }
    if (previous === null) {
      await this.deleteControlPlanePlans([row.id], sharedContext)
      return
    }
    await this.updateControlPlanePlans(
      {
        id: row.id,
        serial: previous.serial,
        document: previous.document,
        kid: previous.kid,
        signature: previous.signature,
        received_at: previous.received_at,
        confirmed_at: previous.confirmed_at,
        source: previous.source,
      },
      sharedContext
    )
  }
}

export default ControlPlaneModuleService
