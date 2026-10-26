import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import type { PageKind } from "../../../../../../../lib/seo/advisor"
import { ASSESSED_KINDS } from "../../../../../../../modules/seo-advisor/models/seo-assessment"
import { assessPage } from "../../../../../../../workflows/seo/advisor/assess"
import { applyFix } from "../../../../../../../workflows/seo/advisor/fixes"
import type { AdminPostAssessmentFixType } from "../../../validators"

const isKind = (value: string): value is PageKind =>
  (ASSESSED_KINDS as readonly string[]).includes(value)

/** Applies one of the advisor's one-click fixes, then assesses the page again. */
export async function POST(
  req: MedusaRequest<AdminPostAssessmentFixType>,
  res: MedusaResponse
): Promise<void> {
  const kind = req.params["kind"] ?? ""
  const id = req.params["id"] ?? ""
  if (!isKind(kind)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "seo.entity_type_unknown")
  }
  await applyFix(req.scope, kind, id, req.validatedBody.action)
  res.json({ assessment: await assessPage(req.scope, kind, id) })
}
