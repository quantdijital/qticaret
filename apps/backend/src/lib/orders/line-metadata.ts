/**
 * An order line's metadata whichever way the order was read. Medusa keeps
 * two (Order Concepts, "Item Metadata Fields", 2.16+): `metadata` on the
 * versioned order item and `line_item_metadata` on the line item itself;
 * read with the order's totals, `items.metadata` is the order item's. What
 * our workflows write (add-on picks, a gift's recipient, a KVKK erasure)
 * goes on the line item, so its keys win.
 */
export const LINE_METADATA_FIELDS = ["items.metadata", "items.line_item_metadata"]

export interface LineMetadataRow {
  metadata?: Record<string, unknown> | null
  line_item_metadata?: Record<string, unknown> | null
}

export const lineMetadataOf = (
  item: LineMetadataRow | null | undefined
): Record<string, unknown> => ({
  ...(item?.metadata ?? {}),
  ...(item?.line_item_metadata ?? {}),
})
