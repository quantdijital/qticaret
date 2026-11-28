import type { IOrderModuleService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { BOOKING_MODULE } from "../../modules/booking"
import type BookingModuleService from "../../modules/booking/service"
import { PRODUCT_REVIEWS_MODULE } from "../../modules/product-reviews"
import type ProductReviewsModuleService from "../../modules/product-reviews/service"
import { PRODUCT_QA_MODULE } from "../../modules/product-qa"
import type ProductQaModuleService from "../../modules/product-qa/service"
import {
  SAMPLE_KEY,
  SAMPLE_OPENED_KEY,
  SAMPLE_REVIEW_PREFIX,
  isEditedSample,
  isSampleRecord,
  isSampleReviewRef,
  packOfTag,
} from "./mark"
import { unfinishedLoadJobs } from "./load-job"
import type { CategoryRow, ReviewRow, SampleProductRow } from "./plan"

type Container = Pick<MedusaContainer, "resolve">
type Metadata = Record<string, unknown> | null

// Products read this many at a time, everything before anything is written
const PAGE = 500

export interface SampleProduct extends SampleProductRow {
  handle: string
  thumbnail: string | null
  /** The set it came from (`travel`). */
  pack: string
  edited: boolean
}

interface ProductRow {
  id: string
  title: string
  handle: string
  thumbnail?: string | null
  metadata?: Metadata
  updated_at?: Date | string | null
}

/** Every product of the shop that carries a sample mark of its own; and whether any other exists. */
async function markedProducts(
  container: Container,
  unfinished: ReadonlySet<string>
): Promise<{ samples: ProductRow[]; others: number }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const samples: ProductRow[] = []
  let others = 0
  for (let skip = 0; ; skip += PAGE) {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "title", "handle", "thumbnail", "metadata", "updated_at"],
      pagination: { skip, take: PAGE, order: { created_at: "ASC" } },
    })
    const rows = data as unknown as ProductRow[]
    for (const row of rows) {
      if (isSampleRecord(row, unfinished)) {
        samples.push(row)
      } else {
        others += 1
      }
    }
    if (rows.length < PAGE) {
      break
    }
  }
  return { samples, others }
}

/** The products an order line names: never touched. */
async function orderedProductIds(container: Container, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) {
    return new Set()
  }
  const lines = await container
    .resolve<IOrderModuleService>(Modules.ORDER)
    .listOrderLineItems({ product_id: ids }, { select: ["id", "product_id"], take: null })
  return new Set(lines.flatMap((line) => (line.product_id ? [line.product_id] : [])))
}

/** The products a departure of which has a place sold or held by a cart. */
async function bookedProductIds(container: Container, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) {
    return new Set()
  }
  const booking = container.resolve<BookingModuleService>(BOOKING_MODULE)
  const bookables = await booking.listBookables(
    { product_id: ids },
    { select: ["id", "product_id"], take: null }
  )
  if (bookables.length === 0) {
    return new Set()
  }
  const productOf = new Map(bookables.map((row) => [row.id, row.product_id]))
  const slots = await booking.listBookingSlots(
    { bookable_id: [...productOf.keys()] },
    { select: ["bookable_id", "sold", "held"], take: null }
  )
  return new Set(
    slots
      .filter((slot) => slot.sold > 0 || slot.held > 0)
      .flatMap((slot) => {
        const product = productOf.get(slot.bookable_id)
        return product ? [product] : []
      })
  )
}

/**
 * How much a customer wrote on each product (reviews not from the set,
 * questions and answers of customers), any state: a sample product with
 * some stays (security review 2026-11-28, D6).
 */
async function customerContent(container: Container, ids: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (ids.length === 0) {
    return counts
  }
  const qa = container.resolve<ProductQaModuleService>(PRODUCT_QA_MODULE)
  const [reviews, questions, answers] = await Promise.all([
    container
      .resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
      .listProductReviews(
        { product_id: ids },
        { select: ["product_id", "source_ref"], take: null }
      ),
    qa.listProductQuestions(
      { product_id: ids, author_kind: "customer" },
      { select: ["product_id"], take: null }
    ),
    qa.listProductAnswers(
      { product_id: ids, author_kind: "customer" },
      { select: ["product_id"], take: null }
    ),
  ])
  const rows = [
    ...reviews.filter((review) => !isSampleReviewRef(review.source_ref)),
    ...questions,
    ...answers,
  ]
  for (const row of rows) {
    counts.set(row.product_id, (counts.get(row.product_id) ?? 0) + 1)
  }
  return counts
}

export interface SampleRows {
  products: SampleProduct[]
  categories: CategoryRow[]
  reviews: ReviewRow[]
  /** Products of the shop's own (not samples). */
  own_products: number
}

interface CategoryGraphRow {
  id: string
  name: string
  is_active: boolean
  parent_category_id?: string | null
  metadata?: Metadata
  products?: ({ id: string } | null)[] | null
}

/**
 * What the sample catalogue made here, read whole: its products (each
 * with whether an order or a sold place holds it), every category it
 * made or opened with the products in it, and its reviews.
 */
export async function readSampleRows(container: Container): Promise<SampleRows> {
  const unfinished = await unfinishedLoadJobs(container)
  const { samples, others } = await markedProducts(container, unfinished)
  const ids = samples.map((row) => row.id)
  const [ordered, booked, written] = await Promise.all([
    orderedProductIds(container, ids),
    bookedProductIds(container, ids),
    customerContent(container, ids),
  ])
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_category",
    fields: ["id", "name", "is_active", "parent_category_id", "metadata", "products.id"],
  })
  const categories = (data as unknown as CategoryGraphRow[]).map((row): CategoryRow => ({
    id: row.id,
    name: row.name,
    sample: isSampleRecord(row, unfinished),
    opened: packOfTag(row.metadata?.[SAMPLE_OPENED_KEY]) !== null,
    is_active: row.is_active,
    parent_id: row.parent_category_id ?? null,
    product_ids: (row.products ?? []).flatMap((product) => (product ? [product.id] : [])),
  }))
  const sampleCategoryIds = new Set(categories.filter((row) => row.sample).map((row) => row.id))
  const reviews = await container
    .resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
    .listProductReviews(
      { source_ref: { $like: `${SAMPLE_REVIEW_PREFIX}%` } },
      { select: ["id", "product_id"], take: null }
    )
  return {
    products: samples.map((row) => ({
      id: row.id,
      title: row.title,
      handle: row.handle,
      thumbnail: row.thumbnail ?? null,
      pack: packOfTag(row.metadata?.[SAMPLE_KEY]) ?? "",
      edited: isEditedSample(row),
      ordered: ordered.has(row.id),
      booked: booked.has(row.id),
      customer_content: written.get(row.id) ?? 0,
    })),
    // A sample category, one the samples opened, or a child of a sample one (the shop's
    // own child keeps its parent): the others are not this feature's
    categories: categories.filter(
      (category) =>
        category.sample ||
        category.opened ||
        (category.parent_id !== null && sampleCategoryIds.has(category.parent_id))
    ),
    reviews: reviews.map((review) => ({ id: review.id, product_id: review.product_id })),
    own_products: others,
  }
}
