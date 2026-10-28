import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { checkSenderDomain } from "../../../../../workflows/messaging/sender-domain"
import { senderDomainView } from "../route"

/** POST /admin/messaging/sender-domain/check: "Doğrula": Resend looks at the DNS again. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  await checkSenderDomain(req.scope)
  res.json(await senderDomainView(req.scope))
}
