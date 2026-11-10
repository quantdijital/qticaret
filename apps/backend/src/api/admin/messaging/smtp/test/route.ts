import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sendSmtpTestWorkflow } from "../../../../../workflows/messaging/smtp-test"

/**
 * POST /admin/messaging/smtp/test (adr/0036 Ek 2026-11-10): a test e-mail
 * through the shop's saved mail server to the signed-in staff member's own
 * address. `{ ok: true, to }` with the address masked, or `{ ok: false,
 * reason, reply }`: why it did not go and the server's reply code.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await sendSmtpTestWorkflow(req.scope).run({
    input: { user_id: req.auth_context.actor_id },
  })
  res.json(result)
}
