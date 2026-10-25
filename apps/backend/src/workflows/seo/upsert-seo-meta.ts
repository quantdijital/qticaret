import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, createRemoteLinkStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { SEO_META_MODULE } from "../../modules/seo-meta"
import { SEO_ENTITIES } from "./entities"
import { forgetResolutionsStep } from "./steps/forget-resolutions"
import { planSeoMetaStep } from "./steps/plan-seo-meta"
import type { UpsertSeoMetaInput } from "./steps/plan-seo-meta"
import { writeSeoMetaStep } from "./steps/write-seo-meta"

/**
 * Saves a page's SEO fields (adr/0015): checked, written and, the first
 * time, linked to the product, category or collection, under a lock per
 * page; every step undoes itself if a later one fails. Duplicate titles
 * or descriptions come back as a warning.
 */
export const upsertSeoMetaWorkflow = createWorkflow(
  "seo-upsert-seo-meta",
  (input: UpsertSeoMetaInput) => {
    const lockKey = transform(
      { input },
      ({ input }) => `seo:${input.entity_type}:${input.entity_id}`
    )
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 30 })

    const plan = planSeoMetaStep(input)
    const written = writeSeoMetaStep(plan)

    const links = transform({ input, written }, ({ input, written }) =>
      written.created
        ? [
            {
              [SEO_ENTITIES[input.entity_type].module]: {
                [SEO_ENTITIES[input.entity_type].linkKey]: input.entity_id,
              },
              [SEO_META_MODULE]: { seo_meta_id: written.id },
            },
          ]
        : []
    )
    createRemoteLinkStep(links)
    forgetResolutionsStep()

    releaseLockStep({ key: lockKey })
    const result = transform({ plan }, ({ plan }) => ({ duplicates: plan.duplicates }))
    return new WorkflowResponse(result)
  }
)
