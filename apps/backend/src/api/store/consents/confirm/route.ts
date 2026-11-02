import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { confirmConsentByLinkWorkflow } from "../../../../workflows/messaging/email-links"
import type { StorePostConsentConfirmType } from "./validators"

/**
 * POST /store/consents/confirm (adr/0038 M17, Ek 2026-11-02): the
 * storefront's `/abonelik/onay` page, once its reader pressed the button.
 * Records the consent the request asked for (`granted` or `revoked`); a
 * used, late or unknown link records nothing.
 */
export async function POST(
  req: MedusaRequest<StorePostConsentConfirmType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await confirmConsentByLinkWorkflow(req.scope).run({
    input: { token: req.validatedBody.token },
  })
  if (!result) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "consents.link_invalid")
  }
  res.setHeader("Cache-Control", "no-store")
  res.json({ status: result.status })
}
