import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { createCampaignsWorkflow } from "@medusajs/medusa/core-flows"
import { batchPrefix, freshCodes } from "../../lib/promotions"
import { ASYNC_JOB_MODULE } from "../../modules/async-job"
import type AsyncJobModuleService from "../../modules/async-job/service"
import {
  BATCH_CHUNK,
  batchCampaignData,
  batchCopyOf,
  codeTemplate,
  removeCodeBatch,
} from "./code-batches"
import type { CodeBatch } from "./code-batches"

export interface CodeBatchInput {
  promotion_id: string
  count: number
  /** The job making the batch, told of its progress. */
  job_id?: string | null
}

// Draws of a chunk's clashing codes before giving up; a clash is already rare
const REDRAWS = 5

const loadTemplateStep = createStep(
  "promotion-code-batch-template",
  async (input: { promotion_id: string }, { container }) =>
    new StepResponse(await codeTemplate(container, input.promotion_id))
)

/** `size` codes none of which the shop or the batch has, checked against the shop's. */
async function unclaimedCodes(
  container: MedusaContainer,
  prefix: string,
  size: number,
  drawn: Set<string>
): Promise<string[]> {
  const promotions = container.resolve(Modules.PROMOTION)
  const fresh: string[] = []
  for (let draw = 0; fresh.length < size; draw++) {
    if (draw === REDRAWS) {
      throw new Error("promotion codes: could not draw unclaimed codes")
    }
    const candidates = freshCodes(prefix, size - fresh.length, new Set([...drawn, ...fresh]))
    const taken = await promotions.listPromotions(
      { code: candidates },
      { select: ["code"], take: null }
    )
    const claimed = new Set(taken.flatMap((row) => (row.code ? [row.code] : [])))
    for (const code of candidates) {
      if (claimed.has(code)) {
        drawn.add(code)
      } else {
        fresh.push(code)
      }
    }
  }
  return fresh
}

interface WriteInput {
  template: Awaited<ReturnType<typeof codeTemplate>>
  campaign_id: string
  count: number
  job_id: string | null
}

/**
 * The batch's codes, 500 at a time. A failure part way takes back what was
 * written; so does a failure of any later step.
 */
const writeCodesStep = createStep(
  "promotion-code-batch-codes",
  async (input: WriteInput, { container }) => {
    const promotions = container.resolve(Modules.PROMOTION)
    const jobs = container.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
    const prefix = batchPrefix(input.template.code ?? "")
    const chunks = Math.ceil(input.count / BATCH_CHUNK)
    const written: string[] = []
    const codes: string[] = []
    try {
      for (let chunk = 0; chunk < chunks; chunk++) {
        const size = Math.min(BATCH_CHUNK, input.count - chunk * BATCH_CHUNK)
        const fresh = await unclaimedCodes(container, prefix, size, new Set(codes))
        const made = await promotions.createPromotions(
          fresh.map((code) => batchCopyOf(input.template, code, input.campaign_id))
        )
        written.push(...made.map((row) => row.id))
        codes.push(...fresh)
        if (input.job_id) {
          await jobs.reportProgress(input.job_id, ((chunk + 1) / chunks) * 100)
        }
      }
    } catch (error) {
      await removeCodeBatch(container, { campaign_id: "", promotion_ids: written })
      throw error
    }
    const batch: CodeBatch = { campaign_id: input.campaign_id, codes }
    return new StepResponse(batch, written)
  },
  async (written, { container }) => {
    if (written?.length) {
      await removeCodeBatch(container, { campaign_id: "", promotion_ids: written })
    }
  }
)

/**
 * A batch of single-use codes (F4.6, ADR-0024): the template checked, the
 * batch's campaign made, then its codes. Each step takes back its own
 * when a later one fails, so a batch is whole or gone.
 */
export const createCodeBatchWorkflow = createWorkflow(
  "promotion-code-batch-create",
  (input: CodeBatchInput) => {
    const template = loadTemplateStep({ promotion_id: input.promotion_id })
    const campaignsData = transform({ template, input }, (data) => [
      batchCampaignData(data.template, data.input.count),
    ])
    const campaigns = createCampaignsWorkflow.runAsStep({ input: { campaignsData } })
    const campaignId = transform({ campaigns }, (data) => data.campaigns[0]?.id ?? "")
    const jobId = transform({ input }, (data) => data.input.job_id ?? null)
    const batch = writeCodesStep({
      template,
      campaign_id: campaignId,
      count: input.count,
      job_id: jobId,
    })
    return new WorkflowResponse(batch)
  }
)
