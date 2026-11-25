/** Where the backend keeps the shopper's note on the order (`lib/orders/customer-note.ts`). */
const ORDER_NOTE_KEY = "qt_order_note"

/** The shopper's note at checkout (Batch 8 / O1), if they left one. */
export function customerNoteOf(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  const note = metadata?.[ORDER_NOTE_KEY]
  return typeof note === "string" && note.trim() !== "" ? note : null
}
