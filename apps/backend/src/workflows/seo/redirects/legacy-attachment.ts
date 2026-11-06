import type { MedusaContainer } from "@medusajs/framework/types"
import { attachmentPage } from "../../../lib/seo/legacy"
import { encodePath, parseRequestPath } from "../../../lib/seo/redirects"
import { MIGRATION_MODULE } from "../../../modules/migration"
import type MigrationModuleService from "../../../modules/migration/service"
import { CATALOG_ENTITY_TYPES } from "../../catalog/entity-paths"
import type { Follow } from "./legacy-pages"
import type { RedirectCode } from "./resolve"

/**
 * A WordPress attachment page (adr/0059 Ek 2026-11-06): `/urun/x/tava/`,
 * `/yazi/attachment/kapak/`. It leads to the page of the record it hung
 * under, in one hop, when that record moved here from WordPress and is
 * live: a product, a post or a page (a file was never attached to a
 * category). Even when its slug names a moved file, the visitor wanted a
 * page, so the record's page it is, never the image. Asked last, after
 * WordPress's own address classes: a live page or a real nested path has
 * already answered.
 */

/** The records a file hangs under, by their entity type: the migration item's kind. */
const ATTACHMENT_PARENTS: Readonly<Record<string, string>> = {
  [CATALOG_ENTITY_TYPES.product]: "product",
  [CATALOG_ENTITY_TYPES.post]: "post",
  [CATALOG_ENTITY_TYPES.page]: "page",
}

export interface AttachmentTarget {
  /** The record's page today (encoded, as a redirect's location). */
  location: string
  status: RedirectCode
}

/** Whether the record came from a WordPress migration here. */
async function wasMoved(container: MedusaContainer, kind: string, id: string): Promise<boolean> {
  const [item] = await container
    .resolve<MigrationModuleService>(MIGRATION_MODULE)
    .listMigrationItems(
      { source: { $like: "wordpress%" }, kind, target_id: id, status: "done" },
      { select: ["id"], take: 1 }
    )
  return item !== undefined
}

/** Where the attachment page at `path` leads; null when it hung under no moved record. */
export async function attachmentTarget(
  container: MedusaContainer,
  follow: Follow,
  path: string
): Promise<AttachmentTarget | null> {
  const page = attachmentPage(path)
  if (!page) {
    return null
  }
  // The parent as it answers here, without the old platform's rules: one level, never recursive
  const parent = await follow(
    { path: page.parent, query: new URLSearchParams() },
    { legacy: false }
  )
  let target: AttachmentTarget
  let record = parent
  if (parent.type === "entity") {
    target = { location: encodePath(page.parent), status: 301 }
  } else if (parent.type === "redirect") {
    target = { location: parent.location, status: parent.status }
    const end = parseRequestPath(parent.location)
    if (!end) {
      return null
    }
    record = await follow(end, { legacy: false })
  } else {
    return null
  }
  if (record.type !== "entity") {
    return null
  }
  const kind = Object.hasOwn(ATTACHMENT_PARENTS, record.entity_type)
    ? ATTACHMENT_PARENTS[record.entity_type]
    : undefined
  return kind && (await wasMoved(container, kind, record.entity_id)) ? target : null
}
