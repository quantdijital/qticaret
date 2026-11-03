import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createProductCategoriesWorkflow } from "@medusajs/medusa/core-flows"
import { categoryKey } from "../../lib/migration/sheet"
import type { SourceCategory, StepProblem, StepProgress } from "../../lib/migration/types"
import { toSlug } from "../../lib/seo/slug"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import { writeSeo } from "./post-terms"

type Container = Pick<MedusaContainer, "resolve">

/**
 * A category's own SEO fields, where the source keeps them (a WordPress
 * SEO plugin's term meta; WordpressCategory); a source without them
 * leaves them out.
 */
export interface CategorySeo {
  seo_title?: string | null | undefined
  seo_description?: string | null | undefined
  focus_keyword?: string | null | undefined
}

export interface CategoryTree {
  /** A path ("Mutfak > Tavalar") to its handle here; null for one not made (a dry run). */
  handleOf: (path: readonly string[]) => string | null
  /**
   * `seo_own`: new ones with the source's own SEO title or description;
   * `seo_default`: new ones without, which take the shop's templates.
   */
  counts: { read: number; created: number; found: number; seo_own: number; seo_default: number }
  /** An SEO field the SEO workflow refused (the category is made, on the templates). */
  problems: StepProblem[]
}

interface Known {
  id: string
  handle: string
  parent_category_id: string | null
  name: string
}

/** A handle no other category holds: the name's slug, numbered when taken. */
function freeHandle(name: string, taken: ReadonlySet<string>): string {
  const base = toSlug(name) || "kategori"
  let handle = base
  for (let n = 2; taken.has(handle); n++) {
    handle = `${base}-${String(n)}`
  }
  return handle
}

/**
 * The source's categories as a tree here (F14, adr/0042 §2): every path's
 * parents first; a category met before (by the migration's record of it,
 * else by its name under the same parent) kept, the rest made. A new one
 * gets the source's own SEO title, description and focus keyword through
 * the SEO workflow (adr/0015); one the source has none for gets nothing
 * written, so the shop's templates give it its title and description as
 * they do a category made in the panel. One here already is never written
 * over. A dry run makes none and names the ones that exist. Categories are
 * few: read whole.
 */
export async function migrateCategories(
  container: Container,
  source: string,
  categories: readonly (SourceCategory & CategorySeo)[],
  apply: boolean,
  progress: StepProgress
): Promise<CategoryTree> {
  const products = container.resolve(Modules.PRODUCT)
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const existing = (await products.listProductCategories(
    {},
    { select: ["id", "handle", "parent_category_id", "name"], take: null }
  )) as Known[]
  const taken = new Set(existing.map((category) => category.handle))
  const byId = new Map(existing.map((category) => [category.id, category]))
  const before = await migration.targetsOf(
    source,
    "category",
    categories.map((category) => category.source_key)
  )
  const byParent = new Map(
    existing.map((category) => [`${category.parent_category_id ?? ""}/${category.name}`, category])
  )
  const handles = new Map<string, string>()
  const ids = new Map<string, string>()
  const counts = { read: categories.length, created: 0, found: 0, seo_own: 0, seo_default: 0 }
  const problems: StepProblem[] = []
  const tally = (own: CategorySeo | undefined, written: boolean) => {
    if (written && (own?.seo_title || own?.seo_description)) {
      counts.seo_own += 1
    } else {
      counts.seo_default += 1
    }
  }
  const remembered: { source_key: string; target_id: string; old_url: string | null }[] = []
  const byPath = new Map(categories.map((category) => [categoryKey(category.path), category]))

  // Every path and its parents, shortest first: a parent is there before its children
  const paths = [
    ...new Set(
      categories.flatMap((category) =>
        category.path.map((_, index) => categoryKey(category.path.slice(0, index + 1)))
      )
    ),
  ].sort((a, b) => a.split(" > ").length - b.split(" > ").length)

  for (const [index, key] of paths.entries()) {
    const path = key.split(" > ")
    const name = path[path.length - 1] ?? ""
    const parentId = path.length > 1 ? (ids.get(categoryKey(path.slice(0, -1))) ?? null) : null
    const own = byPath.get(key)
    const madeBefore = own ? before.get(own.source_key)?.target_id : null
    // One a run made before, though renamed since; else by its name, under a parent that is here
    const found =
      (madeBefore ? byId.get(madeBefore) : undefined) ??
      (path.length === 1 || parentId ? byParent.get(`${parentId ?? ""}/${name}`) : undefined)
    if (found) {
      handles.set(key, found.handle)
      ids.set(key, found.id)
      counts.found += 1
    } else if (apply && (path.length === 1 || parentId)) {
      const handle = freeHandle(name, taken)
      taken.add(handle)
      const { result } = await createProductCategoriesWorkflow(container as MedusaContainer).run({
        input: {
          product_categories: [
            {
              name,
              handle,
              is_active: true,
              ...(parentId ? { parent_category_id: parentId } : {}),
              ...(byPath.get(key)?.description
                ? { description: byPath.get(key)?.description ?? "" }
                : {}),
            },
          ],
        },
      })
      const made = result[0]
      if (made) {
        handles.set(key, made.handle)
        ids.set(key, made.id)
        counts.created += 1
        const refused = own
          ? await writeSeo(container, "category", made.id, {
              seo_title: own.seo_title,
              seo_description: own.seo_description,
              focus_keyword: own.focus_keyword,
            })
          : null
        if (own && refused) {
          problems.push({ source_key: own.source_key, key: refused })
        }
        tally(own, refused === null)
      }
    } else if (!apply) {
      counts.created += 1
      tally(own, true)
    }
    const id = ids.get(key)
    if (own && id) {
      remembered.push({ source_key: own.source_key, target_id: id, old_url: own.old_url })
    }
    await progress(index + 1, paths.length)
  }
  if (apply) {
    await migration.remember(
      source,
      "category",
      remembered.map((item) => ({ ...item, status: "done" as const }))
    )
  }
  return { handleOf: (path) => handles.get(categoryKey(path)) ?? null, counts, problems }
}
