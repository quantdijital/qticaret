import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import { designSummary, partsOf } from "../lib/storefront/designs/summary"
import type { DesignSummary } from "../lib/storefront/designs/summary"
import { rawDigest } from "../lib/storefront/designs/digest"
import { logger } from "../lib/logging"
import { digestOf, readable } from "../workflows/storefront/design-shared"
import { legacySettings } from "../workflows/storefront/layout-shared"
import { layouts } from "../workflows/storefront/layout-row"

/**
 * What the removed Google reviews feature (adr/0058, Kaldırıldı 2026-11-27)
 * left in a shop's database: its two tables, the names of its module's
 * migrations, and the home or content page sections of its type kept in
 * the shop's designs.
 */
export const RETIRED_TABLES = ["google_review", "google_review_location"] as const
export const RETIRED_MIGRATIONS = [
  "Migration20261105144414",
  "Migration20261106203947",
  "Migration20261127143512",
] as const
export const RETIRED_SECTION_TYPE = "google_rating"

const GROUPS = ["header", "home", "footer", "product", "category"] as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)

const isRetired = (section: unknown): boolean =>
  isRecord(section) && section["type"] === RETIRED_SECTION_TYPE

/**
 * A stored design (a draft, what is live, a revision, a saved look)
 * without the retired sections, in every group and on every content page;
 * nothing else touched. `removed` 0: the same object back.
 */
export function withoutRetiredSections(stored: unknown): { document: unknown; removed: number } {
  if (!isRecord(stored)) {
    return { document: stored, removed: 0 }
  }
  let removed = 0
  const keep = (sections: unknown[]): unknown[] => {
    const kept = sections.filter((section) => !isRetired(section))
    removed += sections.length - kept.length
    return kept
  }
  const next: Record<string, unknown> = { ...stored }
  for (const group of GROUPS) {
    const sections = stored[group]
    if (Array.isArray(sections)) {
      next[group] = keep(sections)
    }
  }
  const pages = stored["pages"]
  if (Array.isArray(pages)) {
    next["pages"] = pages.map((page: unknown) =>
      isRecord(page) && Array.isArray(page["sections"])
        ? { ...page, sections: keep(page["sections"]) }
        : page
    )
  }
  return removed === 0 ? { document: stored, removed: 0 } : { document: next, removed }
}

export interface RetiredReviewsPorts {
  /** Which of the retired tables are still there. */
  existingTables: () => Promise<string[]>
  dropTables: () => Promise<void>
  /** Deletes the retired module's migration names; how many were recorded. */
  forgetMigrations: () => Promise<number>
  /** Rewrites every stored design without the retired sections; how many sections went. */
  cleanLayouts: () => Promise<{ documents: number; sections: number }>
}

export interface RetiredReviewsTally {
  tables: number
  migrations: number
  documents: number
  sections: number
}

/** Idempotent: a second run finds nothing to drop, forget or clean. */
export async function removeRetiredReviews(
  ports: RetiredReviewsPorts
): Promise<RetiredReviewsTally> {
  const tables = await ports.existingTables()
  if (tables.length > 0) {
    await ports.dropTables()
  }
  const migrations = await ports.forgetMigrations()
  const { documents, sections } = await ports.cleanLayouts()
  return { tables: tables.length, migrations, documents, sections }
}

/** A saved look's summary as it reads without the retired sections. */
function summaryWithout(summary: unknown, document: unknown): DesignSummary | null {
  if (!isRecord(summary)) {
    return null
  }
  const origin = summary as unknown as DesignSummary
  return designSummary(partsOf(document), {
    source: origin.source,
    source_name: origin.source_name,
    edited: origin.edited,
    reason: origin.reason,
  })
}

export function retiredReviewsPorts(container: MedusaContainer): RetiredReviewsPorts {
  const knex = container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
  const service = layouts(container)
  return {
    existingTables: async () => {
      const rows = await knex("information_schema.tables")
        .select("table_name")
        .where("table_schema", knex.raw("current_schema()"))
        .whereIn("table_name", [...RETIRED_TABLES])
      return rows.map((row: { table_name: string }) => row.table_name)
    },
    dropTables: async () => {
      await knex.raw(`drop table if exists ${RETIRED_TABLES.map((t) => `"${t}"`).join(", ")}`)
    },
    forgetMigrations: async () =>
      (await knex.schema.hasTable("mikro_orm_migrations"))
        ? await knex("mikro_orm_migrations")
            .whereIn("name", [...RETIRED_MIGRATIONS])
            .delete()
        : 0,
    cleanLayouts: async () => {
      let documents = 0
      let sections = 0
      const count = (removed: number) => {
        if (removed > 0) {
          documents += 1
          sections += removed
        }
      }
      for (const row of await service.listStorefrontLayouts(
        {},
        { select: ["id", "draft", "published"] }
      )) {
        const draft = withoutRetiredSections(row.draft)
        const published = withoutRetiredSections(row.published)
        count(draft.removed)
        count(published.removed)
        if (draft.removed + published.removed > 0) {
          await service.updateStorefrontLayouts({
            id: row.id,
            draft: draft.document as Record<string, unknown>,
            published: published.document as Record<string, unknown> | null,
          })
        }
      }
      for (const row of await service.listStorefrontLayoutRevisions(
        {},
        { select: ["id", "document"] }
      )) {
        const cleaned = withoutRetiredSections(row.document)
        count(cleaned.removed)
        if (cleaned.removed > 0) {
          await service.updateStorefrontLayoutRevisions({
            id: row.id,
            document: cleaned.document as Record<string, unknown>,
          })
        }
      }
      const designs = await service.listStorefrontDesigns(
        {},
        { select: ["id", "document", "summary"] }
      )
      const legacy = designs.length > 0 ? await legacySettings(container) : undefined
      for (const row of designs) {
        const cleaned = withoutRetiredSections(row.document)
        count(cleaned.removed)
        if (cleaned.removed > 0 && legacy !== undefined) {
          // The fingerprint as a save would take it today, so the look still matches its applies
          const read = readable(cleaned.document)
          const summary = summaryWithout(row.summary, cleaned.document)
          await service.updateStorefrontDesigns({
            id: row.id,
            document: cleaned.document as Record<string, unknown>,
            digest: read ? digestOf(read, legacy) : rawDigest(cleaned.document),
            ...(summary ? { summary: summary as unknown as Record<string, unknown> } : {}),
          })
        }
      }
      return { documents, sections }
    },
  }
}

/** Runs once per shop, on the `db:migrate` that removes Google reviews (adr/0058, Kaldırıldı). */
export default async function googleReviewsRemoved({ container }: ExecArgs) {
  const tally = await removeRetiredReviews(retiredReviewsPorts(container))
  logger.info({ event: "google.reviews_removed", ...tally })
}
