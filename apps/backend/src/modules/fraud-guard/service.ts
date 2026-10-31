import type { EntityManager } from "@medusajs/framework/mikro-orm/knex"
import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import { uniqueViolationKeys } from "../../lib/errors"
import type { BlockEntry } from "../../lib/fraud/block"
import type { ScoreRule } from "../../lib/fraud/score"
import { FraudBlock } from "./models/fraud-block"
import { FraudReview } from "./models/fraud-review"

export interface BlockInput extends BlockEntry {
  reason?: string | null
  created_by?: string | null
  expires_at?: Date | null
}

export interface Decision {
  id: string
  status: "approved" | "rejected"
  by: string
  note?: string | null
}

/** The shop's block list and its suspicious orders (F15.6, adr/0044). */
class FraudGuardModuleService extends MedusaService({ FraudBlock, FraudReview }) {
  /** The first live entry among those a request could match; null when none. */
  @InjectManager()
  async blockedBy(
    entries: readonly BlockEntry[],
    now: Date = new Date(),
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ id: string; kind: string } | null> {
    if (entries.length === 0) {
      return null
    }
    const rows = await this.listFraudBlocks(
      { $or: entries.map((entry) => ({ kind: entry.kind, match: entry.match })) },
      { select: ["id", "kind", "expires_at"] },
      sharedContext
    )
    const live = rows.find((row) => !row.expires_at || new Date(row.expires_at) > now)
    return live ? { id: live.id, kind: live.kind } : null
  }

  /** Adds an entry, or renews the one already there (its reason and end). */
  async addBlock(input: BlockInput): Promise<{ id: string }> {
    const values = {
      kind: input.kind,
      match: input.match,
      display: input.display,
      reason: input.reason ?? null,
      created_by: input.created_by ?? null,
      expires_at: input.expires_at ?? null,
    }
    const [existing] = await this.listFraudBlocks(
      { kind: input.kind, match: input.match },
      { take: 1, select: ["id"] }
    )
    if (existing) {
      await this.updateFraudBlocks({ id: existing.id, ...values })
      return { id: existing.id }
    }
    try {
      const created = await this.createFraudBlocks(values)
      return { id: created.id }
    } catch (error) {
      if (!uniqueViolationKeys(error)?.includes("match")) {
        throw error
      }
      return this.addBlock(input)
    }
  }

  /** Opens the order's review once; an event delivered again opens nothing new. */
  async openReview(
    orderId: string,
    score: number,
    reasons: { rule: ScoreRule; points: number }[]
  ): Promise<{ id: string; opened: boolean }> {
    const [existing] = await this.listFraudReviews(
      { order_id: orderId },
      { take: 1, select: ["id"] }
    )
    if (existing) {
      return { id: existing.id, opened: false }
    }
    try {
      const created = await this.createFraudReviews({
        order_id: orderId,
        score,
        reasons: { reasons },
        status: "pending",
      })
      return { id: created.id, opened: true }
    } catch (error) {
      if (!uniqueViolationKeys(error)?.includes("order_id")) {
        throw error
      }
      return this.openReview(orderId, score, reasons)
    }
  }

  /**
   * Approves or rejects a pending review in one conditional statement: two
   * people deciding at once, one wins. The order it was, or null when it
   * was not pending.
   */
  @InjectTransactionManager()
  async decide(
    decision: Decision,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ order_id: string } | null> {
    const manager = sharedContext.transactionManager as EntityManager | undefined
    if (!manager) {
      throw new Error("fraud-guard: a decision runs in a transaction")
    }
    const now = new Date()
    const [row] = await manager.execute<{ order_id: string }[]>(
      `UPDATE fraud_review
       SET status = ?, decided_by = ?, decided_at = ?, note = ?, updated_at = ?
       WHERE id = ? AND status = 'pending' AND deleted_at IS NULL
       RETURNING order_id`,
      [decision.status, decision.by, now, decision.note ?? null, now, decision.id]
    )
    return row ?? null
  }

  /** Entries past their end, removed for good (KVKK: kept no longer than needed). How many. */
  @InjectTransactionManager()
  async pruneExpired(
    now: Date = new Date(),
    @MedusaContext() sharedContext: Context = {}
  ): Promise<number> {
    const manager = sharedContext.transactionManager as EntityManager | undefined
    if (!manager) {
      throw new Error("fraud-guard: pruning runs in a transaction")
    }
    const rows = await manager.execute<{ id: string }[]>(
      "DELETE FROM fraud_block WHERE expires_at IS NOT NULL AND expires_at < ? RETURNING id",
      [now]
    )
    return rows.length
  }

  /**
   * Why the order may not ship: it waits for a person, or a person turned
   * it down (it is cancelled through the usual cancel, with its refund).
   * Null when it is free to go.
   */
  async heldStatus(orderId: string): Promise<"pending" | "rejected" | null> {
    const [row] = await this.listFraudReviews(
      { order_id: orderId, status: ["pending", "rejected"] },
      { take: 1, select: ["status"] }
    )
    return row?.status === "pending" || row?.status === "rejected" ? row.status : null
  }
}

export default FraudGuardModuleService
