import type { MigrationOverview, RefreshKind } from "@/features/settings/api/migration-overview"

/** A completion row (adr/0042 Ek 2026-11-27): a refresh run, the links job, the 301s, a new run. */
export type CompletionKey = RefreshKind | "new" | "links" | "urls"

/** What a completion asks for: an export file (WordPress), a feed's address, or nothing. */
export type CompletionInput = "file" | "url" | "none"

type ProductSource = "wordpress" | "shopify" | "feed"

export interface CompletionRow {
  key: CompletionKey
  /** How much it would take, when the server can count it; null: no count shown. */
  count: (overview: MigrationOverview) => number | null
  /** The sources it applies to; null: any. */
  sources: readonly ProductSource[] | null
}

/** The rows, in the order a shop needs them. */
export const COMPLETION_ROWS: readonly CompletionRow[] = [
  { key: "images", count: (o) => o.missing.images, sources: ["wordpress", "shopify", "feed"] },
  { key: "descriptions", count: (o) => o.missing.descriptions, sources: ["wordpress"] },
  { key: "summaries", count: (o) => o.missing.summaries, sources: ["wordpress"] },
  { key: "post_images", count: (o) => o.missing.post_images, sources: ["wordpress"] },
  { key: "category_covers", count: (o) => o.missing.category_covers, sources: ["wordpress"] },
  { key: "new", count: () => null, sources: null },
  { key: "links", count: () => null, sources: null },
  { key: "urls", count: (o) => o.missing.urls, sources: null },
]

/** The rows that apply to where the shop's products came from. */
export const rowsFor = (source: ProductSource | null): CompletionRow[] =>
  COMPLETION_ROWS.filter((row) => row.sources === null || (source && row.sources.includes(source)))

/** What the row's dialog asks for, by where the products came from. */
export function inputOf(key: CompletionKey, source: ProductSource | null): CompletionInput {
  if (key === "new" || key === "links" || key === "urls") {
    return "none"
  }
  return source === "shopify" ? "none" : source === "feed" ? "url" : "file"
}

/**
 * The values of a finished completion's sentence ("20 görsel eklendi ·
 * 2 alınamadı"), from its job's summary; zero where a count is missing.
 */
export function doneValues(
  key: CompletionKey,
  summary: Record<string, unknown> | null | undefined
): Record<string, number> {
  const counts = (summary?.["counts"] ?? {}) as Record<string, Record<string, number> | number>
  const of = (kind: string, field: string): number => {
    const own = counts[kind]
    return typeof own === "object" ? (own[field] ?? 0) : 0
  }
  const flat = (field: string): number => {
    const value = counts[field]
    return typeof value === "number" ? value : 0
  }
  switch (key) {
    case "images":
      return { created: of("image", "created"), skipped: of("image", "skipped") }
    case "descriptions":
      return { updated: of("product", "updated"), found: of("product", "found") }
    case "summaries":
      return { updated: of("product", "updated"), skipped: of("product", "skipped") }
    case "post_images":
      return { updated: of("post", "updated"), skipped: of("image", "skipped") }
    case "category_covers":
      return { covers: of("category", "covers") }
    case "urls":
      return { reserved: flat("reserved") }
    case "links":
      return {
        changed: typeof summary?.["changed"] === "number" ? summary["changed"] : 0,
        unresolved: typeof summary?.["unresolved"] === "number" ? summary["unresolved"] : 0,
      }
    case "new":
      return {}
  }
}
