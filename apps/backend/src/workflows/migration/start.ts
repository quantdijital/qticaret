import { Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import type { PackageDefaults } from "../../lib/migration/types"
import { enqueueAsyncJobWorkflow } from "../async-job/enqueue-async-job"

export interface StartMigrationInput {
  source: "bundle" | "shopify"
  /** A bundle: the uploaded file, stored private under the migration's prefix. */
  source_file_id: string | null
  mode: "check" | "apply"
  defaults: PackageDefaults | null
  requested_by: string | null
}

/** Owns the uploaded file until its job does: a queue that refuses it deletes it (customers are in it). */
const ownFileStep = createStep(
  "migration-own-file",
  (fileId: string | null) => new StepResponse(fileId, fileId),
  async (fileId: string | null | undefined, { container }) => {
    if (fileId) {
      await container.resolve(Modules.FILE).deleteFiles(fileId)
    }
  }
)

/**
 * Queues a migration, or its dry run (F14, adr/0042 §9): one at a time and
 * never beside a catalog import or bulk edit (they write products too); a
 * queue that refuses it leaves no file behind.
 */
export const startMigrationWorkflow = createWorkflow(
  "migration-start",
  (input: StartMigrationInput) => {
    ownFileStep(input.source_file_id)
    const job = enqueueAsyncJobWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => ({
        type: "migration.run",
        input: {
          source: input.source,
          ...(input.source_file_id ? { source_file_id: input.source_file_id } : {}),
          mode: input.mode,
          defaults: input.defaults,
        },
        requested_by: input.requested_by,
      })),
    })
    return new WorkflowResponse(job)
  }
)
