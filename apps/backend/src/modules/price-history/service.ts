import type { Context, InferTypeOf } from "@medusajs/framework/types"
import { InjectManager, MedusaContext, MedusaError, MedusaService } from "@medusajs/framework/utils"
import { PriceRecord } from "./models/price-record"

export type PriceRecordRow = InferTypeOf<typeof PriceRecord>
export type PriceRecordReason = PriceRecordRow["reason"]

export interface PriceRecordInput {
  variant_id: string
  currency_code: string
  /** Lira, as Medusa's amounts are (899.9). */
  amount: number
  original_amount: number
  price_list_id: string | null
  reason: PriceRecordReason
  recorded_at?: Date
}

/** The last price recorded for a variant in a currency, as lira strings. */
export interface LastPrice {
  variant_id: string
  currency_code: string
  amount: string
  original_amount: string
  price_list_id: string | null
}

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

// One binding per value: the driver spreads an array binding into a list
const placeholders = (values: readonly unknown[]) => values.map(() => "?").join(", ")

function refuseWrite(): never {
  throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "price records are append-only")
}

/**
 * The selling price history (F4.2, ADR-0023): records are appended and
 * read, never changed or taken back; each says what a price was from a
 * moment on.
 */
class PriceHistoryModuleService extends MedusaService({ PriceRecord }) {
  /** Each variant's last recorded price in each of these currencies; none before its first. */
  @InjectManager()
  async lastPrices(
    variantIds: string[],
    currencyCodes: string[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<LastPrice[]> {
    if (variantIds.length === 0 || currencyCodes.length === 0) {
      return []
    }
    const manager = sharedContext.manager as Executor
    return (await manager.execute(
      `SELECT DISTINCT ON (variant_id, currency_code)
              variant_id, currency_code, amount::text AS amount,
              original_amount::text AS original_amount, price_list_id
         FROM price_record
        WHERE deleted_at IS NULL
          AND variant_id IN (${placeholders(variantIds)})
          AND currency_code IN (${placeholders(currencyCodes)})
        ORDER BY variant_id, currency_code, seq DESC`,
      [...variantIds, ...currencyCodes]
    )) as LastPrice[]
  }

  /**
   * A variant's prices in a currency that applied from `since` on: the one
   * already in force then (its last record before), and every later one,
   * oldest first.
   */
  @InjectManager()
  async pricesSince(
    variantId: string,
    currencyCode: string,
    since: Date,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<PriceRecordRow[]> {
    const key = { variant_id: variantId, currency_code: currencyCode }
    const [inForce] = await this.listPriceRecords(
      { ...key, recorded_at: { $lt: since } },
      { order: { recorded_at: "DESC", seq: "DESC" }, take: 1 },
      sharedContext
    )
    const later = await this.listPriceRecords(
      { ...key, recorded_at: { $gte: since } },
      { order: { recorded_at: "ASC", seq: "ASC" } },
      sharedContext
    )
    return inForce ? [inForce, ...later] : later
  }

  async recordPrices(input: PriceRecordInput[]): Promise<PriceRecordRow[]> {
    if (input.length === 0) {
      return []
    }
    const now = new Date()
    return super.createPriceRecords(
      input.map((row) => ({ ...row, recorded_at: row.recorded_at ?? now }))
    )
  }

  // The generated writers stay unreachable: a record is never changed or removed
  override createPriceRecords = refuseWrite
  override updatePriceRecords = refuseWrite
  override deletePriceRecords = refuseWrite
  override softDeletePriceRecords = refuseWrite
  override restorePriceRecords = refuseWrite
}

export default PriceHistoryModuleService
