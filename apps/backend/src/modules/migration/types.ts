import type { ITEM_STATUSES } from "./models/migration-item"
import type { URL_ORIGINS } from "./models/migration-url"

/** The migration module's shapes (F14, adr/0042). */

export type ItemStatus = (typeof ITEM_STATUSES)[number]

export interface RememberedItem {
  source_key: string
  target_id: string | null
  status: ItemStatus
  error_code?: string | null
  old_url?: string | null
}

export interface LegacyOrderInput {
  source_key: string
  number: string
  placed_at: Date
  currency_code: string
  total: string
  status: string
  customer_id: string | null
  email: string | null
  lines: { title: string; sku: string | null; quantity: number; total: string }[]
}

/** An old file and the media asset it became (adr/0059). */
export interface KeptFile {
  path: string
  stem: string
  media_id: string
}

export interface InventoryUrl {
  address: string
  path: string
  query: string | null
  origin: (typeof URL_ORIGINS)[number]
  clicks?: number | null
  entity_type?: string | null
  entity_id?: string | null
}

/** A run's live step (adr/0042 Ek 2026-11-27): the kinds it takes, the one it is on, how far. */
export interface RunPhase {
  kinds: readonly string[]
  kind: string
  done: number
  total: number
}

/** What moved, counted in the database (the migration page's overview). */
export interface ItemTallies {
  /** Records by kind and status. */
  items: { kind: string; status: ItemStatus; count: number }[]
  /** Products and posts with a picture a run could not store, each counted once. */
  unpictured: { kind: "product" | "post"; count: number }[]
  /** Moved records with an old address the inventory does not tie to them yet. */
  unaddressed: number
  /** The sources runs moved records from (`wordpress:eski-magaza.com`). */
  sources: string[]
}
