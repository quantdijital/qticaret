import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import type { PlanDocument as PlanDocumentBody } from "@qticaret/types/control-plane"
import { PlanDocument } from "./models/plan-document"
import type { PlanPushStatus } from "./models/plan-document"
import { TenantKey } from "./models/tenant-key"

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

export interface PlanDocumentRow {
  id: string
  tenant_id: string
  serial: number
  document: PlanDocumentBody
  content_hash: string
  kid: string
  signature: string
  issued_at: Date
  push_status: PlanPushStatus
  push_attempts: number
  push_error: string | null
  pushed_at: Date | null
  next_push_at: Date | null
  pulled_at: Date | null
}

/** What signs a document: its serial and time given, the body and signature back. */
export type BuildDocument = (
  serial: number,
  issuedAt: Date
) => Promise<{ document: PlanDocumentBody; kid: string; signature: string }>

/** A push's outcome: delivered, or failed with the next try (null: no more tries). */
export type PushOutcome =
  { delivered: true } | { delivered: false; error: string; next_push_at: Date | null }

/** What the shop page shows of a shop's documents (Ek C9). */
export interface PlanDocumentSummary {
  serial: number
  issued_at: Date
  push_status: PlanPushStatus
  push_error: string | null
  push_attempts: number
  pushed_at: Date | null
  /** The last pull of any of its documents. */
  pulled_at: Date | null
}

const PAGE = 100

/**
 * The fleet module's plan documents (adr/0061 §3.2, Ek C9): issued per
 * shop with a serial that grows by one under the shop's advisory lock,
 * issued again only when the content changes, their pushes and pulls
 * noted. `FleetModuleService` (service.ts) holds the shops' keys.
 */
export class FleetDocuments extends MedusaService({ TenantKey, PlanDocument }) {
  @InjectManager()
  async latestPlanDocument(
    tenantId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<PlanDocumentRow | null> {
    const [row] = await this.listPlanDocuments(
      { tenant_id: tenantId },
      { order: { serial: "DESC" }, take: 1 },
      sharedContext
    )
    return (row as unknown as PlanDocumentRow | undefined) ?? null
  }

  /**
   * The shop's next document, when its content (`contentHash`, without
   * serial and time) differs from the latest one's; otherwise the latest,
   * untouched. `build` signs it inside the lock, so two issues never take
   * one serial. A pending push of an older document is superseded.
   */
  @InjectTransactionManager()
  async issuePlanDocument(
    tenantId: string,
    contentHash: string,
    build: BuildDocument,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ issued: boolean; row: PlanDocumentRow }> {
    const manager = sharedContext.transactionManager as Executor
    await manager.execute("SELECT pg_advisory_xact_lock(hashtext(?))", [
      `plan_document:${tenantId}`,
    ])
    const latest = await this.latestPlanDocument(tenantId, sharedContext)
    if (latest?.content_hash === contentHash) {
      return { issued: false, row: latest }
    }
    const serial = (latest?.serial ?? 0) + 1
    const issuedAt = new Date()
    const signed = await build(serial, issuedAt)
    const [row] = await this.createPlanDocuments(
      [
        {
          tenant_id: tenantId,
          serial,
          document: signed.document,
          content_hash: contentHash,
          kid: signed.kid,
          signature: signed.signature,
          issued_at: issuedAt,
          push_status: "pending",
          next_push_at: issuedAt,
        },
      ],
      sharedContext
    )
    await manager.execute(
      `UPDATE plan_document SET push_status = 'superseded', next_push_at = NULL, updated_at = now()
        WHERE tenant_id = ? AND push_status = 'pending' AND serial < ? AND deleted_at IS NULL`,
      [tenantId, serial]
    )
    return { issued: true, row: row as unknown as PlanDocumentRow }
  }

  /** The undo of an issue: only while it is still the shop's latest. */
  @InjectTransactionManager()
  async removePlanDocument(id: string, @MedusaContext() sharedContext: Context = {}) {
    await (sharedContext.transactionManager as Executor).execute(
      `DELETE FROM plan_document d WHERE d.id = ? AND NOT EXISTS (
         SELECT 1 FROM plan_document n WHERE n.tenant_id = d.tenant_id AND n.serial > d.serial)`,
      [id]
    )
  }

  /** Documents whose push is due, the longest waiting first. */
  @InjectManager()
  async duePlanPushes(
    now: Date,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<PlanDocumentRow[]> {
    return (await this.listPlanDocuments(
      { push_status: "pending", next_push_at: { $lte: now } },
      { order: { next_push_at: "ASC" }, take: PAGE },
      sharedContext
    )) as unknown as PlanDocumentRow[]
  }

  /** A push's outcome, kept only while the document still waits for one. */
  @InjectTransactionManager()
  async notePlanPush(
    id: string,
    outcome: PushOutcome,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const manager = sharedContext.transactionManager as Executor
    if (outcome.delivered) {
      await manager.execute(
        `UPDATE plan_document SET push_status = 'delivered', pushed_at = now(), push_error = NULL,
           push_attempts = push_attempts + 1, next_push_at = NULL, updated_at = now()
          WHERE id = ? AND push_status = 'pending'`,
        [id]
      )
      return
    }
    await manager.execute(
      `UPDATE plan_document SET push_status = ?, push_error = ?, next_push_at = ?,
         push_attempts = push_attempts + 1, updated_at = now()
        WHERE id = ? AND push_status = 'pending'`,
      [outcome.next_push_at ? "pending" : "failed", outcome.error, outcome.next_push_at, id]
    )
  }

  /** The shop pulled this document. */
  @InjectManager()
  async notePlanPulled(id: string, at: Date, @MedusaContext() sharedContext: Context = {}) {
    await (sharedContext.manager as Executor).execute(
      "UPDATE plan_document SET pulled_at = ?, updated_at = now() WHERE id = ?",
      [at, id]
    )
  }

  /** The latest document's serial, time and push, and the shop's last pull; null for none. */
  @InjectManager()
  async planDocumentSummary(
    tenantId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<PlanDocumentSummary | null> {
    const latest = await this.latestPlanDocument(tenantId, sharedContext)
    if (!latest) {
      return null
    }
    const [pulled] = (await (sharedContext.manager as Executor).execute(
      `SELECT max(pulled_at) AS pulled_at FROM plan_document
        WHERE tenant_id = ? AND deleted_at IS NULL`,
      [tenantId]
    )) as { pulled_at: Date | null }[]
    return {
      serial: latest.serial,
      issued_at: latest.issued_at,
      push_status: latest.push_status,
      push_error: latest.push_error,
      push_attempts: latest.push_attempts,
      pushed_at: latest.pushed_at,
      pulled_at: pulled?.pulled_at ?? null,
    }
  }
}
