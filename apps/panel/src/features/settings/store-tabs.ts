/** The store profile's tabs (adr/0048), in their order; `?part=` names the open one. */
export const STORE_TABS = ["general", "contact", "legal", "social"] as const
export type StoreTab = (typeof STORE_TABS)[number]

const isStoreTab = (value: unknown): value is StoreTab =>
  typeof value === "string" && (STORE_TABS as readonly string[]).includes(value)

/** The route's search: a known tab is kept, anything else left out (the first tab opens). */
export const storeTabSearch = (search: Record<string, unknown>): { part?: StoreTab } =>
  isStoreTab(search["part"]) ? { part: search["part"] } : {}
