import type { EntityManager } from "@medusajs/framework/mikro-orm/knex"
import type { RatingDistribution } from "./types"

/**
 * The reviews module's own statements (F10.6, adr/0037 §4), run on the
 * manager the service's method was given: a moderation decided in one
 * conditional statement, and the stars counted in the database.
 */

/**
 * Approves or rejects one review as staff saw it; null when its author
 * changed it since (`updated_at` moved), so new text never goes out on an
 * approval of the old (security review 2026-10-29).
 */
export async function decideReview(
  manager: EntityManager,
  review: { id: string; updated_at: string },
  decision: { status: "approved" | "rejected"; by: string; reason?: string | null },
  now: Date
): Promise<{ id: string; product_id: string } | null> {
  const [row] = await manager.execute<{ id: string; product_id: string }[]>(
    `UPDATE product_review
     SET status = ?, reject_reason = ?, moderated_by = ?, moderated_at = ?, updated_at = ?
     WHERE id = ? AND updated_at = ? AND deleted_at IS NULL
     RETURNING id, product_id`,
    [
      decision.status,
      decision.status === "rejected" ? (decision.reason ?? null) : null,
      decision.by,
      now,
      now,
      review.id,
      new Date(review.updated_at),
    ]
  )
  return row ?? null
}

/**
 * How many approved reviews of the product gave each number of stars
 * (adr/0046 Ek 2026-11-04): one grouped count over the product's approved
 * reviews (indexed by product and status).
 */
export async function starCounts(
  manager: EntityManager,
  productId: string
): Promise<RatingDistribution> {
  const rows = await manager.execute<{ rating: number; count: string | number }[]>(
    `SELECT rating, count(*) AS count FROM product_review
     WHERE product_id = ? AND status = 'approved' AND deleted_at IS NULL
     GROUP BY rating`,
    [productId]
  )
  const counts: RatingDistribution = { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 }
  for (const row of rows) {
    const stars = String(row.rating) as keyof RatingDistribution
    if (stars in counts) {
      counts[stars] = Number(row.count)
    }
  }
  return counts
}

/** How many approved reviews each product has per number of stars: the shop-wide spread's rows. */
export async function approvedStarCounts(
  manager: EntityManager
): Promise<{ product_id: string; rating: number; count: number }[]> {
  const rows = await manager.execute<
    { product_id: string; rating: number; count: string | number }[]
  >(
    `SELECT product_id, rating, count(*) AS count FROM product_review
     WHERE status = 'approved' AND deleted_at IS NULL
     GROUP BY product_id, rating`
  )
  // `count(*)` comes back as a string from Postgres
  return rows.map((row) => ({ ...row, count: Number(row.count) }))
}
