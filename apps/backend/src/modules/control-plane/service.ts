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
import { ControlPlaneMarker } from "./models/control-plane-marker"
import { ControlPlanePlan } from "./models/control-plane-plan"
import type { PlanSource } from "./models/control-plane-plan"
import { replacePlanRow } from "./replace-row"
import type { TransactionalManager } from "./replace-row"
import {
  LastVerified,
  stateOfStored,
  storedRowProblem,
  tenantMismatch,
  unverifiedStatus,
} from "./trusted-state"
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
 * it reports `active` with no limits and stores nothing. What it loads is
 * checked again (Ek C19 I2, I3: `trusted-state.ts`); a missing row after
 * an applied document (`ControlPlaneMarker`) is not a fresh shop (Ek C19
 * takip LOW-3).
 */
class ControlPlaneModuleService extends MedusaService({ ControlPlanePlan, ControlPlaneMarker }) {
  private readonly cache: VersionedCache<PlanState>
  private readonly lastVerified = new LastVerified()

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
      const [other] = await this.listControlPlanePlans(
        {},
        { select: ["id"], take: 1 },
        sharedContext
      )
      if (other) {
        return tenantMismatch()
      }
      return (await this.hasApplied_(config.tenantId, sharedContext))
        ? this.lastVerified.missing(config.tenantId)
        : DEFAULT_PLAN_STATE(true)
    }
    const problem = storedRowProblem(stored, config)
    if (problem !== null) {
      return this.lastVerified.fallback(config.tenantId, problem, unverifiedStatus(stored))
    }
    return this.lastVerified.remember(config.tenantId, stateOfStored(stored))
  }

  private async hasApplied_(tenantId: string, sharedContext: Context): Promise<boolean> {
    const [marker] = await this.listControlPlaneMarkers(
      { tenant_id: tenantId },
      { select: ["id"], take: 1 },
      sharedContext
    )
    return marker !== undefined
  }

  /** Reads the stored document again now in this process (the next `planState` loads it). */
  async reloadPlanState(): Promise<void> {
    await this.cache.invalidate()
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
   * never makes the shop look in touch (C9 review L3). Ek C19 I1: so a
   * pushed `same` changes nothing either, and neither drops the cache nor
   * moves the processes' shared marker (a replayed push costs no reload).
   * Ek C19 takip INFO-1: a `same` whose stored row fails its checks is
   * `repaired` with the verified document and reloads.
   */
  async storePlanDocument(
    signed: SignedPlanDocument,
    source: PlanSource,
    now: Date = new Date()
  ): Promise<StoreResult> {
    const result = await this.storeInTransaction_(signed, source, now)
    if (
      result.outcome === "applied" ||
      result.repaired ||
      (result.outcome === "same" && source === "pull")
    ) {
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
      return { outcome: "stale", previous: null, marked: false, repaired: false }
    }
    const pulled = source === "pull"
    const values = {
      serial: signed.document.serial,
      document: signed.document as unknown as Record<string, unknown>,
      kid: signed.kid,
      signature: signed.signature,
      received_at: now,
      confirmed_at: pulled ? now : (row?.confirmed_at ?? null),
      source,
    }
    const manager = sharedContext.transactionManager as TransactionalManager
    if (order === "same" && row) {
      const repaired = storedRowProblem(storedOf(row), controlPlaneConfig()) !== null
      if (repaired) {
        // The whole document, never merged into the old one (replace-row.ts)
        await replacePlanRow(manager, row.id, values)
      } else if (pulled) {
        await this.updateControlPlanePlans({ id: row.id, confirmed_at: now }, sharedContext)
      }
      return { outcome: "same", previous: null, marked: false, repaired }
    }
    if (row) {
      await replacePlanRow(manager, row.id, values)
    } else {
      await this.createControlPlanePlans([{ tenant_id: tenantId, ...values }], sharedContext)
    }
    const marked = !(await this.hasApplied_(tenantId, sharedContext))
    if (marked) {
      await this.createControlPlaneMarkers(
        [{ tenant_id: tenantId, first_applied_at: now }],
        sharedContext
      )
    }
    return { outcome: "applied", previous: row ? storedOf(row) : null, marked, repaired: false }
  }

  /**
   * Puts the stored document back as it was before an `applied` (workflow
   * compensation), under the same lock and only while the row still holds
   * the serial being undone (C9 review M1): a newer document stored in
   * between is never overwritten by an older one. `unmark`: the apply
   * wrote the shop's first marker, which goes with it.
   */
  async restorePlanDocument(
    tenantId: string,
    undoneSerial: number,
    previous: StoredPlan | null,
    unmark = false
  ): Promise<void> {
    await this.restoreInTransaction_(tenantId, undoneSerial, previous, unmark)
    await this.cache.invalidate()
  }

  @InjectTransactionManager()
  protected async restoreInTransaction_(
    tenantId: string,
    undoneSerial: number,
    previous: StoredPlan | null,
    unmark: boolean,
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
    if (unmark) {
      const markers = await this.listControlPlaneMarkers(
        { tenant_id: tenantId },
        { select: ["id"] },
        sharedContext
      )
      await this.deleteControlPlaneMarkers(
        markers.map((marker) => marker.id),
        sharedContext
      )
    }
    if (previous === null) {
      await this.deleteControlPlanePlans([row.id], sharedContext)
      return
    }
    // The previous document whole, as it was signed (replace-row.ts)
    await replacePlanRow(sharedContext.transactionManager as TransactionalManager, row.id, previous)
  }
}

export default ControlPlaneModuleService
