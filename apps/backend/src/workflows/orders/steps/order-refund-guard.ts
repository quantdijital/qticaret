import type { RefundTrace } from "../refund-trace"

/**
 * Whether a refund under the reference belongs to something else: another
 * order, or another payment than the one asked for (security review Y1: a
 * cancel's reference must never close one payment's refund for another).
 */
export const referenceTaken = (
  existing: { order_id: string; payment_id: string },
  input: { order_id: string; payment_id?: string | undefined }
): boolean =>
  existing.order_id !== input.order_id ||
  (input.payment_id !== undefined && existing.payment_id !== input.payment_id)

/**
 * What a refund tried again under its reference does (review 2026-11-17,
 * O1, D-4): one done is only reported; one still open is closed when its
 * money is surely back (`made`: recorded; `send`: shown by the provider,
 * which finds it and sends nothing), and refused otherwise, never sent
 * again; only a failed one is planned anew from the request and sent.
 * Asked only to close (`closeOnly`, D-3), one not open is left as it is.
 */
export function triedAgain(
  status: string,
  trace: RefundTrace | null,
  closeOnly = false
): "done" | "made" | "send" | "unsettled" | "replan" {
  if (status === "done" || (closeOnly && status !== "pending")) {
    return "done"
  }
  if (status === "failed") {
    return "replan"
  }
  if (trace === "made") {
    return "made"
  }
  return trace === "shown" ? "send" : "unsettled"
}
