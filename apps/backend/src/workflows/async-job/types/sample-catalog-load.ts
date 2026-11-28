import { z } from "@medusajs/framework/zod"
import { loadSampleCatalogWorkflow } from "../../sample-catalog/load"
import type { JobType } from "./types"

export const SAMPLE_LOAD_JOB = "sample_catalog.load"

export const SampleCatalogLoadInput = z.object({ pack: z.string().min(1).max(64) }).strict()
export type SampleCatalogLoadInput = z.infer<typeof SampleCatalogLoadInput>

/**
 * A pack's sample catalogue loaded outside the request (owner, 2026-11-28:
 * a whole set takes minutes). Queued by `POST /admin/sample-catalog/load`
 * only, after its quick check; one at a time; the owner and admin see it.
 * The workflow writes the progress (the heartbeat too) after each product,
 * some twenty seconds apart, well inside the sweeper's ten minutes.
 */
export const sampleCatalogLoad: JobType<SampleCatalogLoadInput> = {
  input: SampleCatalogLoadInput,
  singleton: true,
  internal: true,
  managersOnly: true,
  resultTtlDays: 7,
  containsPersonalData: false,
  execute: async ({ container, job, progress }, { pack }) => {
    await progress(1)
    const { result } = await loadSampleCatalogWorkflow(container).run({
      input: { pack, job_id: job.id },
    })
    return { summary: { ...result } }
  },
}
