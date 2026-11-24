import type { MedusaContainer } from "@medusajs/framework/types"
import { containsPattern } from "../../lib/security"
import { popupState, promotionState } from "../../lib/popups/eligibility"
import type { PopupRecord, PopupState, PromotionState } from "../../lib/popups/eligibility"
import type { PopupType } from "../../lib/popups/rules"
import { POPUPS_MODULE } from "../../modules/popups"
import type PopupsModuleService from "../../modules/popups/service"
import { NO_COUNTS } from "../../modules/popups/service"
import type { PopupCounts, PopupDayCounts } from "../../modules/popups/service"
import { readPopup } from "./steps"
import { promotionsById } from "./promotions"

type Container = Pick<MedusaContainer, "resolve">

/** The days the detail's counts go back. */
export const DAILY_DAYS = 30

/**
 * A pop-up as the panel reads it (adr/0080 §5): every field, where it
 * stands now (`state`; a campaign's promotion read live) and its counts
 * all time.
 */
export interface AdminPopup extends PopupRecord {
  created_at: string
  updated_at: string
  state: PopupState
  /** A campaign pop-up's promotion: its code and whether it takes orders now; null otherwise. */
  promotion: { id: string; code: string | null; state: PromotionState } | null
  counts: PopupCounts
}

export interface AdminPopupDetail extends AdminPopup {
  /** The last `DAILY_DAYS` days with any count, oldest first. */
  daily: PopupDayCounts[]
}

const popups = (container: Container) => container.resolve<PopupsModuleService>(POPUPS_MODULE)

const dayOf = (when: Date) => when.toISOString().slice(0, 10)

async function described(
  container: Container,
  rows: readonly PopupRecord[],
  now: Date
): Promise<AdminPopup[]> {
  const [promotions, counts] = await Promise.all([
    promotionsById(
      container,
      rows.flatMap((row) => (row.promotion_id ? [row.promotion_id] : []))
    ),
    popups(container).totals(rows.map((row) => row.id)),
  ])
  return rows.map((row) => {
    const promotion = row.promotion_id ? (promotions.get(row.promotion_id) ?? null) : null
    const promoState = row.type === "campaign" ? promotionState(promotion, now) : null
    return {
      ...(row as AdminPopup),
      state: popupState(row, promoState, now),
      promotion:
        row.type === "campaign" && row.promotion_id
          ? { id: row.promotion_id, code: promotion?.code ?? null, state: promoState ?? "missing" }
          : null,
      counts: counts.get(row.id) ?? { ...NO_COUNTS },
    }
  })
}

export interface PopupListQuery {
  q?: string | undefined
  type?: PopupType | undefined
  offset: number
  limit: number
}

/** The panel's list: by name, newest first. */
export async function readPopups(
  container: Container,
  query: PopupListQuery,
  now: Date = new Date()
): Promise<{ popups: AdminPopup[]; count: number; offset: number; limit: number }> {
  const filters: Record<string, unknown> = {}
  if (query.q) {
    filters["name"] = { $ilike: containsPattern(query.q) }
  }
  if (query.type) {
    filters["type"] = query.type
  }
  const [rows, count] = await popups(container).listAndCountPopups(filters, {
    order: { created_at: "DESC" },
    skip: query.offset,
    take: query.limit,
  })
  return {
    popups: await described(container, rows as unknown as PopupRecord[], now),
    count,
    offset: query.offset,
    limit: query.limit,
  }
}

/** One pop-up with its last days' counts; 404 when there is none. */
export async function readPopupDetail(
  container: Container,
  id: string,
  now: Date = new Date()
): Promise<AdminPopupDetail> {
  const row = await readPopup(container, id)
  const since = dayOf(new Date(now.getTime() - (DAILY_DAYS - 1) * 24 * 60 * 60 * 1000))
  const [[popup], daily] = await Promise.all([
    described(container, [row], now),
    popups(container).daily(id, since),
  ])
  if (!popup) {
    throw new Error("popups: the record read was not described")
  }
  return { ...popup, daily }
}
