import type { MedusaContainer } from "@medusajs/framework/types"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, emitEventStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { programImageUrls } from "../../lib/booking/program"
import type { ProgramType } from "../../lib/booking/program"
import { ValidationError } from "../../lib/errors"
import { refuseSvgImages } from "../../lib/media/svg-use"
import { BOOKING_MODULE } from "../../modules/booking"
import type BookingModuleService from "../../modules/booking/service"
import { CATALOG_PRODUCT_SAVED } from "../catalog/events"
import { ensureBookableStep } from "./steps/bookable"

type Container = Pick<MedusaContainer, "resolve">

// The JSON column is typed as an object; a program is one
type BookableWrite = Parameters<BookingModuleService["updateBookables"]>[0]

/**
 * Refuses a program whose pictures are not the shop's uploads (the media
 * library's images, never an outside address or an SVG): checked by the
 * workflow, not the request's schema, which only reads the address.
 */
export async function checkProgramImages(container: Container, program: ProgramType) {
  const urls = programImageUrls(program)
  if (urls.length === 0) {
    return
  }
  await refuseSvgImages(container, urls, "steps")
  const found = await container
    .resolve<MediaModuleService>(MEDIA_MODULE)
    .listMediaAssets({ url: urls, file_id: { $ne: null } }, { select: ["url", "mime_type"] })
  const uploads = new Set(
    found.filter((asset) => asset.mime_type?.startsWith("image/")).map((asset) => asset.url)
  )
  if (urls.some((url) => !uploads.has(url))) {
    throw new ValidationError("booking.program_image_unknown", { field: "steps" })
  }
}

/** What a save writes: the program, or null when it has no steps. */
export const storedProgram = (program: ProgramType): ProgramType | null =>
  program.steps.length === 0 ? null : program

/**
 * A dated product's program written whole (adr/0078); undone by writing
 * back the one before.
 */
export const setProgramStep = createStep(
  "booking-set-program",
  async (input: { bookable_id: string; program: ProgramType }, { container }) => {
    await checkProgramImages(container, input.program)
    const service = container.resolve<BookingModuleService>(BOOKING_MODULE)
    const current = await service.retrieveBookable(input.bookable_id, { select: ["id", "program"] })
    const previous = (current as { program?: unknown }).program ?? null
    await service.updateBookables({
      id: input.bookable_id,
      program: storedProgram(input.program),
    } as unknown as BookableWrite)
    return new StepResponse(input.bookable_id, { id: input.bookable_id, previous })
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    await container
      .resolve<BookingModuleService>(BOOKING_MODULE)
      .updateBookables({ id: undo.id, program: undo.previous } as unknown as BookableWrite)
  }
)

/**
 * A dated product's program saved, under the product's lock (the same as
 * its settings'); its settings row made with the defaults if it has none.
 * The product's saved event follows, so the advisor and the search index
 * read it again.
 */
export const setProgramWorkflow = createWorkflow(
  "booking-set-program",
  (input: { product_id: string; program: ProgramType }) => {
    const lockKey = transform({ input }, ({ input }) => `booking:product:${input.product_id}`)
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 30 })
    const bookable = ensureBookableStep({ product_id: input.product_id })
    const id = setProgramStep(
      transform({ input, bookable }, ({ input, bookable }) => ({
        bookable_id: bookable.id,
        program: input.program,
      }))
    )
    const saved = transform({ input }, ({ input }) => ({ id: input.product_id }))
    emitEventStep({ eventName: CATALOG_PRODUCT_SAVED, data: saved })
    releaseLockStep({ key: lockKey })
    return new WorkflowResponse(id)
  }
)
