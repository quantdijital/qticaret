import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { shownFailure } from "../../../../lib/webhooks"
import { TENANT_WEBHOOKS_MODULE } from "../../../../modules/tenant-webhooks"
import type TenantWebhooksModuleService from "../../../../modules/tenant-webhooks/service"
import type { AdminPostWebhookUpdateType } from "../validators"
import { SUBSCRIPTION_FIELDS, ownedBy, subscriptionView } from "../view"

// The delivery log a person reads at once; older ones stay until the retention job
const DELIVERIES_SHOWN = 50

async function subscriptionOf(req: AuthenticatedMedusaRequest) {
  const id = (req.params as Record<string, string | undefined>)["id"] ?? ""
  const hooks = req.scope.resolve<TenantWebhooksModuleService>(TENANT_WEBHOOKS_MODULE)
  // A key's own only: another's reads as unknown
  const [row] = await hooks.listWebhookSubscriptions(
    { id, ...ownedBy(req) },
    { select: SUBSCRIPTION_FIELDS, take: 1 }
  )
  if (!row) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "webhook.unknown")
  }
  return { hooks, row }
}

/** GET /admin/webhooks/:id (F11.7): the subscription and its latest deliveries, codes only. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { hooks, row } = await subscriptionOf(req)
  const deliveries = await hooks.listWebhookDeliveries(
    { subscription_id: row.id },
    {
      select: [
        "id",
        "event",
        "status",
        "attempts",
        "last_status",
        "last_duration_ms",
        "last_error",
        "next_attempt_at",
        "delivered_at",
        "created_at",
      ],
      order: { created_at: "DESC" },
      take: DELIVERIES_SHOWN,
    }
  )
  res.json({
    subscription: subscriptionView(row),
    deliveries: deliveries.map((delivery) => ({
      ...delivery,
      last_error: shownFailure(delivery.last_error),
    })),
  })
}

/** POST /admin/webhooks/:id: a new address or events, or turned on again (its streak cleared). */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostWebhookUpdateType>,
  res: MedusaResponse
): Promise<void> {
  const { hooks, row } = await subscriptionOf(req)
  const { url, events, status } = req.validatedBody
  if (url !== undefined || events !== undefined) {
    await hooks.updateWebhookSubscriptions({
      id: row.id,
      ...(url !== undefined ? { url } : {}),
      ...(events !== undefined ? { events } : {}),
    })
  }
  if (status === "active") {
    await hooks.reactivate(row.id)
  }
  const [updated] = await hooks.listWebhookSubscriptions(
    { id: row.id },
    { select: SUBSCRIPTION_FIELDS, take: 1 }
  )
  res.json({ subscription: updated ? subscriptionView(updated) : null })
}

/** DELETE /admin/webhooks/:id: the subscription goes; what it had queued is not sent. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { hooks, row } = await subscriptionOf(req)
  await hooks.softDeleteWebhookSubscriptions(row.id)
  res.json({ id: row.id, deleted: true })
}
