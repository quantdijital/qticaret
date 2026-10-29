import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { TENANT_WEBHOOKS_MODULE } from "../../../modules/tenant-webhooks"
import type TenantWebhooksModuleService from "../../../modules/tenant-webhooks/service"
import { MAX_SUBSCRIPTIONS } from "../../../modules/tenant-webhooks/service"
import type { AdminPostWebhookType } from "./validators"
import { SUBSCRIPTION_FIELDS, ownedBy, subscriptionView } from "./view"

/**
 * GET /admin/webhooks (F11.7): the shop's subscriptions. Staff, or a key
 * with `webhooks:manage` (the scope layer lets only such keys here), which
 * sees its own only.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const rows = await req.scope
    .resolve<TenantWebhooksModuleService>(TENANT_WEBHOOKS_MODULE)
    .listWebhookSubscriptions(ownedBy(req), {
      select: SUBSCRIPTION_FIELDS,
      order: { created_at: "DESC" },
      take: MAX_SUBSCRIPTIONS,
    })
  res.json({ subscriptions: rows.map(subscriptionView) })
}

/** POST /admin/webhooks: a subscription; its signing secret is in this answer only. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostWebhookType>,
  res: MedusaResponse
): Promise<void> {
  const { subscription, secret } = await req.scope
    .resolve<TenantWebhooksModuleService>(TENANT_WEBHOOKS_MODULE)
    .subscribe({
      url: req.validatedBody.url,
      events: req.validatedBody.events,
      created_by: req.auth_context.actor_id,
    })
  res.status(201).json({ subscription: subscriptionView(subscription), secret })
}
