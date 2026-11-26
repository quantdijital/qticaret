/** The longest note the backend keeps (`ORDER_NOTE_MAX`); it cleans and checks it again. */
export const ORDER_NOTE_MAX = 500

export interface OrderNoteWords {
  /** "Sipariş notu (isteğe bağlı)" */
  orderNote: string
  /** What the note is for, under the field. */
  orderNoteHint: string
}

/**
 * The shopper's optional note for the shop (Batch 8 / O1), sent with the
 * payment form as `order_note`: the note kept on the cart comes back in it
 * after a refused payment, and an emptied field takes it off.
 */
export function OrderNote({
  value,
  words,
}: {
  value: string | null | undefined
  words: OrderNoteWords
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="odeme-siparis-notu" className="text-sm font-semibold">
        {words.orderNote}
      </label>
      <textarea
        id="odeme-siparis-notu"
        name="order_note"
        maxLength={ORDER_NOTE_MAX}
        rows={3}
        defaultValue={value ?? ""}
        aria-describedby="odeme-siparis-notu-ipucu"
        className="gf-field min-h-24 rounded-[min(var(--button-radius),var(--radius-media))] py-3"
      />
      <p id="odeme-siparis-notu-ipucu" className="text-xs text-text-3">
        {words.orderNoteHint}
      </p>
    </div>
  )
}
