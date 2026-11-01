import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { LEGAL_MODULE } from "../../../../../modules/legal"
import type LegalModuleService from "../../../../../modules/legal/service"
import { recordPrivacyRequestWorkflow } from "../../../../../workflows/legal/privacy-requests"
import type { StorePostPrivacyRequestType } from "./validators"

// KVKK md. 13: thirty days to answer
const ANSWER_DAYS = 30

interface Row {
  id: string
  kind: string
  status: string
  received_at: Date | string
  completed_at: Date | string | null
}

/** What the customer sees of a request: its kind, state and the date the answer is due. */
const view = (row: Row) => {
  const received = new Date(row.received_at)
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    received_at: received.toISOString(),
    due_at: new Date(received.getTime() + ANSWER_DAYS * 86_400_000).toISOString(),
    completed_at: row.completed_at ? new Date(row.completed_at).toISOString() : null,
  }
}

/** GET /store/customers/me/privacy-requests (F18 D8): the customer's own KVKK requests, newest first. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const rows = await req.scope
    .resolve<LegalModuleService>(LEGAL_MODULE)
    .listPrivacyRequests(
      { customer_id: req.auth_context.actor_id },
      { order: { received_at: "DESC" }, take: 20 }
    )
  res.setHeader("Cache-Control", "no-store")
  res.json({ privacy_requests: (rows as Row[]).map(view) })
}

/**
 * POST /store/customers/me/privacy-requests (F18 D8, adr/0041 §6): the
 * customer asks from their signed-in account, the request recorded as the
 * staff would (channel `account`, by the customer) for the shop to answer
 * from the panel. An open request of the same kind is answered as it is:
 * asking twice opens nothing new.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<StorePostPrivacyRequestType>,
  res: MedusaResponse
): Promise<void> {
  const customerId = req.auth_context.actor_id
  const { kind } = req.validatedBody
  const [open] = await req.scope
    .resolve<LegalModuleService>(LEGAL_MODULE)
    .listPrivacyRequests({ customer_id: customerId, kind, status: "open" }, { take: 1 })
  if (open) {
    res.json({ privacy_request: view(open) })
    return
  }
  const { result } = await recordPrivacyRequestWorkflow(req.scope).run({
    input: {
      customer_id: customerId,
      kind,
      channel: "account",
      received_at: new Date().toISOString(),
      recorded_by: customerId,
    },
  })
  res.status(201).json({ privacy_request: view(result) })
}
