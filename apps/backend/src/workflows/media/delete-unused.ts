import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { logger } from "../../lib/logging"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"
import { removeFiles } from "./files"
import type { DoomedMedia } from "./steps/library"
import { sortUnused } from "./unused"

interface SortedForDelete {
  doomed: DoomedMedia[]
  in_use: string[]
  missing: string[]
}

/** Which of the pictures nothing shows; the rest are kept and named. Reads only. */
const sortForDeleteStep = createStep("media-sort-unused", async (ids: string[], { container }) => {
  const sort = await sortUnused(container, ids)
  const sorted: SortedForDelete = {
    doomed: sort.unused.map((asset) => ({
      id: asset.id,
      file_id: asset.file_id,
      derivative_file_ids: asset.derivative_file_ids ?? [],
    })),
    in_use: sort.inUse,
    missing: sort.missing,
  }
  return new StepResponse(sorted)
})

/** The records leave the library first; all brought back if a later step fails. */
const softDeleteManyStep = createStep(
  "media-soft-delete-many",
  async (ids: string[], { container }) => {
    if (ids.length > 0) {
      await container.resolve<MediaModuleService>(MEDIA_MODULE).softDeleteMediaAssets(ids)
    }
    return new StepResponse(ids, ids)
  },
  async (ids, { container }) => {
    if (ids && ids.length > 0) {
      await container.resolve<MediaModuleService>(MEDIA_MODULE).restoreMediaAssets(ids)
    }
  }
)

/**
 * Each picture's files: its master (unless another record shares it) and
 * its versions. A picture whose files storage refuses comes back into the
 * library and is named, the others stay deleted; the last step, as files
 * cannot be put back.
 */
const removeManyFilesStep = createStep(
  "media-remove-many-files",
  async (doomed: DoomedMedia[], { container }) => {
    const media = container.resolve<MediaModuleService>(MEDIA_MODULE)
    const deleted: string[] = []
    const failed: string[] = []
    for (const asset of doomed) {
      const [sharing] = asset.file_id
        ? await media.listMediaAssets(
            { file_id: asset.file_id, id: { $ne: asset.id } },
            { select: ["id"], take: 1 }
          )
        : []
      const files = [
        ...(asset.file_id && !sharing ? [asset.file_id] : []),
        ...asset.derivative_file_ids,
      ]
      if (await removeFiles(container, files)) {
        deleted.push(asset.id)
      } else {
        failed.push(asset.id)
      }
    }
    if (failed.length > 0) {
      await media.restoreMediaAssets(failed)
      logger.warn({ event: "media.bulk_delete_files_kept", count: failed.length })
    }
    return new StepResponse({ deleted, failed })
  }
)

/**
 * Pictures deleted from the library at once (M1): only those nothing
 * shows go, checked on the server whatever the panel listed; one in use,
 * gone or not a stored file is kept and named (409 is for one picture,
 * the list answers each). Their records first, then their files.
 */
export const deleteUnusedMediaWorkflow = createWorkflow(
  "media-delete-unused",
  (input: { ids: string[] }) => {
    const sorted = sortForDeleteStep(transform({ input }, ({ input }) => input.ids))
    softDeleteManyStep(
      transform({ sorted }, ({ sorted }) => sorted.doomed.map((asset) => asset.id))
    )
    const removed = removeManyFilesStep(transform({ sorted }, ({ sorted }) => sorted.doomed))
    return new WorkflowResponse(
      transform({ sorted, removed }, ({ sorted, removed }) => ({
        deleted: removed.deleted,
        failed: removed.failed,
        in_use: sorted.in_use,
        missing: sorted.missing,
      }))
    )
  }
)
