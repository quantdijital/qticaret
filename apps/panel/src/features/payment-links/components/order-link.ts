/** The link an order came from: `order.metadata.qt_payment_link`, when it is one. */
export function orderPaymentLinkId(metadata: Record<string, unknown> | null | undefined) {
  const id = metadata?.["qt_payment_link"]
  return typeof id === "string" && /^plink_[0-9A-Za-z]+$/.test(id) ? id : null
}
