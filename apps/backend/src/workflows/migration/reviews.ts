import type { MedusaContainer } from "@medusajs/framework/types"
import type { SourceReview, StepProblem, StepProgress } from "../../lib/migration/types"
import { readsAsLink } from "../../lib/text/link-like"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import type { RememberedItem } from "../../modules/migration/service"
import { PRODUCT_REVIEWS_MODULE } from "../../modules/product-reviews"
import type ProductReviewsModuleService from "../../modules/product-reviews/service"
import { authorNameOf } from "../customers/reviews"

type Container = Pick<MedusaContainer, "resolve">

const BATCH = 200

export interface ReviewCounts {
  read: number
  /** Added (would be, in a dry run). */
  created: number
  /** Moved by a run before. */
  found: number
  skipped: number
}

/** "Ayşe Yılmaz" as the storefront names an author: "Ayşe Y.". */
function authorOf(author: string | null): string {
  const parts = (author ?? "").trim().split(/\s+/).filter(Boolean)
  return authorNameOf({
    first_name: parts.length > 1 ? parts.slice(0, -1).join(" ") : (parts[0] ?? null),
    last_name: parts.length > 1 ? (parts.at(-1) ?? null) : null,
  })
}

const emailKey = (email: string) => email.trim().toLowerCase()

/**
 * The old site's reviews here (F14, adr/0042): each to the product it
 * moved as, dated as it was written, its author named as the storefront
 * names one, and tied to the customer it moved as where the source names
 * them (so an erasure reaches it). Every rating moves, low ones too: the
 * shop's reviews are shown unpicked. One the old site was still holding
 * back waits here for the shop. A product that did not move takes none;
 * a second review by one customer of one product is left out. A dry run
 * counts the products the run would move as moved.
 */
export async function migrateReviews(
  container: Container,
  source: string,
  reviews: readonly SourceReview[],
  sourceProducts: ReadonlySet<string>,
  customerIds: ReadonlyMap<string, string>,
  apply: boolean,
  progress: StepProgress
): Promise<{ counts: ReviewCounts; problems: StepProblem[] }> {
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const service = container.resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
  const counts: ReviewCounts = { read: reviews.length, created: 0, found: 0, skipped: 0 }
  const problems: StepProblem[] = []
  // A customer's review of a product, by either key: one per pair
  const taken = new Set<string>()
  for (let start = 0; start < reviews.length; start += BATCH) {
    const batch = reviews.slice(start, start + BATCH)
    const [before, products] = await Promise.all([
      migration.targetsOf(
        source,
        "review",
        batch.map((review) => review.source_key)
      ),
      migration.targetsOf(source, "product", [
        ...new Set(batch.map((review) => review.product_source_key)),
      ]),
    ])
    const productOf = (review: SourceReview) => products.get(review.product_source_key)?.target_id
    const customerOf = (review: SourceReview) =>
      review.customer_email ? (customerIds.get(emailKey(review.customer_email)) ?? null) : null
    const linked = batch.filter((review) => productOf(review) && customerOf(review))
    const existing = linked.length
      ? await service.listProductReviews(
          {
            product_id: [...new Set(linked.map((review) => productOf(review) ?? ""))],
            customer_id: [...new Set(linked.map((review) => customerOf(review) ?? ""))],
          },
          { select: ["product_id", "customer_id"], take: null }
        )
      : []
    for (const row of existing) {
      taken.add(`${row.product_id}/${row.customer_id ?? ""}`)
    }
    const skipped: RememberedItem[] = []
    const fresh: { review: SourceReview; productId: string; customerId: string | null }[] = []
    for (const review of batch) {
      if (before.get(review.source_key)?.status === "done") {
        counts.found += 1
        continue
      }
      const productId = productOf(review) ?? null
      // A dry run made no product: one this run would move counts as moved
      const moves = productId !== null || (!apply && sourceProducts.has(review.product_source_key))
      if (!moves) {
        skipped.push({
          source_key: review.source_key,
          target_id: null,
          status: "skipped",
          error_code: "migration.review_product_missing",
        })
        continue
      }
      const customerId = customerOf(review)
      const pair = `${productId ?? review.product_source_key}/${customerId ?? ""}`
      if (customerId && taken.has(pair)) {
        skipped.push({
          source_key: review.source_key,
          target_id: null,
          status: "skipped",
          error_code: "migration.review_duplicate",
        })
        continue
      }
      if (customerId) {
        taken.add(pair)
      }
      fresh.push({ review, productId: productId ?? "", customerId })
    }
    counts.skipped += skipped.length
    problems.push(
      ...skipped.map((item) => ({ source_key: item.source_key, key: item.error_code ?? "" }))
    )
    counts.created += fresh.length
    if (apply) {
      const ids = await service.addMigratedReviews(
        fresh.map(({ review, productId, customerId }) => ({
          product_id: productId,
          customer_id: customerId,
          rating: review.rating,
          title: review.title,
          body: review.body,
          author_name: authorOf(review.author),
          has_link: readsAsLink(`${review.title ?? ""} ${review.body}`),
          published: review.published,
          created_at: review.created_at,
        }))
      )
      await migration.remember(source, "review", [
        ...fresh.map(({ review }, index) => ({
          source_key: review.source_key,
          target_id: ids[index] ?? null,
          status: "done" as const,
        })),
        ...skipped,
      ])
    }
    await progress(start + batch.length, reviews.length)
  }
  return { counts, problems }
}
