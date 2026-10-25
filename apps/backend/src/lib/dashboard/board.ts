import { LIFECYCLES, lifecycleOf } from "./lifecycle"
import type { Lifecycle, LifecycleOrder } from "./lifecycle"

/** The order list's tabs: every order, or one stage of its life. */
export const BOARD_STAGES = ["all", ...LIFECYCLES] as const
export type BoardStage = (typeof BOARD_STAGES)[number]

export interface BoardSlice {
  /** The asked page, in the order given, each with its stage. */
  page: { id: string; stage: Lifecycle }[]
  /** Orders in the asked stage. */
  count: number
  /** Orders per tab, for the counts beside them. */
  counts: Record<BoardStage, number>
}

/**
 * Sorts orders (newest first) into stages and cuts the asked page. The
 * stage is worked out from payment and shipment records, which the
 * database cannot filter on, so this runs on the orders read.
 */
export function boardSlice(
  orders: (LifecycleOrder & { id: string })[],
  stage: BoardStage,
  offset: number,
  limit: number
): BoardSlice {
  const counts = Object.fromEntries(BOARD_STAGES.map((key) => [key, 0])) as Record<
    BoardStage,
    number
  >
  const matching: BoardSlice["page"] = []
  for (const order of orders) {
    const lifecycle = lifecycleOf(order)
    counts.all += 1
    counts[lifecycle] += 1
    if (stage === "all" || stage === lifecycle) {
      matching.push({ id: order.id, stage: lifecycle })
    }
  }
  return { page: matching.slice(offset, offset + limit), count: matching.length, counts }
}
