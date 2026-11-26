import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/**
 * `GET /admin/dashboard/pending`: what waits in the lists the menu badges,
 * counts only; null where the person's role may not read the list.
 */
export interface PendingCounts {
  /** Reviews waiting for approval (`/reviews?status=pending`). */
  pending_reviews: number | null
  /** Questions, or their answers, waiting for approval (`/reviews/questions?status=pending`). */
  pending_questions: number | null
  /** Return and exchange requests waiting for a decision (`/orders/returns?view=requested`). */
  open_returns: number | null
  /** Contact messages not yet handled (`/customers/contact-messages?status=new`). */
  unread_contact: number | null
  /** Stock records sold out (`/inventory?view=out`). */
  out_of_stock: number | null
}

export const pendingQuery = () =>
  queryOptions({
    queryKey: ["dashboard", "pending"],
    queryFn: () => sdk.client.fetch<PendingCounts>("/admin/dashboard/pending"),
    // The server holds the counts as long; the menu asks on every page
    staleTime: 30_000,
  })

/** The menu items' badges: what waits under each (an item's lists summed). */
export function pendingBadges(counts: PendingCounts | undefined): Record<string, number> {
  if (!counts) {
    return {}
  }
  return {
    reviews: (counts.pending_reviews ?? 0) + (counts.pending_questions ?? 0),
    customers: counts.unread_contact ?? 0,
    inventory: counts.out_of_stock ?? 0,
  }
}
