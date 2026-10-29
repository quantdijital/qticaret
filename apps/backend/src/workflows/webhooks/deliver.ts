import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import { isSafeFetchError } from "../../lib/security/safe-fetch"
import { signatureHeader, webhookTransport } from "../../lib/webhooks"
import { TENANT_WEBHOOKS_MODULE } from "../../modules/tenant-webhooks"
import type TenantWebhooksModuleService from "../../modules/tenant-webhooks/service"
import type { DueDelivery } from "../../modules/tenant-webhooks/service"

// A slow receiver costs one delivery a try, never the whole run
const TIMEOUT_MS = 10_000
// The answer is not read beyond its status
const MAX_ANSWER_BYTES = 64 * 1024

export interface Sent {
  ok: boolean
  status: number | null
  duration_ms: number
  /** Why it failed: `http_<status>` or safe-fetch's reason (`address_not_allowed`, `timeout`, …). */
  code: string | null
}

/**
 * Posts one delivery to its subscription, signed. Nothing to undo: it is
 * the workflow's only step and a POST to the shop's own system; a retry
 * carries the same delivery id (`X-Webhook-Id`) for the receiver to dedupe.
 */
const sendStep = createStep("webhooks-send", async (delivery: DueDelivery, { container }) => {
  const secret = container
    .resolve<TenantWebhooksModuleService>(TENANT_WEBHOOKS_MODULE)
    .secretOf(delivery.subscription_id, delivery.secret_encrypted)
  const body = JSON.stringify({
    id: delivery.id,
    type: delivery.event,
    created_at: new Date(delivery.created_at).toISOString(),
    data: delivery.payload,
  })
  const timestamp = Math.floor(Date.now() / 1000)
  const started = Date.now()
  try {
    const answer = await webhookTransport.send(delivery.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "QuantTicaret-Webhooks/1",
        "x-webhook-id": delivery.id,
        "x-webhook-event": delivery.event,
        "x-webhook-signature": signatureHeader(secret, timestamp, body),
      },
      body,
      timeoutMs: TIMEOUT_MS,
      maxResponseBytes: MAX_ANSWER_BYTES,
      // A redirect could take the body somewhere the shop did not choose
      redirect: "error",
    })
    const ok = answer.status >= 200 && answer.status < 300
    return new StepResponse<Sent>({
      ok,
      status: answer.status,
      duration_ms: Date.now() - started,
      code: ok ? null : `http_${String(answer.status)}`,
    })
  } catch (error) {
    return new StepResponse<Sent>({
      ok: false,
      status: null,
      duration_ms: Date.now() - started,
      code: isSafeFetchError(error) ? error.reason : "request_failed",
    })
  }
})

/** One delivery to the shop's own system (F11.7, adr/0039 §7); how it went. */
export const deliverWebhookWorkflow = createWorkflow(
  "webhooks-deliver",
  (input: WorkflowData<DueDelivery>) => new WorkflowResponse(sendStep(input))
)
