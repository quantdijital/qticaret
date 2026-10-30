import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../../../../lib/errors"
import { ORDER_KINDS, checkLegalDoc } from "../../../../../lib/legal"
import { SAMPLE_ORDER, renderLegal } from "../../../../../workflows/legal/read"
import { kindOf } from "../../kind"
import type { AdminPostLegalPreviewType } from "../../validators"

/**
 * POST /admin/legal-documents/:kind/preview (F13.1): the text as the shop
 * and its customers will read it, with the shop's details and, for a
 * contract, a made-up order. Reads only; nothing is saved.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostLegalPreviewType>,
  res: MedusaResponse
): Promise<void> {
  const kind = kindOf(req)
  const { unknownTokens, isMalformed } = checkLegalDoc(req.validatedBody.body, kind)
  if (isMalformed || unknownTokens.length > 0) {
    throw new ValidationError("legal.token_invalid", { field: "body" })
  }
  const html = await renderLegal(
    req.scope,
    req.validatedBody.body,
    ORDER_KINDS.has(kind) ? SAMPLE_ORDER : undefined
  )
  res.json({ html })
}
