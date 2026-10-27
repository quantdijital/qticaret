import type { MedusaContainer } from "@medusajs/framework/types"
import { completeCartWorkflow, createPaymentSessionsWorkflow } from "@medusajs/medusa/core-flows"
import { SYSTEM_PAYMENT_PROVIDER_ID } from "../../src/scripts/bootstrap/constants"

/**
 * Completes a cart paid by Medusa's system provider, past the storefront:
 * since F5 the Store API completes a cart to be paid only through a hosted
 * form, so checkout rules are exercised on the workflow itself. Returns the
 * order, or the rule's error key.
 */
export async function completeWithSystemPayment(
  container: MedusaContainer,
  cartId: string,
  paymentCollectionId: string
): Promise<{ order_id: string | null; message: string | null }> {
  await createPaymentSessionsWorkflow(container).run({
    input: { payment_collection_id: paymentCollectionId, provider_id: SYSTEM_PAYMENT_PROVIDER_ID },
  })
  const { result, errors } = await completeCartWorkflow(container).run({
    input: { id: cartId },
    throwOnError: false,
  })
  const error = errors[0]?.error as { safeMessage?: string; message?: string } | undefined
  return error
    ? { order_id: null, message: error.safeMessage ?? error.message ?? null }
    : { order_id: result.id, message: null }
}
