import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ORDER_KINDS, assertLegalTokens, withoutStarterNote } from "../../../../../lib/legal"
import { SAMPLE_ORDER, renderLegal } from "../../../../../workflows/legal/read"
import { kindOf } from "../../kind"
import type { AdminPostLegalPreviewType } from "../../validators"

/**
 * POST /admin/legal-documents/:kind/preview (F13.1): the text as the shop
 * and its customers will read it, with the shop's details and, for a
 * contract, a made-up order; the starter's draft note is left out, as
 * publishing removes it. Reads only; nothing is saved.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostLegalPreviewType>,
  res: MedusaResponse
): Promise<void> {
  const kind = kindOf(req)
  assertLegalTokens(req.validatedBody.body, kind)
  const html = await renderLegal(
    req.scope,
    withoutStarterNote(req.validatedBody.body),
    ORDER_KINDS.has(kind) ? SAMPLE_ORDER : undefined
  )
  res.json({ html })
}
