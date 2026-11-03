/** The link an order came from: `order.metadata.qt_payment_link`, when it is one. */
export function orderPaymentLinkId(metadata: Record<string, unknown> | null | undefined) {
  const id = metadata?.["qt_payment_link"]
  return typeof id === "string" && /^plink_[0-9A-Za-z]+$/.test(id) ? id : null
}

/**
 * The link's number as the order keeps it (`metadata.qt_payment_link_number`,
 * "PL-1042"), when the backend wrote one; nothing else passes for it.
 */
export function orderPaymentLinkNumber(metadata: Record<string, unknown> | null | undefined) {
  const number = metadata?.["qt_payment_link_number"]
  return typeof number === "string" && /^PL-\d{1,12}$/.test(number) ? number : null
}
