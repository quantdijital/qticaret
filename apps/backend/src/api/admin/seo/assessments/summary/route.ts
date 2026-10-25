import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SEO_ADVISOR_MODULE } from "../../../../../modules/seo-advisor"
import type SeoAdvisorModuleService from "../../../../../modules/seo-advisor/service"

const LOWEST = 10

/**
 * The shop's SEO picture (docs/14 §5): its average product score, how
 * products spread over the grades, how many have a critical finding, and
 * the products that need the most work.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<SeoAdvisorModuleService>(SEO_ADVISOR_MODULE)
  // A shop's products fit: only the score columns are read
  const rows = await service.listSeoAssessments(
    { entity_type: "product" },
    {
      select: ["entity_id", "score", "grade", "critical"],
      order: { score: "ASC", entity_id: "ASC" },
    }
  )
  const grades = { excellent: 0, good: 0, needs_work: 0, poor: 0 }
  for (const row of rows) {
    grades[row.grade] += 1
  }
  const lowest = rows.slice(0, LOWEST)
  const { data } = lowest.length
    ? await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "product",
        fields: ["id", "title", "thumbnail"],
        filters: { id: lowest.map((row) => row.entity_id) },
      })
    : { data: [] }
  const products = new Map(
    (data as { id: string; title: string; thumbnail: string | null }[]).map((row) => [row.id, row])
  )
  res.json({
    products: rows.length,
    average: rows.length
      ? Math.round(rows.reduce((total, row) => total + row.score, 0) / rows.length)
      : null,
    grades,
    critical: rows.filter((row) => row.critical > 0).length,
    lowest: lowest.flatMap((row) => {
      const product = products.get(row.entity_id)
      return product
        ? [
            {
              id: row.entity_id,
              title: product.title,
              thumbnail: product.thumbnail,
              score: row.score,
              grade: row.grade,
            },
          ]
        : []
    }),
  })
}
