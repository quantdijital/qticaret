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
  source: "bundle" | "shopify" | "feed" | "customers" | "wordpress"
  /** A bundle or WordPress export: the uploaded file, stored private under the migration's prefix. */
  source_file_id: string | null
  /** A feed: its address. */
  feed_url?: string | null
  /** A WordPress export: its product categories' address base, when the owner names one. */
  category_base?: string | null
  /** A WordPress export: what only is refreshed of what a run moved before (adr/0055). */
  refresh?: "descriptions"[] | undefined
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
          ...(input.feed_url ? { feed_url: input.feed_url } : {}),
          ...(input.category_base ? { category_base: input.category_base } : {}),
          ...(input.refresh?.length ? { refresh: input.refresh } : {}),
          mode: input.mode,
          defaults: input.defaults,
        },
        requested_by: input.requested_by,
      })),
    })
    return new WorkflowResponse(job)
  }
)
