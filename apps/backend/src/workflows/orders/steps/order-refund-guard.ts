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
 * An iyzico refund made in part whose every part iyzico answered
 * (`answered`, review D4-1 M1) is sent on under its reference: the
 * provider sends only what its done parts left, never one of them again.
 * Asked only to close, it is left open.
 */
export function triedAgain(
  status: string,
  trace: RefundTrace | null,
  closeOnly = false,
  answered = false
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
  if (trace === "partial" && answered && !closeOnly) {
    return "send"
  }
  return trace === "shown" ? "send" : "unsettled"
}

/** Every part of a refund made in parts answered (none `sending`): what is left can be sent on. */
export const allAnswered = (parts: readonly { state: string }[] | null | undefined): boolean =>
  (parts ?? []).length > 0 && (parts ?? []).every((part) => part.state === "done")
