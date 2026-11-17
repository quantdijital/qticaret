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
