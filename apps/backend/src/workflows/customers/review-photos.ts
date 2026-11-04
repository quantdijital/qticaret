import type { MedusaContainer } from "@medusajs/framework/types"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../lib/errors"
import { errorSummary, logger } from "../../lib/logging"
import { prepareImage } from "../../lib/media"
import { PRODUCT_REVIEWS_MODULE } from "../../modules/product-reviews"
import type ProductReviewsModuleService from "../../modules/product-reviews/service"
import { removeFiles, storePublicFile } from "../media/files"
import { deliveredOrderOf, writeReview } from "./reviews"
import type { WriteReviewInput } from "./reviews"

type Container = Pick<MedusaContainer, "resolve">

const reviews = (container: Container) =>
  container.resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)

/** Uploads a customer may keep waiting for a review of one product: room for a few tries. */
export const PENDING_PHOTOS_MAX = 6

// An upload no review took within a day was left behind (a form closed)
export const ABANDONED_PHOTO_MS = 24 * 60 * 60 * 1000

export interface UploadReviewPhotoInput {
  customer_id: string
  product_id: string
  /** The bytes as sent, base64: a workflow's input travels as text. */
  content: string
}

/**
 * Only a customer who may review the product uploads for it (adr/0037 §4):
 * one who received it, with room left among their waiting uploads.
 */
const checkPhotoRoomStep = createStep(
  "review-photo-check-room",
  async (input: { customer_id: string; product_id: string }, { container }) => {
    const orderId = await deliveredOrderOf(container, input.customer_id, input.product_id)
    if (!orderId) {
      throw new ValidationError("reviews.not_purchased", { field: "product_id" })
    }
    const waiting = await reviews(container).listReviewImages(
      { customer_id: input.customer_id, product_id: input.product_id, review_id: null },
      { select: ["id"], take: PENDING_PHOTOS_MAX }
    )
    if (waiting.length >= PENDING_PHOTOS_MAX) {
      throw new ValidationError("reviews.photo_uploads_full", { field: "photo" })
    }
    return new StepResponse(undefined)
  }
)

/** The photo checked by its bytes and cleaned as any upload (docs/04, F3.3), then stored. */
const storeReviewPhotoStep = createStep(
  "review-photo-store",
  async (input: { content: string }, { container }) => {
    const image = await prepareImage(Buffer.from(input.content, "base64"), "yorum", "photo")
    const file = await storePublicFile(container, image.filename, image.mimeType, image.buffer)
    return new StepResponse(
      { file_id: file.id, url: file.url, width: image.width, height: image.height },
      file.id
    )
  },
  async (fileId, { container }) => {
    if (fileId) {
      await removeFiles(container, [fileId])
    }
  }
)

const recordReviewPhotoStep = createStep(
  "review-photo-record",
  async (
    input: {
      customer_id: string
      product_id: string
      file: { file_id: string; url: string; width: number; height: number }
    },
    { container }
  ) => {
    const photo = await reviews(container).createReviewImages({
      customer_id: input.customer_id,
      product_id: input.product_id,
      review_id: null,
      ...input.file,
    })
    return new StepResponse({ id: photo.id }, photo.id)
  },
  async (id, { container }) => {
    if (id) {
      await reviews(container).deleteReviewImages([id])
    }
  }
)

/**
 * A photo for a review the customer is writing (adr/0037 §4 Ek
 * 2026-11-04): checked, cleaned, stored and recorded as theirs, waiting
 * for the review to name it. Nobody sees it until the shop approves that
 * review; one no review takes is removed after a day.
 */
export const uploadReviewPhotoWorkflow = createWorkflow(
  "review-photo-upload",
  (input: UploadReviewPhotoInput) => {
    checkPhotoRoomStep(
      transform({ input }, ({ input }) => ({
        customer_id: input.customer_id,
        product_id: input.product_id,
      }))
    )
    const file = storeReviewPhotoStep(
      transform({ input }, ({ input }) => ({ content: input.content }))
    )
    const photo = recordReviewPhotoStep(
      transform({ input, file }, ({ input, file }) => ({
        customer_id: input.customer_id,
        product_id: input.product_id,
        file,
      }))
    )
    return new WorkflowResponse(photo)
  }
)

/**
 * Files of photos whose records are gone (a review written with others, a
 * sweep, an erasure). Last in its workflow: storage refusing is logged and
 * the file stays behind, never the record.
 */
export const removeReviewPhotoFilesStep = createStep(
  "review-photo-remove-files",
  async (fileIds: string[], { container }) => {
    if (fileIds.length > 0 && !(await removeFiles(container, fileIds))) {
      logger.warn({ event: "reviews.photo_files_kept", count: fileIds.length })
    }
    return new StepResponse(fileIds.length)
  }
)

const writeReviewStep = createStep(
  "reviews-write-review",
  async (input: WriteReviewInput, { container }) =>
    new StepResponse(await writeReview(container, input))
)

/**
 * F10.6: a customer's review written with its photos (adr/0037 §4 Ek
 * 2026-11-04), then the files of the photos it no longer shows removed.
 */
export const writeReviewWorkflow = createWorkflow("reviews-write", (input: WriteReviewInput) => {
  const written = writeReviewStep(input)
  removeReviewPhotoFilesStep(
    transform({ written }, ({ written }) => written.removed.map((photo) => photo.file_id))
  )
  return new WorkflowResponse(transform({ written }, ({ written }) => ({ id: written.id })))
})

/** Removes photos (records, then files): a sweep's, or an erased customer's (KVKK). */
export async function removeReviewPhotos(
  container: Container,
  filters: { customer_id: string } | { abandoned_before: Date }
): Promise<number> {
  const service = reviews(container)
  const rows = await service.listReviewImages(
    "customer_id" in filters
      ? { customer_id: filters.customer_id }
      : { review_id: null, created_at: { $lt: filters.abandoned_before } },
    { select: ["id", "file_id"], take: null }
  )
  if (rows.length === 0) {
    return 0
  }
  await service.deleteReviewImages(rows.map((row) => row.id))
  try {
    await removeFiles(
      container as MedusaContainer,
      rows.map((row) => row.file_id)
    )
  } catch (error) {
    logger.warn({ event: "reviews.photo_files_kept", err: errorSummary(error) })
  }
  return rows.length
}
