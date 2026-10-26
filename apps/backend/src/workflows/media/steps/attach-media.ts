import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"

/**
 * Readies the records joining a product (F3.3): an image added by URL alone
 * gets one (for its alt text; no master, no versions), and each is marked
 * attached the first time, after which its files are kept for the orders
 * that show it. Returns the records to link.
 */
export const attachMediaStep = createStep(
  "media-attach",
  async (input: { link: string[]; record: string[] }, { container }) => {
    const media = container.resolve<MediaModuleService>(MEDIA_MODULE)
    const created = input.record.length
      ? await media.createMediaAssets(input.record.map((url) => ({ url, file_id: null })))
      : []
    const ids = [...input.link, ...created.map((asset) => asset.id)]
    const unmarked = ids.length
      ? await media.listMediaAssets({ id: ids, attached_at: null }, { select: ["id"] })
      : []
    const now = new Date()
    if (unmarked.length > 0) {
      await media.updateMediaAssets(unmarked.map(({ id }) => ({ id, attached_at: now })))
    }
    return new StepResponse(ids, {
      created: created.map((asset) => asset.id),
      marked: unmarked.map(({ id }) => id),
    })
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const media = container.resolve<MediaModuleService>(MEDIA_MODULE)
    if (undo.marked.length > 0) {
      await media.updateMediaAssets(undo.marked.map((id) => ({ id, attached_at: null })))
    }
    if (undo.created.length > 0) {
      await media.deleteMediaAssets(undo.created)
    }
  }
)
