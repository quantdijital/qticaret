import { MAX_PRINT_ORDERS } from "@/features/orders/api/packing"

/** The ids in the print page's address: order ids only, each once, as many as one print takes. */
export const idsOf = (text: string | undefined): string[] =>
  [...new Set((text ?? "").split(",").filter((id) => /^order_[0-9A-Za-z]{1,40}$/.test(id)))].slice(
    0,
    MAX_PRINT_ORDERS
  )

/** What a print page prints: each order's packing slip, or one pick list of them all. */
export type PrintKind = "slip" | "pick"

/**
 * Opens the picked orders' packing slips or pick list in a new tab, which
 * prints itself once its page is drawn (`window.print()`); the panel tab
 * stays where it was. No PDF: the browser prints the page as it is.
 */
export function openPrint(kind: PrintKind, orderIds: readonly string[]): void {
  const query = new URLSearchParams({ kind, ids: orderIds.join(",") })
  window.open(`/print/orders?${query.toString()}`, "_blank", "noopener")
}
