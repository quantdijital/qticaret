/**
 * What "Örnek içeriği kaldır" takes out (owner, 2026-11-28), decided from
 * rows read beforehand: pure, so the choices are tested apart from the
 * writes. Only sample records go; a sample product an order holds, whose
 * departure has a place sold or held, or that a customer wrote on (a
 * review, a question or an answer: deleting the product would leave them
 * pointing at nothing, deleting them is not this button's to do), stays
 * and is named; a sample category with anything of the shop's in it stays
 * and is named.
 */

export const SAMPLE_PARTS = ["products", "categories", "reviews"] as const
export type SamplePart = (typeof SAMPLE_PARTS)[number]

export interface SampleProductRow {
  id: string
  title: string
  /** An order line names it: never touched. */
  ordered: boolean
  /** A departure of it has a place sold or held by a cart. */
  booked: boolean
  /** Reviews (not the set's), questions and answers customers wrote on it. */
  customer_content: number
}

export interface CategoryRow {
  id: string
  name: string
  /** Made by the sample catalogue (`isSampleRecord`). */
  sample: boolean
  /** A pack category the sample catalogue opened: hidden again once empty. */
  opened: boolean
  is_active: boolean
  parent_id: string | null
  product_ids: readonly string[]
}

export interface ReviewRow {
  id: string
  product_id: string
}

export interface RemovalChoice {
  parts: readonly SamplePart[]
  /** Sample products the owner keeps (edited ones, say): left as they are. */
  keep_product_ids: readonly string[]
}

export type BlockReason = "ordered" | "booked" | "customer_content"
export type CategoryKeptReason = "own_products" | "samples_left" | "children"

export interface RemovalPlan {
  product_ids: string[]
  blocked: { id: string; title: string; reason: BlockReason; customer_content: number }[]
  /** What customers wrote on the sample products that stay for it ("müşteri içeriği var: N"). */
  customer_content: number
  review_ids: string[]
  category_ids: string[]
  categories_kept: { id: string; name: string; reason: CategoryKeptReason }[]
  /** Pack categories the samples opened, empty once the products go: hidden again. */
  hide_category_ids: string[]
}

/** Why a sample product stays whatever is chosen, or null when it may go. */
export const blockReason = (product: SampleProductRow): BlockReason | null =>
  product.ordered
    ? "ordered"
    : product.booked
      ? "booked"
      : product.customer_content > 0
        ? "customer_content"
        : null

/** The plan for a choice; every list holds ids the rows named, never one more. */
export function planRemoval(
  rows: {
    products: readonly SampleProductRow[]
    categories: readonly CategoryRow[]
    reviews: readonly ReviewRow[]
  },
  choice: RemovalChoice
): RemovalPlan {
  const parts = new Set(choice.parts)
  const keep = new Set(choice.keep_product_ids)
  const sampleIds = new Set(rows.products.map((product) => product.id))
  const blocked: RemovalPlan["blocked"] = []
  const going = new Set<string>()
  if (parts.has("products")) {
    for (const product of rows.products) {
      if (keep.has(product.id)) {
        continue
      }
      const reason = blockReason(product)
      if (reason) {
        blocked.push({
          id: product.id,
          title: product.title,
          reason,
          customer_content: product.customer_content,
        })
        continue
      }
      going.add(product.id)
    }
  }
  const review_ids = rows.reviews
    .filter((review) => parts.has("reviews") || going.has(review.product_id))
    .map((review) => review.id)

  // Children first: a category goes once its children have gone
  const removed = new Set<string>()
  const kept = new Map<string, CategoryKeptReason>()
  const samples = rows.categories.filter((category) => category.sample)
  const leftIn = (category: CategoryRow) => category.product_ids.filter((id) => !going.has(id))
  if (parts.has("categories")) {
    let changed = true
    while (changed) {
      changed = false
      for (const category of samples) {
        if (removed.has(category.id)) {
          continue
        }
        const left = leftIn(category)
        const children = rows.categories.filter(
          (child) => child.parent_id === category.id && !removed.has(child.id)
        )
        if (left.some((id) => !sampleIds.has(id))) {
          kept.set(category.id, "own_products")
        } else if (left.length > 0) {
          kept.set(category.id, "samples_left")
        } else if (children.length > 0) {
          kept.set(category.id, "children")
        } else {
          kept.delete(category.id)
          removed.add(category.id)
          changed = true
        }
      }
    }
  }
  const hide_category_ids = rows.categories
    .filter(
      (category) =>
        category.opened &&
        !category.sample &&
        category.is_active &&
        category.product_ids.some((id) => going.has(id)) &&
        leftIn(category).length === 0
    )
    .map((category) => category.id)
  return {
    product_ids: [...going],
    blocked,
    customer_content: blocked.reduce((sum, row) => sum + row.customer_content, 0),
    review_ids,
    category_ids: samples.filter((c) => removed.has(c.id)).map((c) => c.id),
    categories_kept: samples.flatMap((category) => {
      const reason = kept.get(category.id)
      return reason ? [{ id: category.id, name: category.name, reason }] : []
    }),
    hide_category_ids,
  }
}
