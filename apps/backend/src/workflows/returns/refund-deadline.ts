import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { notificationText } from "../../lib/notifications/messages"
import { cameBack } from "../../lib/orders/returns"
import { refundDeadlineNear, refundDueAt } from "../../lib/orders/withdrawal-rules"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { StoreSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { RETURN_REQUESTS_MODULE } from "../../modules/return-requests"
import type ReturnRequestsModuleService from "../../modules/return-requests/service"

/** The bell's trigger: a return's refund is due within days (adr/0032 Ek 2026-11-03). */
export const REFUND_DEADLINE_NEAR = "returns.refund_deadline_near"

// Requests still owing money are few; a run looks at this many at most
const BATCH = 500

type Container = Pick<MedusaContainer, "resolve">

/**
 * Tells staff in the bell, once per request, that a return's refund is due
 * soon (adr/0032 Ek 2026-11-03): the 10th day since the parcel was handed
 * to the return carrier (or, not known, since it arrived) passed and the
 * money is not back, so the law's 14 days (MSY md. 12/1) are never passed.
 * A return still on its way counts too: the days run from the handover.
 * A request whose units were all refused owes nothing. The bell names the
 * order's number and the last day only. Returns how many were told.
 */
export async function alertRefundDeadlines(container: Container, now = new Date()) {
  const service = container.resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
  const open = await service.listReturnRequests(
    { kind: "return", status: ["approved", "received"], refund_alerted_at: null },
    {
      take: BATCH,
      order: { created_at: "ASC" },
      select: [
        "id",
        "order_id",
        "status",
        "items",
        "received_items",
        "damaged_items",
        "handed_over_at",
        "received_at",
      ],
    }
  )
  const late = open.filter(
    (request) =>
      refundDeadlineNear(request, now) &&
      (request.status === "approved" || cameBack(request).length > 0)
  )
  if (late.length === 0) {
    return 0
  }
  const [{ data: orders }, store] = await Promise.all([
    container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: ["id", "display_id"],
      filters: { id: [...new Set(late.map((request) => request.order_id))] },
    }),
    container
      .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      .getSection("store")
      .then((values) => values as unknown as StoreSettings),
  ])
  const numbers = new Map(
    (orders as { id: string; display_id?: number | null }[]).map((order) => [
      order.id,
      String(order.display_id ?? ""),
    ])
  )
  const day = new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeZone: store.timezone })
  let told = 0
  for (const request of late) {
    const due = refundDueAt(request) ?? now
    const order = numbers.get(request.order_id) ?? ""
    try {
      await container.resolve(Modules.NOTIFICATION).createNotifications({
        to: "",
        channel: "feed",
        template: "admin-ui",
        trigger_type: REFUND_DEADLINE_NEAR,
        resource_id: request.id,
        resource_type: "return_request",
        idempotency_key: `${REFUND_DEADLINE_NEAR}:${request.id}`,
        data: {
          kind: "return_refund_deadline",
          return_request_id: request.id,
          order_id: request.order_id,
          display_id: order,
          due_at: due.toISOString(),
          ...notificationText(REFUND_DEADLINE_NEAR, { order, due: day.format(due) }),
        },
      })
      await service.updateReturnRequests({ id: request.id, refund_alerted_at: now })
      told += 1
    } catch (error) {
      logger.warn({
        event: "returns.refund_alert_failed",
        returnRequestId: request.id,
        err: errorSummary(error),
      })
    }
  }
  return told
}
