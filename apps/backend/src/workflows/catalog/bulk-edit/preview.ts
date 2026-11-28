import type { MedusaContainer } from "@medusajs/framework/types"
import { chunksOf } from "../../../lib/catalog"
import { serverErrorMessage } from "../../../lib/errors/messages"
import { publishGate } from "../../seo/advisor/publish-gate"
import type { BulkChange } from "./change"
import { planContext } from "./context"
import { planBulkChange } from "./plan"
import { endsBooking } from "./plan-kind"
import { bulkProducts } from "./products"
import { problemOf } from "./report"
import type { BulkOutcome, BulkProblem } from "./report"

/** What a bulk change would do, before it is applied: nothing is written. */
export interface BulkPreview {
  products: number
  changed: number
  unchanged: number
  skipped: number
  problems: BulkProblem[]
  /**
   * A kind change's: the dated products it takes off dated sale, for the
   * warning the product page asks before the same (adr/0076 Ek D2).
   */
  booking_off?: number
}

// Products read with their variants at a time
const CHUNK = 100

/**
 * The products named planned as the run would plan them (the same checks
 * and reasons, the publish gate included), nothing written and nothing
 * made: a tag still to be made counts as taken by every product. The run
 * plans each product again just before it writes, so its counts may
 * differ when the catalogue changes in between.
 */
export async function previewBulkEdit(
  container: MedusaContainer,
  input: { product_ids: string[]; change: BulkChange }
): Promise<BulkPreview> {
  const { change } = input
  const context = await planContext(container, change, false)
  const isBlocked =
    change.action === "status" && change.status === "published"
      ? await publishGate(container)
      : null
  const preview: BulkPreview = {
    products: input.product_ids.length,
    changed: 0,
    unchanged: 0,
    skipped: 0,
    problems: [],
    ...(change.action === "kind" ? { booking_off: 0 } : {}),
  }
  const count = (
    product: { handle: string; title: string | null },
    outcome: BulkOutcome,
    key: string | null
  ) => {
    preview[
      outcome === "changed" ? "changed" : outcome === "unchanged" ? "unchanged" : "skipped"
    ] += 1
    const problem = problemOf(
      preview.problems,
      product,
      outcome,
      key ? serverErrorMessage(key, "tr") : null
    )
    if (problem) {
      preview.problems.push(problem)
    }
  }
  for (const chunk of chunksOf(input.product_ids, CHUNK)) {
    const found = new Map(
      (await bulkProducts(container, chunk, change.action)).map((product) => [product.id, product])
    )
    for (const id of chunk) {
      const product = found.get(id)
      if (!product) {
        count({ handle: id, title: null }, "skipped", "bulk_edit.product_missing")
        continue
      }
      const plan = planBulkChange(product, change, context)
      if (plan.kind === "skipped") {
        count(product, "skipped", plan.key)
      } else if (plan.kind === "unchanged") {
        count(product, "unchanged", null)
      } else if (isBlocked && (await isBlocked(product.id))) {
        count(product, "skipped", "seo.publish_gate_blocked")
      } else {
        count(product, "changed", null)
        if (preview.booking_off !== undefined && endsBooking(plan)) {
          preview.booking_off += 1
        }
      }
    }
  }
  return preview
}
