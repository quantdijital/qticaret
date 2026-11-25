import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { errorSummary, logger } from "../../lib/logging"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"
import { removeFiles } from "./files"
import { isReferenced, readMediaReferences } from "./references"
import type { ReferencedAsset } from "./references"
import type { DoomedMedia } from "./steps/library"
import { sortUnused } from "./unused"

/** A picture to delete, with what the second check finds it by. */
type Doomed = DoomedMedia & ReferencedAsset

interface SortedForDelete {
  doomed: Doomed[]
  in_use: string[]
  missing: string[]
}

/** Which of the pictures nothing shows; the rest are kept and named. Reads only. */
const sortForDeleteStep = createStep("media-sort-unused", async (ids: string[], { container }) => {
  const sort = await sortUnused(container, ids)
  const sorted: SortedForDelete = {
    doomed: sort.unused.map((asset) => ({
      id: asset.id,
      url: asset.url,
      file_id: asset.file_id,
      derivatives: asset.derivatives,
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
 * Checked once more with the records already out of the library (so no
 * picker can take them any more): one something came to show between the
 * first check and the delete is brought back and named as in use.
 */
const recheckStep = createStep("media-recheck-unused", async (doomed: Doomed[], { container }) => {
  const references = await readMediaReferences(
    container,
    doomed.map((asset) => asset.id)
  )
  const taken = doomed.filter((asset) => isReferenced(asset, references)).map((a) => a.id)
  if (taken.length > 0) {
    await container.resolve<MediaModuleService>(MEDIA_MODULE).restoreMediaAssets(taken)
  }
  return new StepResponse({
    doomed: doomed.filter((asset) => !taken.includes(asset.id)),
    taken,
  })
})

/**
 * Each picture's files: its master (unless another record shares it) and
 * its versions, one picture at a time. A picture whose files cannot go
 * (storage refuses, a read fails) comes back into the library and is
 * named; the others stay deleted. The last step, as files cannot be put
 * back, and it never throws: a failure costs only its own picture.
 */
const removeManyFilesStep = createStep(
  "media-remove-many-files",
  async (doomed: Doomed[], { container }) => {
    const media = container.resolve<MediaModuleService>(MEDIA_MODULE)
    const deleted: string[] = []
    const failed: string[] = []
    for (const asset of doomed) {
      try {
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
          continue
        }
      } catch (error) {
        logger.warn({
          event: "media.bulk_delete_failed",
          mediaId: asset.id,
          err: errorSummary(error),
        })
      }
      failed.push(asset.id)
    }
    if (failed.length > 0) {
      try {
        await media.restoreMediaAssets(failed)
      } catch (error) {
        // Left soft deleted with their files: out of the library, nothing broken shown
        logger.error({ event: "media.bulk_delete_restore_failed", err: errorSummary(error) })
      }
      logger.warn({ event: "media.bulk_delete_files_kept", count: failed.length })
    }
    return new StepResponse({ deleted, failed })
  }
)

/**
 * Pictures deleted from the library at once (M1): only those nothing
 * shows go, checked on the server whatever the panel listed, and checked
 * again once out of the library; one in use, gone or not a stored file is
 * kept and named. Their records first, then their files.
 */
export const deleteUnusedMediaWorkflow = createWorkflow(
  "media-delete-unused",
  (input: { ids: string[] }) => {
    const sorted = sortForDeleteStep(transform({ input }, ({ input }) => input.ids))
    softDeleteManyStep(
      transform({ sorted }, ({ sorted }) => sorted.doomed.map((asset) => asset.id))
    )
    const checked = recheckStep(transform({ sorted }, ({ sorted }) => sorted.doomed))
    const removed = removeManyFilesStep(transform({ checked }, ({ checked }) => checked.doomed))
    return new WorkflowResponse(
      transform({ sorted, checked, removed }, ({ sorted, checked, removed }) => ({
        deleted: removed.deleted,
        failed: removed.failed,
        in_use: [...sorted.in_use, ...checked.taken],
        missing: sorted.missing,
      }))
    )
  }
)
