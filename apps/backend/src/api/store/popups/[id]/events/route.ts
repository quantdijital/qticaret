import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { recordPopupEvent } from "../../../../../workflows/popups/metrics"
import type { StorePostPopupEventType } from "./validators"

/**
 * `POST /store/popups/:id/events` (adr/0080 §7): one of a pop-up's
 * counters, `{ type: "impression" | "click" | "close" | "signup" }`.
 * Numbers only, nothing about the visitor. The same 204 whether it
 * counted or not, so the answer tells nothing about which ids exist.
 */
export async function POST(
  req: MedusaRequest<StorePostPopupEventType>,
  res: MedusaResponse
): Promise<void> {
  await recordPopupEvent(req.scope, req.params["id"] ?? "", req.validatedBody.type)
  res.status(204).end()
}
