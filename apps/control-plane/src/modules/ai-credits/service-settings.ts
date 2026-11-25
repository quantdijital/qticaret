import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  generateEntityId,
} from "@medusajs/framework/utils"
import { AI_DAILY_CAP_DEFAULT, AI_PURCHASED_LIFETIME_MONTHS } from "../../lib/ai-credits/settings"
import { ID_MAX, requiredLine } from "./inputs"
import { STALE, isStale, platformValues, rowsOf } from "./sql"
import type { Executor, PlatformValues, Stale, WalletClock } from "./sql"
import { AiCreditOrders } from "./service-orders"

/** The settings row as stored; `packs` and `routing` are checked by the caller (lib). */
export interface AiCreditSettingRow {
  daily_cap: number
  purchased_lifetime_months: number
  packs: unknown
  routing: unknown
  updated_by: string | null
  updated_at: Date | null
}

/** The values a save writes, all of them (the caller merges a partial change first). */
export interface AiCreditSettingValues {
  daily_cap: number
  purchased_lifetime_months: number
  packs: readonly unknown[]
  routing: Readonly<Record<string, unknown>>
}

const SETTING_COLUMNS =
  "daily_cap, purchased_lifetime_months, packs, routing, updated_by, updated_at"

/** The highest day's cap a wallet or the platform may set (the migration's check too). */
export const DAILY_CAP_MAX = 1_000_000

const DEFAULT_ROW: AiCreditSettingRow = Object.freeze({
  daily_cap: AI_DAILY_CAP_DEFAULT,
  purchased_lifetime_months: AI_PURCHASED_LIFETIME_MONTHS,
  packs: [],
  routing: {},
  updated_by: null,
  updated_at: null,
})

function dailyCapOf(value: number | null): number | null {
  if (value !== null && (!Number.isSafeInteger(value) || value < 0 || value > DAILY_CAP_MAX)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "cp.ai_credit_daily_cap_invalid")
  }
  return value
}

/**
 * The platform's settings (one row, adr/0085 K6, K7, K11, §2) and a
 * shop's own day's cap. A save runs as one transaction on the locked row:
 * the row is made with the defaults if there is none, locked, read
 * (`before`), then `change` decides the new values from it, so two saves
 * at once apply one after the other (a key's removal clearing its routing
 * never loses a save made meanwhile).
 */
export class AiCreditSettings extends AiCreditOrders {
  /** The row; the defaults (`updated_at` null) while none was saved. */
  @InjectManager()
  async platformSettings(
    @MedusaContext() sharedContext: Context = {}
  ): Promise<AiCreditSettingRow> {
    const [row] = await rowsOf<AiCreditSettingRow>(
      sharedContext.manager as Executor,
      `SELECT ${SETTING_COLUMNS} FROM ai_credit_setting WHERE key = 'platform' AND deleted_at IS NULL`,
      []
    )
    return row ?? { ...DEFAULT_ROW }
  }

  /** The day's cap and the bought credits' life a wallet's change reads now. */
  @InjectManager()
  async platformValuesNow(@MedusaContext() sharedContext: Context = {}): Promise<PlatformValues> {
    return await platformValues(sharedContext.manager as Executor)
  }

  @InjectTransactionManager()
  async changePlatformSettings(
    change: (before: AiCreditSettingRow) => AiCreditSettingValues,
    actor: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ before: AiCreditSettingRow; after: AiCreditSettingRow }> {
    const manager = sharedContext.transactionManager as Executor
    const by = requiredLine(actor, ID_MAX, "actor")
    await manager.execute(
      `INSERT INTO ai_credit_setting
         (id, key, daily_cap, purchased_lifetime_months, packs, routing, created_at, updated_at)
       VALUES (?, 'platform', ?, ?, '[]'::jsonb, '{}'::jsonb, now(), now())
       ON CONFLICT (key) WHERE deleted_at IS NULL DO NOTHING`,
      [generateEntityId(undefined, "aiset"), AI_DAILY_CAP_DEFAULT, AI_PURCHASED_LIFETIME_MONTHS]
    )
    const [locked] = await rowsOf<AiCreditSettingRow>(
      manager,
      `SELECT ${SETTING_COLUMNS} FROM ai_credit_setting
        WHERE key = 'platform' AND deleted_at IS NULL FOR UPDATE`,
      []
    )
    const before = locked ?? { ...DEFAULT_ROW }
    const next = change(before)
    const [after] = await rowsOf<AiCreditSettingRow>(
      manager,
      `UPDATE ai_credit_setting
          SET daily_cap = ?, purchased_lifetime_months = ?, packs = ?::jsonb, routing = ?::jsonb,
              updated_by = ?, updated_at = now()
        WHERE key = 'platform' AND deleted_at IS NULL
        RETURNING ${SETTING_COLUMNS}`,
      [
        dailyCapOf(next.daily_cap),
        next.purchased_lifetime_months,
        JSON.stringify(next.packs),
        JSON.stringify(next.routing),
        by,
      ]
    )
    if (!after) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "cp.ai_credit_setting_missing")
    }
    return { before, after }
  }

  /**
   * A shop's own day's cap (K7), or null for the platform's. The wallet is
   * made current first (created on its first touch, like any change).
   */
  @InjectTransactionManager()
  async setDailyCap(
    tenantId: string,
    cap: number | null,
    clock: WalletClock,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ before: number | null; after: number | null } | Stale> {
    const manager = sharedContext.transactionManager as Executor
    const value = dailyCapOf(cap)
    const wallet = await this.touch(manager, tenantId, clock)
    if (isStale(wallet)) {
      return STALE
    }
    await manager.execute(
      `UPDATE ai_credit_wallet SET daily_cap = ?, updated_at = now()
        WHERE tenant_id = ? AND deleted_at IS NULL`,
      [value, tenantId]
    )
    return { before: wallet.daily_cap, after: value }
  }
}
