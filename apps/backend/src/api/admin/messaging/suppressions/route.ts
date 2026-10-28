import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MESSAGING_MODULE } from "../../../../modules/messaging"
import type MessagingModuleService from "../../../../modules/messaging/service"
import type { AdminGetSuppressionsType, AdminPostSuppressionType } from "./validators"

const PAGE = 20

/**
 * GET /admin/messaging/suppressions (F9.6, adr/0036): the addresses no
 * message goes to, masked, newest first, with why.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetSuppressionsType>,
  res: MedusaResponse
): Promise<void> {
  const [rows, count] = await req.scope
    .resolve<MessagingModuleService>(MESSAGING_MODULE)
    .listAndCountMessageSuppressions(
      {},
      {
        select: ["id", "channel", "recipient_masked", "reason", "source", "detail", "created_at"],
        order: { created_at: "DESC" },
        skip: req.validatedQuery.offset,
        take: PAGE,
      }
    )
  res.json({ suppressions: rows, count, limit: PAGE })
}

/** POST: the shop puts an address on the list (a customer asked for no messages at all). */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostSuppressionType>,
  res: MedusaResponse
): Promise<void> {
  const result = await req.scope.resolve<MessagingModuleService>(MESSAGING_MODULE).suppress({
    ...req.validatedBody,
    reason: "manual",
    source: "panel",
    created_by: req.auth_context.actor_id || null,
  })
  res.status(result.created ? 201 : 200).json(result)
}
