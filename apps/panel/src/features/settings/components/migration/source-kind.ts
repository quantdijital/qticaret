import type { MigrationSourceKind } from "@/features/settings/api/migration"

// A run's source as the server keeps it ("wordpress", or a record's "shopify:magaza.myshopify.com")
const SOURCE_KINDS = ["shopify", "wordpress", "feed", "customers", "bundle"] as const

/** The source kind a run or a record came from, as the panel names it. */
export const sourceKindOf = (source: string): MigrationSourceKind =>
  SOURCE_KINDS.find((kind) => source === kind || source.startsWith(`${kind}:`)) ?? "bundle"
