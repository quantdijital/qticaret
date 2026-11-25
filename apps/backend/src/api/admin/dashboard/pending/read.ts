import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createTtlCache } from "../../../../lib/cache"
import { stockSlice } from "../../../../lib/dashboard"
import type { StockRow } from "../../../../lib/dashboard"
import { decide } from "../../../../lib/staff"
import type { StaffRole } from "../../../../lib/staff"
import { lowStockThresholds } from "../../../../lib/stock"
import { CONTACT_MESSAGES_MODULE } from "../../../../modules/contact-messages"
import type ContactMessagesModuleService from "../../../../modules/contact-messages/service"
import { PRODUCT_QA_MODULE } from "../../../../modules/product-qa"
import type ProductQaModuleService from "../../../../modules/product-qa/service"
import { PRODUCT_REVIEWS_MODULE } from "../../../../modules/product-reviews"
import type ProductReviewsModuleService from "../../../../modules/product-reviews/service"
import { RETURN_REQUESTS_MODULE } from "../../../../modules/return-requests"
import type ReturnRequestsModuleService from "../../../../modules/return-requests/service"

// Stock records read at most, as the stock list and the dashboard's tasks (docs/04)
const MAX_ITEMS_READ = 2000
// Answers waiting for a decision read at most, for the questions they belong to
const MAX_ANSWERS_READ = 1000

/** Each count beside the list it opens: a role that may not read the list gets no number. */
const LISTS = {
  pending_reviews: "/admin/product-reviews",
  pending_questions: "/admin/product-questions",
  open_returns: "/admin/return-requests",
  unread_contact: "/admin/contact-messages",
  out_of_stock: "/admin/stock-board",
} as const

type PendingKey = keyof typeof LISTS
export type PendingCounts = Record<PendingKey, number | null>

/** The counts, read at most every 30 seconds whoever asks (the menu asks on every page). */
const cache = createTtlCache<Record<PendingKey, number>>({ ttlMs: 30_000, maxEntries: 1 })

async function outOfStock(scope: MedusaContainer): Promise<number> {
  const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "inventory_item",
    fields: ["id", "location_levels.stocked_quantity", "location_levels.reserved_quantity"],
    pagination: { skip: 0, take: MAX_ITEMS_READ, order: { created_at: "DESC" } },
  })
  const rows = data as StockRow[]
  const thresholds = await lowStockThresholds(
    scope,
    rows.map((row) => row.id)
  )
  // The stock list's own "Tükenen" view, so the number matches the list it opens
  return stockSlice(rows, "out", 0, 0, thresholds.of).counts.out
}

/** Questions waiting: their own decision or an answer's, as the questions list's "Bekleyen". */
async function pendingQuestions(qa: ProductQaModuleService): Promise<number> {
  const answers = await qa.listProductAnswers(
    { status: "pending" },
    { take: MAX_ANSWERS_READ, select: ["question_id"] }
  )
  const [, count] = await qa.listAndCountProductQuestions(
    {
      $or: [{ status: "pending" }, { id: [...new Set(answers.map((row) => row.question_id))] }],
    },
    { select: ["id"], take: 1 }
  )
  return count
}

async function loadCounts(scope: MedusaContainer): Promise<Record<PendingKey, number>> {
  const reviews = scope.resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
  const qa = scope.resolve<ProductQaModuleService>(PRODUCT_QA_MODULE)
  const returns = scope.resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
  const contact = scope.resolve<ContactMessagesModuleService>(CONTACT_MESSAGES_MODULE)
  const [[, pendingReviews], questions, [, openReturns], [, unread], out] = await Promise.all([
    reviews.listAndCountProductReviews({ status: "pending" }, { select: ["id"], take: 1 }),
    pendingQuestions(qa),
    // A request waiting for the shop's decision: the return queue's first view
    returns.listAndCountReturnRequests({ status: "requested" }, { select: ["id"], take: 1 }),
    contact.listAndCountContactMessages({ status: "new" }, { select: ["id"], take: 1 }),
    outOfStock(scope),
  ])
  return {
    pending_reviews: pendingReviews,
    pending_questions: questions,
    open_returns: openReturns,
    unread_contact: unread,
    out_of_stock: out,
  }
}

/**
 * What waits in the lists the menu badges (docs/06 "Dashboard"): reviews
 * and questions to moderate, return requests to decide, contact messages
 * not yet handled, sold-out stock. Counts only, no personal data; each
 * one null for a role its list is closed to (adr/0040), every one for a
 * user without a role.
 */
export async function readPendingCounts(
  scope: MedusaContainer,
  role: StaffRole | null
): Promise<PendingCounts> {
  if (role === null) {
    return Object.fromEntries(
      (Object.keys(LISTS) as PendingKey[]).map((key) => [key, null])
    ) as PendingCounts
  }
  const counts = await cache("counts", () => loadCounts(scope))
  return Object.fromEntries(
    (Object.keys(LISTS) as PendingKey[]).map((key) => [
      key,
      decide(role, "GET", LISTS[key]).allowed ? counts[key] : null,
    ])
  ) as PendingCounts
}

/** Forgets the held counts (tests that change what is waiting). */
export const clearPendingCounts = (): void => {
  cache.clear()
}
