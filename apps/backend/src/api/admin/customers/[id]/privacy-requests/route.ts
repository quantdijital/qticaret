import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { LEGAL_MODULE } from "../../../../../modules/legal"
import type LegalModuleService from "../../../../../modules/legal/service"
import { recordPrivacyRequestWorkflow } from "../../../../../workflows/legal/privacy-requests"
import type { AdminPostPrivacyRequestType } from "../../../privacy-requests/validators"

/** The 30 days the law gives for an answer (KVKK md. 13). */
const ANSWER_DAYS = 30

const view = (row: {
  id: string
  kind: string
  channel: string
  status: string
  received_at: Date | string
  recorded_by: string
  job_id: string | null
  completed_at: Date | string | null
  completed_by: string | null
}) => {
  const received = new Date(row.received_at)
  return {
    ...row,
    received_at: received.toISOString(),
    due_at: new Date(received.getTime() + ANSWER_DAYS * 86_400_000).toISOString(),
    completed_at: row.completed_at ? new Date(row.completed_at).toISOString() : null,
  }
}

/** GET /admin/customers/:id/privacy-requests (F13.5): the customer's KVKK requests, newest first. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const rows = await req.scope
    .resolve<LegalModuleService>(LEGAL_MODULE)
    .listPrivacyRequests(
      { customer_id: req.params["id"] ?? "" },
      { order: { received_at: "DESC" } }
    )
  res.json({ privacy_requests: rows.map(view) })
}

/** POST /admin/customers/:id/privacy-requests: records a request as it came. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostPrivacyRequestType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await recordPrivacyRequestWorkflow(req.scope).run({
    input: {
      customer_id: req.params["id"] ?? "",
      ...req.validatedBody,
      recorded_by: req.auth_context.actor_id,
    },
  })
  // An open one of the kind answers as it is: recorded twice, still one request
  res.json({ privacy_request: view(result.request) })
}
