import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CATEGORY_WEIGHTS, RULES_VERSION } from "../../../../../../lib/seo/advisor"
import type { PageKind } from "../../../../../../lib/seo/advisor"
import { ASSESSED_KINDS } from "../../../../../../modules/seo-advisor/models/seo-assessment"
import { assessPage } from "../../../../../../workflows/seo/advisor/assess"

const isKind = (value: string): value is PageKind =>
  (ASSESSED_KINDS as readonly string[]).includes(value)

/**
 * A page assessed now (docs/14 §5): score, grade, findings most severe
 * first, and what each category keeps of its weight. Kept for lists too.
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
  res.json({ assessment: { ...result, weights: CATEGORY_WEIGHTS, rules_version: RULES_VERSION } })
}
