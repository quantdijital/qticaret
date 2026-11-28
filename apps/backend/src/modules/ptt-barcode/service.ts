import type { EntityManager } from "@medusajs/framework/mikro-orm/knex"
import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import {
  PTT_SERIAL,
  barcodesLow,
  pttBarcodeOf,
  rangeSize,
  serialOf,
} from "../../lib/shipping/ptt/barcode"
import { PttBarcodeRange } from "./models/ptt-barcode-range"

interface RangeRow {
  id: string
  first_number: string
  last_number: string
  next_number: string
  created_at: Date | string
}

/** A range as the panel shows it. */
export interface PttRangeView {
  id: string
  first: string
  last: string
  /** How many numbers it holds, and how many were handed out. */
  size: number
  used: number
  remaining: number
  created_at: string
}

export interface PttRangesView {
  ranges: PttRangeView[]
  /** Numbers left in every range, and how many they held. */
  remaining: number
  total: number
  /** Few enough left to ask PTT for a new range (a warning, never a stop). */
  low: boolean
}

export type PttAllocation =
  | { status: "ok"; barcode: string; remaining: number }
  | { status: "missing" }
  | { status: "exhausted" }

// One range larger than this is a typing slip, not what PTT hands out
export const MAX_RANGE = 1_000_000

const TABLE = "ptt_barcode_range"

const remainingOf = (row: RangeRow): number =>
  Math.max(0, Number(row.last_number) - Number(row.next_number) + 1)

const viewOf = (row: RangeRow): PttRangeView => {
  const size = rangeSize(row.first_number, row.last_number)
  const remaining = remainingOf(row)
  return {
    id: row.id,
    first: row.first_number,
    last: row.last_number,
    size,
    used: size - remaining,
    remaining,
    created_at: new Date(row.created_at).toISOString(),
  }
}

const managerOf = (context: Context, what: string): EntityManager => {
  const manager = context.transactionManager as EntityManager | undefined
  if (!manager) {
    throw new Error(`ptt-barcode: ${what} runs in a transaction`)
  }
  return manager
}

/**
 * The shop's PTT barcode ranges (docs/entegrasyonlar/ptt.md). Handing out
 * a number locks every range for the transaction, so two parcels shipped
 * at once never get the same one; adding or removing a range locks the
 * table against both. Ranges are used oldest first.
 */
class PttBarcodeModuleService extends MedusaService({ PttBarcodeRange }) {
  /** The ranges, oldest first, with what is left. */
  @InjectManager()
  async overview(@MedusaContext() sharedContext: Context = {}): Promise<PttRangesView> {
    const rows = (await this.listPttBarcodeRanges(
      {},
      { order: { created_at: "ASC" } },
      sharedContext
    )) as unknown as RangeRow[]
    const ranges = rows.map(viewOf)
    const remaining = ranges.reduce((sum, range) => sum + range.remaining, 0)
    const total = ranges.reduce((sum, range) => sum + range.size, 0)
    return { ranges, remaining, total, low: ranges.length > 0 && barcodesLow(remaining, total) }
  }

  /** The next barcode (with its check digit), taken for good; why none when there is none. */
  @InjectTransactionManager()
  async allocate(@MedusaContext() sharedContext: Context = {}): Promise<PttAllocation> {
    const manager = managerOf(sharedContext, "a barcode")
    const rows = await manager.execute<RangeRow[]>(
      `SELECT id, first_number, last_number, next_number, created_at FROM ${TABLE}
       WHERE deleted_at IS NULL ORDER BY created_at, id FOR UPDATE`
    )
    if (rows.length === 0) {
      return { status: "missing" }
    }
    const open = rows.find((row) => remainingOf(row) > 0)
    if (!open) {
      return { status: "exhausted" }
    }
    const number = Number(open.next_number)
    const moved = await manager.execute<{ id: string }[]>(
      `UPDATE ${TABLE} SET next_number = ?, updated_at = now()
       WHERE id = ? AND next_number = ? RETURNING id`,
      [serialOf(number + 1), open.id, open.next_number]
    )
    // Under the row lock it always moves; were it not to, the number is not handed out
    if (moved.length !== 1) {
      throw new Error("ptt-barcode: the range moved under its lock")
    }
    const remaining = rows.reduce((sum, row) => sum + remainingOf(row), 0) - 1
    return { status: "ok", barcode: pttBarcodeOf(serialOf(number)), remaining }
  }

  /** A new range; refused when malformed, too large or overlapping one the shop has. */
  @InjectTransactionManager()
  async addRange(
    input: { first: string; last: string },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ id: string }> {
    const { first, last } = input
    if (!PTT_SERIAL.test(first) || !PTT_SERIAL.test(last)) {
      throw new ValidationError("ptt.barcode_range_invalid", { field: "first" })
    }
    if (Number(last) < Number(first)) {
      throw new ValidationError("ptt.barcode_range_reversed", { field: "last" })
    }
    if (rangeSize(first, last) > MAX_RANGE) {
      throw new ValidationError("ptt.barcode_range_too_large", { field: "last" })
    }
    const manager = managerOf(sharedContext, "a new range")
    // Against a range added at the same time; reads go on, handing out waits
    await manager.execute(`LOCK TABLE ${TABLE} IN EXCLUSIVE MODE`)
    const rows = await manager.execute<RangeRow[]>(
      // Removed ranges too: a number of a range set aside is never handed out again
      `SELECT id, first_number, last_number FROM ${TABLE}`
    )
    const overlaps = rows.some(
      (row) => Number(first) <= Number(row.last_number) && Number(row.first_number) <= Number(last)
    )
    if (overlaps) {
      throw new ValidationError("ptt.barcode_range_overlaps", { field: "first" })
    }
    const created = await this.createPttBarcodeRanges(
      { first_number: first, last_number: last, next_number: first },
      sharedContext
    )
    return { id: created.id }
  }

  /**
   * Removes a range no number of which was handed out (a typing slip); one
   * in use stays, so its numbers are never handed out again. The removed
   * range, for an undo.
   */
  @InjectTransactionManager()
  async removeRange(
    id: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ id: string; first: string; last: string } | null> {
    const manager = managerOf(sharedContext, "a removal")
    await manager.execute(`LOCK TABLE ${TABLE} IN EXCLUSIVE MODE`)
    const [row] = await manager.execute<RangeRow[]>(
      `SELECT id, first_number, last_number, next_number, created_at FROM ${TABLE}
       WHERE id = ? AND deleted_at IS NULL`,
      [id]
    )
    if (!row) {
      return null
    }
    if (row.next_number !== row.first_number) {
      throw new ValidationError("ptt.barcode_range_in_use")
    }
    await manager.execute(`DELETE FROM ${TABLE} WHERE id = ? AND next_number = first_number`, [id])
    return { id: row.id, first: row.first_number, last: row.last_number }
  }
}

export default PttBarcodeModuleService
