import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { PageKind } from "../lib/seo/advisor"
import { errorSummary, logger } from "../lib/logging"
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
 * a template or a price changed elsewhere all show up by morning.
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
}

export const config = {
  name: "seo-advisor-nightly",
  schedule: "15 4 * * *",
}
