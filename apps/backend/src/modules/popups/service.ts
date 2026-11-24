import type { EntityManager } from "@medusajs/framework/mikro-orm/knex"
import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import { POPUP_EVENT_COLUMNS } from "../../lib/popups/rules"
import type { PopupEvent } from "../../lib/popups/rules"
import { Popup } from "./models/popup"

/** A pop-up's counts summed over the days asked for. */
export interface PopupCounts {
  impressions: number
  clicks: number
  closes: number
  signups: number
}

export interface PopupDayCounts extends PopupCounts {
  day: string
}

export const NO_COUNTS: Readonly<PopupCounts> = Object.freeze({
  impressions: 0,
  clicks: 0,
  closes: 0,
  signups: 0,
})

interface CountRow {
  impressions: string | number
  clicks: string | number
  closes: string | number
  signups: string | number
}

const countsOf = (row: CountRow): PopupCounts => ({
  impressions: Number(row.impressions),
  clicks: Number(row.clicks),
  closes: Number(row.closes),
  signups: Number(row.signups),
})

const managerOf = (context: Context, purpose: string): EntityManager => {
  const manager = (context.transactionManager ?? context.manager) as EntityManager | undefined
  if (!manager) {
    throw new Error(`popups: ${purpose} needs a manager`)
  }
  return manager
}

/**
 * Storefront pop-ups (adr/0080) and their daily counters. The counters'
 * table, `popup_metric` (bigint columns, one row per pop-up and day), is
 * the migration's own, not a data model: Medusa's model language has no
 * bigint, and the rows are only ever added to and summed, here.
 */
class PopupsModuleService extends MedusaService({ Popup }) {
  /**
   * Adds one to the day's counter of `event`: one statement, the day's row
   * made by the first, so two counts at once never lose one.
   */
  @InjectTransactionManager()
  async countEvent(
    popupId: string,
    day: string,
    event: PopupEvent,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    // The column comes from the fixed map, never from the request
    const column = POPUP_EVENT_COLUMNS[event]
    await managerOf(sharedContext, "a count").execute(
      `INSERT INTO popup_metric (popup_id, day, ${column}) VALUES (?, ?, 1)
       ON CONFLICT (popup_id, day)
       DO UPDATE SET ${column} = popup_metric.${column} + 1, updated_at = now()`,
      [popupId, day]
    )
  }

  /** Each pop-up's counts since `since` (a `YYYY-MM-DD` day, or all time when null). */
  @InjectManager()
  async totals(
    popupIds: readonly string[],
    since: string | null = null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Map<string, PopupCounts>> {
    const found = new Map<string, PopupCounts>()
    if (popupIds.length === 0) {
      return found
    }
    const rows = await managerOf(sharedContext, "the totals").execute<
      (CountRow & { popup_id: string })[]
    >(
      `SELECT popup_id, sum(impressions) AS impressions, sum(clicks) AS clicks,
              sum(closes) AS closes, sum(signups) AS signups
       FROM popup_metric
       WHERE popup_id IN (${popupIds.map(() => "?").join(", ")}) ${since ? "AND day >= ?" : ""}
       GROUP BY popup_id`,
      since ? [...popupIds, since] : [...popupIds]
    )
    rows.forEach((row) => found.set(row.popup_id, countsOf(row)))
    return found
  }

  /** One pop-up's counts day by day since `since`, oldest first; days without any are absent. */
  @InjectManager()
  async daily(
    popupId: string,
    since: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<PopupDayCounts[]> {
    const rows = await managerOf(sharedContext, "the days").execute<(CountRow & { day: string })[]>(
      `SELECT day, impressions, clicks, closes, signups FROM popup_metric
       WHERE popup_id = ? AND day >= ? ORDER BY day ASC`,
      [popupId, since]
    )
    return rows.map((row) => ({ day: row.day, ...countsOf(row) }))
  }
}

export default PopupsModuleService
