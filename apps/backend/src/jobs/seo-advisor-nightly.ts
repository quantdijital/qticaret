import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { isConflictError } from "../lib/errors"
import { errorSummary, logger } from "../lib/logging"
import type { PageKind } from "../lib/seo/advisor"
import { enqueueAsyncJobWorkflow } from "../workflows/async-job/enqueue-async-job"
import { assessPage } from "../workflows/seo/advisor/assess"

const PAGE = 500
const KINDS: { kind: PageKind; entity: string }[] = [
  { kind: "product", entity: "product" },
  { kind: "category", entity: "product_category" },
  { kind: "brand", entity: "brand" },
  { kind: "collection", entity: "product_collection" },
]

/**
 * Assesses every page again each night (docs/14 §1): a new rules version,
 * a template or a price changed elsewhere all show up by morning. The
 * store-wide audit (§3.9) runs after, on the fresh assessments.
 */
export default async function seoAdvisorNightly(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const counts: Record<string, number> = {}
  for (const { kind, entity } of KINDS) {
    counts[kind] = 0
    for (let skip = 0; ; skip += PAGE) {
      const { data } = await query.graph({
        entity,
        fields: ["id"],
        pagination: { skip, take: PAGE, order: { id: "ASC" } },
      })
      for (const { id } of data as { id: string }[]) {
        try {
          await assessPage(container, kind, id)
          counts[kind] += 1
        } catch (error) {
          logger.warn({ event: "seo.assessment_failed", kind, err: errorSummary(error) })
        }
      }
      if (data.length < PAGE) {
        break
      }
    }
  }
  logger.info({ event: "seo.advisor_nightly", ...counts })
  try {
    await enqueueAsyncJobWorkflow(container).run({
      input: { type: "seo.audit", input: {}, requested_by: null },
    })
  } catch (error) {
    // One asked for in the panel is already on its way
    if (!isConflictError(error)) {
      throw error
    }
  }
}

export const config = {
  name: "seo-advisor-nightly",
  schedule: "15 4 * * *",
}
