/**
 * The records a panel screen opens by id (adr/0079 §4, security review
 * D4): the assistant is told only a closed kind and a Medusa id of the
 * record open, never its content. One list for both sides: the panel
 * names the open record from it and the backend's turn route accepts
 * these kinds and no other.
 */

/** The kinds, in the order of `PANEL_RECORDS`. */
export const PANEL_RECORD_TYPES = [
  "product",
  "order",
  "customer",
  "category",
  "collection",
  "brand",
  "promotion",
  "price_list",
] as const

export type PanelRecordType = (typeof PANEL_RECORD_TYPES)[number]

export interface PanelRecordRoute {
  type: PanelRecordType
  /** The record's screen in the panel's routes (`/products/$id`). */
  route: string
  /** The map's entry the record sits under: the open screen's key. */
  screen: string
}

export const PANEL_RECORDS: readonly PanelRecordRoute[] = [
  { type: "product", route: "/products/$id", screen: "products" },
  { type: "order", route: "/orders/$id", screen: "orders" },
  { type: "customer", route: "/customers/$id", screen: "customers" },
  { type: "category", route: "/categories/$id", screen: "categories" },
  { type: "collection", route: "/collections/$id", screen: "collections" },
  { type: "brand", route: "/brands/$id", screen: "brands" },
  { type: "promotion", route: "/promotions/$id", screen: "promotions" },
  { type: "price_list", route: "/promotions/price-lists/$id", screen: "promotions.priceLists" },
]

/** A Medusa record id: a lowercase prefix and a ULID (`prod_01J…`). */
export const PANEL_RECORD_ID = /^[a-z]+_[0-9A-Z]{26}$/
