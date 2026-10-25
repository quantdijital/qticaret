import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SEO_ADVISOR_MODULE } from "../../../../modules/seo-advisor"
import type SeoAdvisorModuleService from "../../../../modules/seo-advisor/service"
import type { AdminGetAssessmentsType } from "./validators"

/** Stored assessments of one kind of page, lowest score first (docs/14 §5: list column, filter). */
export async function GET(
  req: MedusaRequest<unknown, AdminGetAssessmentsType>,
  res: MedusaResponse
): Promise<void> {
  const { kind, max_score, ids, offset, limit } = req.validatedQuery
  const [rows, count] = await req.scope
    .resolve<SeoAdvisorModuleService>(SEO_ADVISOR_MODULE)
    .listAndCountSeoAssessments(
      {
        entity_type: kind,
        ...(max_score === undefined ? {} : { score: { $lte: max_score } }),
        ...(ids ? { entity_id: ids } : {}),
      },
      { skip: offset, take: limit, order: { score: "ASC", entity_id: "ASC" } }
    )
  res.json({
    assessments: rows.map((row) => ({
      entity_id: row.entity_id,
      score: row.score,
      grade: row.grade,
      critical: row.critical,
      issues: Array.isArray(row.issues) ? row.issues.length : 0,
      computed_at: row.computed_at,
    })),
    count,
    offset,
    limit,
  })
}
