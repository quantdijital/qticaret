/**
 * Whether an order was paid in a provider's test mode (adr/0027): our
 * hosted-form providers keep `test_mode` in the payment's data. Such an
 * order moved no real money.
 */
export function paidInTestMode(
  order:
    | {
        payment_collections?: ({ payments?: ({ data?: unknown } | null)[] | null } | null)[] | null
      }
    | null
    | undefined
): boolean {
  return (order?.payment_collections ?? []).some((collection) =>
    (collection?.payments ?? []).some(
      (payment) => (payment?.data as { test_mode?: unknown } | null | undefined)?.test_mode === true
    )
  )
}
