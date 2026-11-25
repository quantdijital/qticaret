import { Inbox, MessageCircleQuestion, MessageSquareText, PackageX, Undo2 } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { PendingCounts } from "@/features/dashboard/api/pending"

/** One row of "Bekleyen işler": a count and the list it opens, filtered to what waits. */
export interface TaskRow {
  /** Its words: `dashboard.tasks.<key>.label` and `.hint`. */
  key: string
  icon: LucideIcon
  count: number
  to: string
  /** The list's filter in its address (`{ stage: "to_ship" }`, a settings page's `part`). */
  search?: Readonly<Record<string, string>>
  /** A count here needs the shop's attention (amber) rather than routine work. */
  urgent: boolean
}

/**
 * The rows of the lists the menu badges (docs/06 "Dashboard"), each only
 * while something waits in it and the person's role reads it (a null
 * count): reviews and questions to approve, return requests to decide,
 * contact messages not yet handled, sold-out stock.
 */
export function pendingRows(counts: PendingCounts | undefined): TaskRow[] {
  if (!counts) {
    return []
  }
  const rows: (Omit<TaskRow, "count"> & { count: number | null | undefined })[] = [
    {
      key: "openReturns",
      icon: Undo2,
      count: counts.open_returns,
      to: "/orders/returns",
      search: { view: "requested" },
      urgent: true,
    },
    {
      key: "unreadContact",
      icon: Inbox,
      count: counts.unread_contact,
      to: "/customers/contact-messages",
      search: { status: "new" },
      urgent: false,
    },
    {
      key: "pendingReviews",
      icon: MessageSquareText,
      count: counts.pending_reviews,
      to: "/reviews",
      search: { status: "pending" },
      urgent: false,
    },
    {
      key: "pendingQuestions",
      icon: MessageCircleQuestion,
      count: counts.pending_questions,
      to: "/reviews/questions",
      search: { status: "pending" },
      urgent: false,
    },
    {
      key: "outOfStock",
      icon: PackageX,
      count: counts.out_of_stock,
      to: "/inventory",
      search: { view: "out" },
      urgent: true,
    },
  ]
  return rows.flatMap((row) => (row.count ? [{ ...row, count: row.count }] : []))
}
