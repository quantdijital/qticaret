import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { withAdvisorAiFixes } from "../../../../../../lib/ai/registry/advisor-fixes"
import { CATEGORY_WEIGHTS, RULES_VERSION } from "../../../../../../lib/seo/advisor"
import type { PageKind } from "../../../../../../lib/seo/advisor"
import { ASSESSED_KINDS } from "../../../../../../modules/seo-advisor/models/seo-assessment"
import { assessPage } from "../../../../../../workflows/seo/advisor/assess"

const isKind = (value: string): value is PageKind =>
  (ASSESSED_KINDS as readonly string[]).includes(value)

/**
 * A page assessed now (docs/14 §5): score, grade, findings most severe
 * first, and what each category keeps of its weight. Kept for lists too.
 * A finding an AI task can fix names it in `ai` (docs/22 "Aşama 3");
 * nothing is asked of a service here.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const kind = req.params["kind"] ?? ""
  if (!isKind(kind)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "seo.entity_type_unknown")
  }
  const result = await assessPage(req.scope, kind, req.params["id"] ?? "")
  if (!result) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "seo.entity_unknown")
  }
  res.json({
    assessment: {
      ...result,
      issues: withAdvisorAiFixes(kind, result.issues),
      weights: CATEGORY_WEIGHTS,
      rules_version: RULES_VERSION,
    },
  })
}
