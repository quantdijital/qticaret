/** Where the backend keeps the shopper's note on the cart (`POST /store/carts/:id/order-note`). */
const ORDER_NOTE_KEY = "qt_order_note"

/** The shopper's note the cart keeps, to fill the checkout's field again; none is null. */
export function orderNoteOf(metadata: Record<string, unknown> | null | undefined): string | null {
  const note = metadata?.[ORDER_NOTE_KEY]
  return typeof note === "string" && note !== "" ? note : null
}
