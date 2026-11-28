import { readFile } from "node:fs/promises"
import path from "node:path"
import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules, ProductStatus } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import type { SampleProduct } from "@qticaret/sector-packs"
import type { AttributeInputValue } from "../../modules/product-attributes/validation"
import { PRODUCT_REVIEWS_MODULE } from "../../modules/product-reviews"
import type ProductReviewsModuleService from "../../modules/product-reviews/service"
import { createBookingSlotsWorkflow, setBookableWorkflow } from "../../workflows/booking/admin"
import { setProgramWorkflow } from "../../workflows/booking/program"
import { setProductCatalogWorkflow } from "../../workflows/catalog/set-product-catalog"
import { storePublicFile } from "../../workflows/media/files"
import { deriveProductMediaWorkflow, registerMediaWorkflow } from "../../workflows/media/workflows"
import { upsertProductAttributesWorkflow } from "../../workflows/product-attributes/upsert-product-attributes"
import { Program } from "../booking/program"
import { summaryDocOfText } from "../catalog/summary"
import type { ContentDoc } from "../content/doc"
import { prepareImage } from "../media"
import { SAMPLE_KEY, sampleMark, sampleReviewRef } from "./mark"

const DAY_MS = 24 * 60 * 60 * 1000
// The shop's currency: a Turkish shop sells in lira (bootstrap sets it)
const CURRENCY = "try"
// A departure at nine in the morning, Istanbul time
const DEPARTURE_HOUR_UTC = 6
const CANCELLATION_TIERS = [
  { days_before: 14, fee_percent: 0 },
  { days_before: 7, fee_percent: 50 },
  { days_before: 0, fee_percent: 100 },
]

export interface SampleContext {
  container: MedusaContainer
  /** `<pack>@<version>`: written into every record's mark. */
  tag: string
  /** The `samples` folder: an image `images/x.webp` is read from beside it. */
  dir: string
  salesChannelId: string | null
  categoryIds: ReadonlyMap<string, string>
  /** The pack's attribute templates here, by handle (one the shop removed is not). */
  templateIds: ReadonlyMap<string, string>
  now: Date
}

/** Plain paragraphs as the editor's document (adr/0055). */
export const docOfParagraphs = (text: string): ContentDoc =>
  ({
    type: "doc",
    content: text
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => ({ type: "paragraph", content: [{ type: "text", text: part }] })),
  }) as unknown as ContentDoc

/** A picture of the set, brought in as an upload is: checked, cleaned, stored, recorded. */
async function uploadImage(context: SampleContext, file: string, name: string): Promise<string> {
  const bytes = await readFile(path.join(context.dir, file))
  const image = await prepareImage(bytes, `${name}${path.extname(file)}`, "image")
  const stored = await storePublicFile(
    context.container,
    image.filename,
    image.mimeType,
    image.buffer
  )
  const { result } = await registerMediaWorkflow(context.container).run({
    input: { file_ids: [stored.id], library: false, uploaded_by: null },
  })
  const asset = result[0]
  if (!asset) {
    throw new Error(`sample-catalog: ${file} was not registered`)
  }
  return asset.url
}

/** The product as Medusa makes it, published, priced in lira, in the shop's sales channel. */
async function createProduct(
  context: SampleContext,
  product: SampleProduct,
  handle: string,
  urls: readonly string[]
): Promise<string> {
  const { result } = await createProductsWorkflow(context.container).run({
    input: {
      products: [
        {
          title: product.title,
          handle,
          status: ProductStatus.PUBLISHED,
          metadata: { [SAMPLE_KEY]: context.tag },
          category_ids: product.categories.flatMap((each) => {
            const id = context.categoryIds.get(each)
            return id ? [id] : []
          }),
          options: product.options,
          variants: product.variants.map((variant) => ({
            title: product.options.map((option) => variant.options[option.title]).join(" / "),
            options: variant.options,
            manage_inventory: false,
            prices: [{ currency_code: CURRENCY, amount: variant.price }],
          })),
          images: urls.map((url) => ({ url })),
          ...(urls[0] ? { thumbnail: urls[0] } : {}),
          ...(context.salesChannelId ? { sales_channels: [{ id: context.salesChannelId }] } : {}),
        },
      ],
    },
  })
  const id = result[0]?.id
  if (!id) {
    throw new Error(`sample-catalog: ${handle} was not made`)
  }
  return id
}

/** Its departures, settings and program (adr/0076, adr/0078), as the panel saves them. */
async function setBooking(
  context: SampleContext,
  product: SampleProduct,
  productId: string
): Promise<void> {
  const booking = product.booking
  if (!booking) {
    return
  }
  const variants = await context.container
    .resolve(Modules.PRODUCT)
    .listProductVariants({ product_id: productId }, { select: ["id", "title"] })
  const child = booking.child_value
    ? variants.find((variant) => variant.title.includes(booking.child_value ?? ""))
    : undefined
  await setBookableWorkflow(context.container).run({
    input: {
      product_id: productId,
      settings: {
        timezone: "Europe/Istanbul",
        sale_mode: booking.sale_mode,
        ...(booking.min_participants ? { min_participants: booking.min_participants } : {}),
        ...(child ? { pax_by_variant: { [child.id]: { pax: 1, min_age: 2, max_age: 11 } } } : {}),
        cancellation_tiers: CANCELLATION_TIERS,
      },
    },
  })
  const day = new Date(context.now)
  day.setUTCHours(DEPARTURE_HOUR_UTC, 0, 0, 0)
  await createBookingSlotsWorkflow(context.container).run({
    input: {
      product_id: productId,
      slots: booking.departures.map((departure) => ({
        starts_at: new Date(day.getTime() + departure.in_days * DAY_MS),
        capacity: departure.capacity,
      })),
    },
  })
  if (booking.program) {
    const program = Program.parse({
      unit: booking.program.unit,
      steps: booking.program.steps.map((step) => ({
        label: step.label,
        title: step.title,
        body: step.text ? docOfParagraphs(step.text) : null,
        tags: step.tags,
      })),
    })
    await setProgramWorkflow(context.container).run({ input: { product_id: productId, program } })
  }
}

/** The set's reviews, as reviews brought from elsewhere are: approved, dated, no order behind. */
async function addReviews(
  context: SampleContext,
  product: SampleProduct,
  productId: string
): Promise<void> {
  if (product.reviews.length === 0) {
    return
  }
  await context.container
    .resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
    .addMigratedReviews(
      product.reviews.map((review, index) => ({
        source_ref: sampleReviewRef(context.tag, product.handle, index),
        product_id: productId,
        customer_id: null,
        rating: review.rating,
        title: null,
        body: review.body,
        author_name: review.author,
        has_link: false,
        published: true,
        created_at: new Date(context.now.getTime() - review.days_ago * DAY_MS),
      }))
    )
}

/**
 * One sample product, made as the panel makes one: its pictures first,
 * Medusa's create, then its kind and texts, attribute values, departures
 * and program, reviews, and last its mark with its own id. Its id is
 * handed to `made` as soon as it exists, so a failure later removes it.
 */
export async function writeSampleProduct(
  context: SampleContext,
  product: SampleProduct,
  handle: string,
  made: (id: string) => void
): Promise<string> {
  const urls: string[] = []
  for (const [index, file] of product.images.entries()) {
    urls.push(await uploadImage(context, file, `${handle}-${String(index + 1)}`))
  }
  const id = await createProduct(context, product, handle, urls)
  made(id)
  await deriveProductMediaWorkflow(context.container).run({ input: { product_id: id } })
  const primary = context.categoryIds.get(product.categories[0] ?? "")
  const summary = product.summary ? summaryDocOfText(product.summary) : null
  await setProductCatalogWorkflow(context.container).run({
    input: {
      product_id: id,
      ...(product.booking ? { kind: "service" as const, booking_mode: "departure" as const } : {}),
      ...(primary ? { primary_category_id: primary } : {}),
      description_doc: docOfParagraphs(product.description),
      ...(summary ? { summary_doc: summary } : {}),
    },
  })
  const templateId = product.template ? context.templateIds.get(product.template) : undefined
  if (templateId) {
    await upsertProductAttributesWorkflow(context.container).run({
      input: {
        product_id: id,
        template_id: templateId,
        values: product.attributes as Record<string, AttributeInputValue>,
      },
    })
  }
  await setBooking(context, product, id)
  await addReviews(context, product, id)
  await context.container
    .resolve(Modules.PRODUCT)
    .updateProducts(id, { metadata: sampleMark(context.tag, id, new Date()) })
  return id
}
