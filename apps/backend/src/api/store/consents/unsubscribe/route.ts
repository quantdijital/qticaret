import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { unsubscribeByLinkWorkflow } from "../../../../workflows/messaging/email-links"
import type { StorePostUnsubscribeType } from "./validators"

/**
 * POST /store/consents/unsubscribe (adr/0038 Ek 2026-11-02): the
 * storefront's `/abonelik/cik` page, once its reader pressed the button
 * (opening the link withdraws nothing). The recipient's e-mail consent is
 * withdrawn; again changes nothing and answers the same.
 */
export async function POST(
  req: MedusaRequest<StorePostUnsubscribeType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await unsubscribeByLinkWorkflow(req.scope).run({
    input: { token: req.validatedBody.token },
  })
  if (!result) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "consents.link_invalid")
  }
  res.setHeader("Cache-Control", "no-store")
  res.json({ status: result.status })
}
