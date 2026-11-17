import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../../../lib/logging"
import { WEBHOOK_EVENTS_MODULE } from "../../../modules/webhook-events"
import type WebhookEventsModuleService from "../../../modules/webhook-events/service"
import type { IyzicoCheck } from "./iyzico-callback"

/** The record a paid form's takes are counted on: one per form (basket = session). */
export const iyzicoTakeKey = (sessionId: string): string => `${sessionId}:paid`

/**
 * A paid form's verdict with how many times it was taken up (the shopper's
 * callback, a re-post, the reconcile job), this one included, as PayTR's
 * carries its notice's: a completion that keeps failing reaches the shop
 * (`completion_stuck`, PR #137 review). Only the alert reads the count; a
 * count that cannot be kept leaves it out (no alert), never the order.
 */
export async function withIyzicoTakes(
  container: Pick<MedusaContainer, "resolve">,
  check: IyzicoCheck
): Promise<IyzicoCheck> {
  const { verdict } = check
  if (verdict.kind !== "complete") {
    return check
  }
  try {
    const attempts = await container
      .resolve<WebhookEventsModuleService>(WEBHOOK_EVENTS_MODULE)
      .countTake("iyzico", iyzicoTakeKey(verdict.session_id))
    return { ...check, verdict: { ...verdict, attempts } }
  } catch (error) {
    logger.warn({
      event: "iyzico.take_count_failed",
      sessionId: verdict.session_id,
      err: errorSummary(error),
    })
    return check
  }
}
