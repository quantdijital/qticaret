import { Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { enqueueAsyncJobWorkflow } from "../../async-job/enqueue-async-job"

export interface StartImportInput {
  /** The uploaded sheet, stored private under the import's prefix. */
  source_file_id: string
  mode: "check" | "apply"
  requested_by: string | null
}

/** Owns the uploaded sheet until its job does: a queue that refuses it deletes it. */
const ownSheetStep = createStep(
  "catalog-import-own-sheet",
  (fileId: string) => new StepResponse(fileId, fileId),
  async (fileId: string | undefined, { container }) => {
    if (fileId) {
      await container.resolve(Modules.FILE).deleteFiles(fileId)
    }
  }
)

/**
 * Queues the import of a stored sheet (F3.9): one at a time (the job type
 * is a singleton); a queue that refuses it (another import queued or
 * running) leaves no file behind.
 */
export const startCatalogImportWorkflow = createWorkflow(
  "catalog-start-import",
  (input: StartImportInput) => {
    ownSheetStep(input.source_file_id)
    const job = enqueueAsyncJobWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => ({
        type: "catalog.import",
        input: { source_file_id: input.source_file_id, mode: input.mode },
        requested_by: input.requested_by,
      })),
    })
    return new WorkflowResponse(job)
  }
)
