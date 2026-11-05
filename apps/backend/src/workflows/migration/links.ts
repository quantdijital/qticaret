import type { MedusaContainer } from "@medusajs/framework/types"
import type { SheetCell, SheetSpec } from "../../lib/sheets"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import { linkRows } from "../content/link-report"
import { rewriteContentLinks } from "../content/link-rewrite"
import type { LinkRewriteResult } from "../content/link-rewrite"
import { recordLegacyAddresses } from "./legacy-addresses"
import type { LegacyCounts } from "./legacy-addresses"
import { reserveRecordPaths } from "./urls-apply"

/**
 * After an applied migration (adr/0042 Ek 2026-11-05): the moved records'
 * old paths answer with their 301s at once, then the texts this source
 * brought (pages, posts, products' descriptions) get their links to the
 * old site pointed at the pages that answer them here. The shop's other
 * texts are its own: the content link job (`content.link_rewrite`) takes
 * those when asked. First the old platform's own addresses the source
 * knows (adr/0059): subcategories' short paths and the pictures' files.
 */

type Container = Pick<MedusaContainer, "resolve">

export interface MigrationLinks extends LinkRewriteResult {
  /** Old paths kept for their records now (an apply's `reserve`). */
  reserved: number
  /** The old platform's own addresses written as entries (adr/0059). */
  legacy: LegacyCounts
}

const DOCUMENT_KINDS = ["post", "page", "product"]

export async function settleMigratedLinks(
  container: Container,
  source: string
): Promise<MigrationLinks> {
  const legacy = await recordLegacyAddresses(container, source, true)
  const { reserved } = await reserveRecordPaths(container)
  const items = await container
    .resolve<MigrationModuleService>(MIGRATION_MODULE)
    .listMigrationItems(
      { source, kind: DOCUMENT_KINDS, status: "done", target_id: { $ne: null } },
      { select: ["kind", "target_id"], take: null }
    )
  const idsOf = (wanted: (kind: string) => boolean) => [
    ...new Set(
      items.flatMap((item) => (wanted(item.kind) && item.target_id ? [item.target_id] : []))
    ),
  ]
  const result = await rewriteContentLinks(container as MedusaContainer, {
    scope: {
      entries: idsOf((kind) => kind !== "product"),
      products: idsOf((kind) => kind === "product"),
    },
  })
  return { reserved, legacy, ...result }
}

/** The counts as the run's summary and audit entry keep them. */
export const linkCounts = (links: MigrationLinks) => ({
  reserved: links.reserved,
  short_paths: links.legacy.short_paths.added,
  files: links.legacy.files.added,
  documents: links.documents,
  rewritten: links.rewritten,
  changed: links.changed.length,
  unresolved: links.unresolved.length,
})

/** The report's lines on the links (the summary's) and their own sheet. */
export function migrationLinkSheet(links: MigrationLinks): {
  summary: SheetCell[][]
  sheet: SheetSpec
} {
  const rows = linkRows(links)
  return {
    summary: [
      [],
      ["Eski adresinden yeni sayfasına 301 alan kayıtlar", links.reserved],
      ["Kısa yoluyla da 301 alan alt kategoriler", links.legacy.short_paths.added],
      ["Eski dosya adresinden yeni görsele 301 alan görseller", links.legacy.files.added],
      ["Metinlerde düzeltilen iç bağlantılar", links.changed.length],
      ["Metinlerde çözülemeyen iç bağlantılar", links.unresolved.length],
    ],
    sheet: {
      name: "Bağlantılar",
      widths: [18, 48, 60, 60],
      rows: [
        ["Tür", "Başlık", "Bağlantı", "Yeni bağlantı ya da neden"],
        ...rows.changed,
        ...rows.unresolved,
      ],
    },
  }
}
