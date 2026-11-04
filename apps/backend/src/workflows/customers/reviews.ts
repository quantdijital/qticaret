import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { readsAsLink } from "../../lib/text/link-like"
import { PRODUCT_REVIEWS_MODULE } from "../../modules/product-reviews"
import type { RemovedPhoto } from "../../modules/product-reviews/photos"
import type ProductReviewsModuleService from "../../modules/product-reviews/service"

type Container = Pick<MedusaContainer, "resolve">

interface OrderRow {
  id: string
  status: string
  items?: ({
    product_id: string | null
    detail?: { delivered_quantity?: number | null } | null
  } | null)[]
}

/**
 * The customer's order in which the product was delivered: the proof a
 * review needs (adr/0037 §4). A canceled order, or one not delivered yet,
 * proves nothing.
 */
export async function deliveredOrderOf(
  container: Container,
  customerId: string,
  productId: string
): Promise<string | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "status", "items.product_id", "items.detail.delivered_quantity"],
    filters: { customer_id: customerId, is_draft_order: false },
    pagination: { take: 200, order: { created_at: "DESC" } },
  })
  const order = (data as OrderRow[]).find(
    (row) =>
      row.status !== "canceled" &&
      (row.items ?? []).some(
        (item) => item?.product_id === productId && (item.detail?.delivered_quantity ?? 0) > 0
      )
  )
  return order?.id ?? null
}

/** "Ayşe Y.": what the storefront shows of a review's author. */
export function authorNameOf(customer: { first_name: string | null; last_name: string | null }) {
  const first = customer.first_name?.trim() ?? ""
  const initial = customer.last_name?.trim().charAt(0).toLocaleUpperCase("tr") ?? ""
  const name = [first, initial ? `${initial}.` : ""].filter(Boolean).join(" ")
  return name === "" ? "Müşteri" : name.slice(0, 60)
}

export interface WriteReviewInput {
  customer_id: string
  product_id: string
  rating: number
  title: string | null
  body: string
  /** The author's photo uploads to show with it (adr/0037 §4 Ek 2026-11-04); left out: kept. */
  photo_ids?: string[] | undefined
}

/**
 * A signed-in customer's review of a product (F10.6, KK1): only for one
 * they received; written or changed, it waits for the shop, its photos
 * with it. The photos it drops come back for their files to go.
 */
export async function writeReview(
  container: Container,
  input: WriteReviewInput
): Promise<{ id: string; removed: RemovedPhoto[] }> {
  const orderId = await deliveredOrderOf(container, input.customer_id, input.product_id)
  if (!orderId) {
    throw new ValidationError("reviews.not_purchased", { field: "product_id" })
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: ["first_name", "last_name"],
    filters: { id: input.customer_id },
  })
  const customer = (data[0] ?? { first_name: null, last_name: null }) as {
    first_name: string | null
    last_name: string | null
  }
  return container.resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE).writeReview({
    product_id: input.product_id,
    customer_id: input.customer_id,
    order_id: orderId,
    rating: input.rating,
    title: input.title,
    body: input.body,
    author_name: authorNameOf(customer),
    has_link: readsAsLink(`${input.title ?? ""} ${input.body}`),
    ...(input.photo_ids === undefined ? {} : { photo_ids: input.photo_ids }),
  })
}
