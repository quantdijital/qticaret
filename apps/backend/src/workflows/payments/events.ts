/**
 * A hosted payment the shopper tried was refused (F9.4): the cart is
 * still there to pay again. Medusa has no event of its own for it.
 */
export const PAYMENT_FAILED = "payment.failed"

export interface PaymentFailedEvent {
  cart_id: string
  provider: "paytr" | "iyzico"
}
