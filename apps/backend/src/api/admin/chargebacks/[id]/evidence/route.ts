import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { chargebackEvidence } from "../../../../../workflows/chargebacks/evidence"
import { CHARGEBACKS_MODULE } from "../../../../../modules/chargebacks"
import type ChargebacksModuleService from "../../../../../modules/chargebacks/service"

/**
 * GET /admin/chargebacks/:id/evidence (adr/0030): the dispute's evidence as
 * one HTML document, downloaded in one click; it holds the delivery
 * address, so reading it is logged (sensitive read).
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const [chargeback] = await req.scope
    .resolve<ChargebacksModuleService>(CHARGEBACKS_MODULE)
    .listChargebacks({ id: req.params["id"] ?? "" }, { take: 1 })
  if (!chargeback) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "chargebacks.unknown")
  }
  const html = await chargebackEvidence(req.scope, chargeback)
  // Its own styles only; no script, nothing from outside, never inside another page
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"
  )
  res.setHeader("Content-Disposition", `attachment; filename="ters-ibraz-${chargeback.id}.html"`)
  res.type("html").send(html)
}
