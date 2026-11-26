/**
 * A product's linked products (S3, WooCommerce's "Linked Products"): two
 * ordered lists the shop arranges, twelve each at most (the server's
 * limit, `lib/catalog/linked-products`).
 */
export const LINKED_MAX = 12

export const LINKED_LISTS = ["upsells", "cross_sells"] as const
export type LinkedList = (typeof LINKED_LISTS)[number]

/** The list with the item at `from` moved to `to`; out of range: as it was. */
export function moved<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return [...list]
  }
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item as T)
  return next
}

/** The list with `item` at its end, unless it is there already or the list is full. */
export function withAdded<T extends { id: string }>(list: readonly T[], item: T): T[] {
  if (list.length >= LINKED_MAX || list.some((each) => each.id === item.id)) {
    return [...list]
  }
  return [...list, item]
}
