import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { parasutAuthorizeUrl, parasutClientOf } from "../../../../lib/invoicing/parasut"
import { EINVOICE_MODULE } from "../../../../modules/einvoice"
import type EinvoiceModuleService from "../../../../modules/einvoice/service"
import {
  connectParasutWorkflow,
  disconnectParasutWorkflow,
} from "../../../../workflows/einvoice/parasut-connection"
import type { AdminPostParasutConnectionType } from "./validators"

const view = async (req: AuthenticatedMedusaRequest) => {
  const client = parasutClientOf()
  return {
    // Off until the platform's client is set (adr/0034 §5)
    available: client !== null,
    authorize_url: client ? parasutAuthorizeUrl(client) : null,
    connection: await req.scope.resolve<EinvoiceModuleService>(EINVOICE_MODULE).parasutConnection(),
  }
}

/** GET /admin/einvoice/parasut: whether Paraşüt can be connected, and the shop's company. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ parasut: await view(req) })
}

/** POST /admin/einvoice/parasut: connects the company with the pasted code (the owner, re-checked). */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostParasutConnectionType>,
  res: MedusaResponse
): Promise<void> {
  await connectParasutWorkflow(req.scope).run({
    input: { ...req.validatedBody, user_id: req.auth_context.actor_id },
  })
  res.json({ parasut: await view(req) })
}

/** DELETE /admin/einvoice/parasut: forgets the connection and its tokens. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  await disconnectParasutWorkflow(req.scope).run()
  res.json({ parasut: await view(req) })
}
