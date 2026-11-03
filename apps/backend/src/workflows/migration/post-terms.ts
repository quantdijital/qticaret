import type { MedusaContainer } from "@medusajs/framework/types"
import { isConflictError, isValidationError } from "../../lib/errors"
import type { SourcePostTerm, StepProblem } from "../../lib/migration/types"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import type { RememberedItem } from "../../modules/migration/service"
import { saveTermWorkflow } from "../content/term-workflows"
import type { SeoEntityType } from "../seo/entities"
import { upsertSeoMetaWorkflow } from "../seo/upsert-seo-meta"

type Container = Pick<MedusaContainer, "resolve">

/** A save refused for the record's own data: its key for the report; anything else is thrown. */
export function refusalOf(error: unknown): string {
  if (isValidationError(error) || isConflictError(error)) {
    return error.safeMessage
  }
  throw error
}

export interface SeoInput {
  seo_title?: string | null | undefined
  seo_description?: string | null | undefined
  focus_keyword?: string | null | undefined
  robots_override?: "noindex_follow" | "noindex_nofollow" | null | undefined
}

/**
 * A new page's own SEO fields through the SEO workflow (adr/0015), the
 * fields the source had only; why it was refused, or null.
 */
export async function writeSeo(
  container: Container,
  entity_type: SeoEntityType,
  entity_id: string,
  fields: SeoInput
): Promise<string | null> {
  const values = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== null && value !== undefined)
  )
  if (Object.keys(values).length === 0) {
    return null
  }
  try {
    await upsertSeoMetaWorkflow(container as MedusaContainer).run({
      input: { entity_type, entity_id, values },
    })
    return null
  } catch (error) {
    return refusalOf(error)
  }
}

export interface TermCounts {
  read: number
  created: number
  found: number
  skipped: number
}

/**
 * The posts' blog categories or tags here (adr/0019 ek 2026-11-03): one a
 * run made before, or one of the same handle, kept; the rest made through
 * the term workflow (its archive path claimed) with their SEO fields. A
 * dry run makes none. Each one's id by its source key (null in a dry run).
 */
export async function migratePostTerms(
  container: Container,
  source: string,
  kind: "category" | "tag",
  terms: readonly SourcePostTerm[],
  apply: boolean
): Promise<{ ids: Map<string, string | null>; counts: TermCounts; problems: StepProblem[] }> {
  const migrationKind = kind === "category" ? "post_category" : "post_tag"
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const content = container.resolve<ContentModuleService>(CONTENT_MODULE)
  const before = await migration.targetsOf(
    source,
    migrationKind,
    terms.map((term) => term.source_key)
  )
  const madeBefore = [...before.values()].flatMap((item) =>
    item.target_id ? [item.target_id] : []
  )
  const [named, made] = await Promise.all([
    content.listContentTerms(
      { kind, handle: terms.map((term) => term.handle) },
      { select: ["id", "handle"], take: null }
    ),
    madeBefore.length > 0
      ? content.listContentTerms({ kind, id: madeBefore }, { select: ["id"], take: null })
      : [],
  ])
  // One a run made before, though renamed since; else one of the same handle
  const byId = new Map(made.map((term) => [term.id, term.id]))
  const byHandle = new Map(named.map((term) => [term.handle, term.id]))
  const ids = new Map<string, string | null>()
  const counts: TermCounts = { read: terms.length, created: 0, found: 0, skipped: 0 }
  const problems: StepProblem[] = []
  const remembered: RememberedItem[] = []
  for (const term of terms) {
    const found =
      byId.get(before.get(term.source_key)?.target_id ?? "") ?? byHandle.get(term.handle)
    if (found) {
      counts.found += 1
      ids.set(term.source_key, found)
      remembered.push({
        source_key: term.source_key,
        target_id: found,
        status: "done",
        old_url: term.old_url,
      })
      continue
    }
    if (!apply) {
      counts.created += 1
      ids.set(term.source_key, null)
      continue
    }
    try {
      const { result } = await saveTermWorkflow(container as MedusaContainer).run({
        input: {
          kind,
          values: { name: term.name, handle: term.handle, description: term.description },
        },
      })
      counts.created += 1
      ids.set(term.source_key, result.id)
      byHandle.set(term.handle, result.id)
      remembered.push({
        source_key: term.source_key,
        target_id: result.id,
        status: "done",
        old_url: term.old_url,
      })
      const seo = await writeSeo(container, migrationKind, result.id, {
        seo_title: term.seo_title,
        seo_description: term.seo_description,
      })
      if (seo) {
        problems.push({ source_key: term.source_key, key: seo })
      }
    } catch (error) {
      const key = refusalOf(error)
      counts.skipped += 1
      problems.push({ source_key: term.source_key, key })
      remembered.push({
        source_key: term.source_key,
        target_id: null,
        status: "skipped",
        error_code: key,
        old_url: term.old_url,
      })
    }
  }
  if (apply) {
    await migration.remember(source, migrationKind, remembered)
  }
  return { ids, counts, problems }
}
