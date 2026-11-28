import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  deleteProductCategoriesWorkflow,
  deleteProductsWorkflow,
  updateProductCategoriesWorkflow,
} from "@medusajs/medusa/core-flows"
import { dropKeys, SAMPLE_OPENED_KEY } from "../../lib/sample-catalog/mark"
import { BOOKING_MODULE } from "../../modules/booking"
import type BookingModuleService from "../../modules/booking/service"
import { PRODUCT_REVIEWS_MODULE } from "../../modules/product-reviews"
import type ProductReviewsModuleService from "../../modules/product-reviews/service"

type Container = Pick<MedusaContainer, "resolve">

/** The departures of these products (their bookables' slots), by id. */
export async function slotIdsOf(container: Container, productIds: readonly string[]) {
  if (productIds.length === 0) {
    return []
  }
  const booking = container.resolve<BookingModuleService>(BOOKING_MODULE)
  const bookables = await booking.listBookables(
    { product_id: [...productIds] },
    { select: ["id"], take: null }
  )
  if (bookables.length === 0) {
    return []
  }
  const slots = await booking.listBookingSlots(
    { bookable_id: bookables.map((row) => row.id) },
    { select: ["id"], take: null }
  )
  return slots.map((slot) => slot.id)
}

/**
 * Sample products a load made, taken away again when the load fails or
 * is undone: their reviews, departures, then the products (Medusa's own
 * delete takes the variants, links and the booking settings with them).
 * Only ids the load itself made reach here; none has an order or a sale.
 */
export async function undoSampleProducts(
  container: MedusaContainer,
  productIds: readonly string[]
): Promise<void> {
  if (productIds.length === 0) {
    return
  }
  const reviews = container.resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
  const written = await reviews.listProductReviews(
    { product_id: [...productIds] },
    { select: ["id"], take: null }
  )
  await reviews.removeReviews(written.map((row) => row.id))
  const slots = await slotIdsOf(container, productIds)
  if (slots.length > 0) {
    await container.resolve<BookingModuleService>(BOOKING_MODULE).deleteEmptySlots(slots)
  }
  await deleteProductsWorkflow(container).run({ input: { ids: [...productIds] } })
}

/** Categories a load made, deleted (children first), and the ones it opened, hidden again. */
export async function undoSampleCategories(
  container: MedusaContainer,
  made: readonly string[],
  opened: readonly string[]
): Promise<void> {
  if (made.length > 0) {
    await deleteProductCategoriesWorkflow(container).run({ input: [...made].reverse() })
  }
  await setOpened(container, opened, false, "")
}

/**
 * Pack categories shown while samples are in them, or hidden again: one
 * save each through Medusa's workflow, so the catalog's hooks follow.
 */
export async function setOpened(
  container: MedusaContainer,
  ids: readonly string[],
  open: boolean,
  tag: string
): Promise<void> {
  for (const id of ids) {
    await updateProductCategoriesWorkflow(container).run({
      input: {
        selector: { id },
        update: {
          is_active: open,
          metadata: open ? { [SAMPLE_OPENED_KEY]: tag } : dropKeys([SAMPLE_OPENED_KEY]),
        },
      },
    })
  }
}

/** Whether the product module still has these products (a compensation runs once). */
export async function liveProductIds(container: Container, ids: readonly string[]) {
  if (ids.length === 0) {
    return []
  }
  const rows = await container
    .resolve(Modules.PRODUCT)
    .listProducts({ id: [...ids] }, { select: ["id"], take: null })
  return rows.map((row) => row.id)
}
