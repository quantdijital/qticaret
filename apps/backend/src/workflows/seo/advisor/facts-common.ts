import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { PageKind } from "../../../lib/seo/advisor"
import { seoTextHash } from "../../../lib/seo"
import { SEO_ADVISOR_MODULE } from "../../../modules/seo-advisor"
import type SeoAdvisorModuleService from "../../../modules/seo-advisor/service"

/** What every kind's facts read alike: the page's own SEO fields, its row, its duplicates. */

export const OWN_FIELDS = [
  "seo_meta.seo_title",
  "seo_meta.seo_description",
  "seo_meta.focus_keyword",
  "seo_meta.robots_override",
  "seo_meta.canonical_override",
]

export interface Own {
  seo_title?: string | null
  seo_description?: string | null
  focus_keyword?: string | null
  robots_override?: string | null
  canonical_override?: string | null
}

export async function rowOf<T>(
  container: MedusaContainer,
  entity: string,
  fields: string[],
  id: string
) {
  const { data } = await container
    .resolve(ContainerRegistrationKeys.QUERY)
    .graph({ entity, fields, filters: { id } })
  return (data[0] as T | undefined) ?? null
}

/**
 * Other live, indexable pages of the kind showing the same title or
 * description, own or from the template (their assessments keep the
 * hashes; docs/14 S-DUP-01). A draft copy competes with nothing.
 */
export async function duplicates(
  container: MedusaContainer,
  kind: PageKind,
  id: string,
  texts: { title: string; description: string }
) {
  const service = container.resolve<SeoAdvisorModuleService>(SEO_ADVISOR_MODULE)
  const count = async (field: "title_hash" | "description_hash", text: string) => {
    const hash = seoTextHash(text)
    if (!hash) {
      return 0
    }
    const rows = await service.listSeoAssessments(
      { entity_type: kind, [field]: hash, is_listed: true, entity_id: { $ne: id } },
      { select: ["id"], take: 100 }
    )
    return rows.length
  }
  return {
    title: await count("title_hash", texts.title),
    description: await count("description_hash", texts.description),
  }
}
