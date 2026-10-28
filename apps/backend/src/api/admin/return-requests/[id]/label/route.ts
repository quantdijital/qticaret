import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { RETURN_REQUESTS_MODULE } from "../../../../../modules/return-requests"
import type ReturnRequestsModuleService from "../../../../../modules/return-requests/service"

/**
 * GET /admin/return-requests/:id/label (adr/0032): a short-lived link to
 * the return label in private storage; staff only, a sensitive read.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const [request] = await req.scope
    .resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
    .listReturnRequests({ id: req.params["id"] ?? "" }, { take: 1 })
  if (!request?.return_label_file_id) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "shipping.label_unavailable")
  }
  const file = await req.scope.resolve(Modules.FILE).retrieveFile(request.return_label_file_id)
  res.setHeader("Cache-Control", "no-store")
  res.json({ url: file.url })
}
