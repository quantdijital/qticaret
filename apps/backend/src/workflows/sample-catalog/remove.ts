import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  deleteProductCategoriesWorkflow,
  deleteProductsWorkflow,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { logger } from "../../lib/logging"
import { SAMPLE_OPENED_KEY } from "../../lib/sample-catalog/mark"
import { planRemoval } from "../../lib/sample-catalog/plan"
import type { RemovalChoice, RemovalPlan } from "../../lib/sample-catalog/plan"
import { readSampleRows } from "../../lib/sample-catalog/read"
import { BOOKING_MODULE } from "../../modules/booking"
import type BookingModuleService from "../../modules/booking/service"
import type { SlotInput } from "../../modules/booking/slots"
import { PRODUCT_REVIEWS_MODULE } from "../../modules/product-reviews"
import type ProductReviewsModuleService from "../../modules/product-reviews/service"
import { SAMPLE_LOCK } from "./load"
import { setOpened, slotIdsOf } from "./undo"

export interface SampleRemovalPlan extends RemovalPlan {
  slot_ids: string[]
}

/** The plan, read whole before anything goes (`planRemoval`). */
export const planSampleRemovalStep = createStep(
  "sample-catalog-plan-removal",
  async (choice: RemovalChoice, { container }) => {
    const plan = planRemoval(await readSampleRows(container), choice)
    return new StepResponse<SampleRemovalPlan>({
      ...plan,
      slot_ids: await slotIdsOf(container, plan.product_ids),
    })
  }
)

/** The planned reviews soft-deleted, each product's rating counted again; an undo restores them. */
export const removeSampleReviewsStep = createStep(
  "sample-catalog-remove-reviews",
  async (ids: string[], { container }) => {
    const removed = await container
      .resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
      .removeReviews(ids)
    return new StepResponse(removed.length, removed)
  },
  async (removed, { container }) => {
    if (!removed?.length) {
      return
    }
    await container
      .resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
      .restoreReviews(removed)
  }
)

/**
 * The going products' departures removed, only while nothing is sold or
 * held on them (the booking module's own delete); one a cart took a place
 * on meanwhile stops the run. An undo makes the removed ones again.
 */
export const removeSampleSlotsStep = createStep(
  "sample-catalog-remove-slots",
  async (ids: string[], { container }) => {
    const booking = container.resolve<BookingModuleService>(BOOKING_MODULE)
    if (ids.length === 0) {
      return new StepResponse(0, [] as SlotInput[])
    }
    const rows = await booking.listBookingSlots(
      { id: ids },
      {
        select: [
          "id",
          "bookable_id",
          "starts_at",
          "ends_at",
          "capacity",
          "status",
          "price_adjustments",
        ],
        take: null,
      }
    )
    const gone = new Set(await booking.deleteEmptySlots(ids))
    const removed: SlotInput[] = rows
      .filter((row) => gone.has(row.id))
      .map((row) => ({
        bookable_id: row.bookable_id,
        starts_at: new Date(row.starts_at),
        ends_at: row.ends_at ? new Date(row.ends_at) : null,
        capacity: row.capacity,
        status: row.status,
        price_adjustments: (row.price_adjustments as Record<string, number> | null) ?? null,
      }))
    if (gone.size < ids.length) {
      // A place taken since the plan was read: nothing of this run stays done
      await booking.createSlots(removed)
      throw new ValidationError("sample_catalog.booked_meanwhile")
    }
    return new StepResponse(gone.size, removed)
  },
  async (removed, { container }) => {
    if (!removed?.length) {
      return
    }
    await container.resolve<BookingModuleService>(BOOKING_MODULE).createSlots(
      removed.map((row) => ({
        ...row,
        starts_at: new Date(row.starts_at),
        ends_at: row.ends_at ? new Date(row.ends_at) : null,
      }))
    )
  }
)

/** Pack categories the samples opened, empty now: hidden again; an undo shows them. */
export const hideOpenedCategoriesStep = createStep(
  "sample-catalog-hide-opened",
  async (ids: string[], { container }) => {
    if (ids.length === 0) {
      return new StepResponse(0, [] as { id: string; tag: string }[])
    }
    const rows = await container
      .resolve(Modules.PRODUCT)
      .listProductCategories({ id: ids }, { select: ["id", "metadata"], take: null })
    const before = rows.map((row) => ({
      id: row.id,
      tag:
        typeof row.metadata?.[SAMPLE_OPENED_KEY] === "string"
          ? row.metadata[SAMPLE_OPENED_KEY]
          : "",
    }))
    await setOpened(container, ids, false, "")
    return new StepResponse(ids.length, before)
  },
  async (before, { container }) => {
    for (const row of before ?? []) {
      await setOpened(container, [row.id], true, row.tag)
    }
  }
)

export interface RemoveSampleCatalogResult {
  products: number
  categories: number
  reviews: number
  categories_hidden: number
  blocked: RemovalPlan["blocked"]
  categories_kept: RemovalPlan["categories_kept"]
}

/**
 * "Örnek içeriği kaldır" (owner, 2026-11-28): the chosen parts of what the
 * sample catalogue made, and nothing else. Reviews, departures, products
 * (Medusa's delete, with variants, links and booking settings), sample
 * categories left empty, then the opened pack categories hidden again;
 * any step failing puts the ones before back. One run at a time, the
 * load's lock shared.
 */
export const removeSampleCatalogWorkflow = createWorkflow(
  "sample-catalog-remove",
  (input: RemovalChoice) => {
    acquireLockStep({ key: SAMPLE_LOCK, timeout: 5, ttl: 300 })
    const plan = planSampleRemovalStep(input)
    const reviews = removeSampleReviewsStep(transform({ plan }, ({ plan }) => plan.review_ids))
    removeSampleSlotsStep(transform({ plan }, ({ plan }) => plan.slot_ids))
    when("sample-catalog-products-going", { plan }, ({ plan }) => plan.product_ids.length > 0).then(
      () => {
        deleteProductsWorkflow.runAsStep({
          input: transform({ plan }, ({ plan }) => ({ ids: plan.product_ids })),
        })
      }
    )
    when(
      "sample-catalog-categories-going",
      { plan },
      ({ plan }) => plan.category_ids.length > 0
    ).then(() => {
      deleteProductCategoriesWorkflow.runAsStep({
        input: transform({ plan }, ({ plan }) => plan.category_ids),
      })
    })
    hideOpenedCategoriesStep(transform({ plan }, ({ plan }) => plan.hide_category_ids))
    releaseLockStep({ key: SAMPLE_LOCK })
    const result = transform({ plan, reviews }, ({ plan, reviews }): RemoveSampleCatalogResult => {
      const summary = {
        products: plan.product_ids.length,
        categories: plan.category_ids.length,
        reviews,
        categories_hidden: plan.hide_category_ids.length,
        blocked: plan.blocked,
        categories_kept: plan.categories_kept,
      }
      logger.info(
        {
          event: "sample_catalog.removed",
          products: summary.products,
          categories: summary.categories,
          reviews: summary.reviews,
          blocked: summary.blocked.length,
        },
        "sample catalogue removed"
      )
      return summary
    })
    return new WorkflowResponse(result)
  }
)
