import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { RecordLinkKind } from "../../lib/storefront/menus"
import { LEGAL_MODULE } from "../../modules/legal"
import type LegalModuleService from "../../modules/legal/service"
import type { MenuLinkKind } from "../../modules/storefront-menus/service"
import { URL_REGISTRY_MODULE } from "../../modules/url-registry"
import type UrlRegistryModuleService from "../../modules/url-registry/service"
import { COLLECTION_LIVE_FIELDS, isCollectionShown } from "../catalog/collection-fields"
import type { CollectionExtensionRow } from "../catalog/collection-fields"
import { CATALOG_ENTITY_TYPES, CATALOG_LOCALE } from "../catalog/entity-paths"

type Container = Pick<MedusaContainer, "resolve">

/** A stored link as the resolver reads it. */
export interface StoredLink {
  id: string
  parent_id: string | null
  rank: number
  label: string | null
  kind: MenuLinkKind
  target: string | null
  url: string | null
}

/** What a link shows now: its name, where it opens, and whether its target is still live. */
export interface ResolvedLink {
  /** The record's or legal text's own name; null for a storefront page or an address. */
  name: string | null
  /** The record's live path, or the address; null for a legal text or a storefront page. */
  path: string | null
  /** Its target is gone, not live, or has no address: the storefront leaves it out. */
  broken: boolean
}

interface Row {
  id: string
  name?: string | null
  title?: string | null
  status?: string | null
  kind?: string | null
  is_active?: boolean | null
  is_internal?: boolean | null
  collection_extension?: CollectionExtensionRow | null
}

interface RecordSpec {
  entity: string
  type: string
  fields: string[]
  live: (row: Row) => boolean
}

// The same "live" rules as the URL registry's owners (seo/redirects/owners.ts)
const RECORDS: Readonly<Record<RecordLinkKind, RecordSpec>> = {
  category: {
    entity: "product_category",
    type: CATALOG_ENTITY_TYPES.category,
    fields: ["id", "name", "is_active", "is_internal"],
    live: (row) => row.is_active === true && row.is_internal !== true,
  },
  product: {
    entity: "product",
    type: CATALOG_ENTITY_TYPES.product,
    fields: ["id", "title", "status"],
    live: (row) => row.status === "published",
  },
  collection: {
    entity: "product_collection",
    type: CATALOG_ENTITY_TYPES.collection,
    fields: ["id", "title", ...COLLECTION_LIVE_FIELDS],
    live: (row) => isCollectionShown(row),
  },
  brand: {
    entity: "brand",
    type: CATALOG_ENTITY_TYPES.brand,
    fields: ["id", "name", "is_active"],
    live: (row) => row.is_active === true,
  },
  page: {
    entity: "content_entry",
    type: CATALOG_ENTITY_TYPES.page,
    fields: ["id", "title", "status", "kind"],
    live: (row) => row.kind === "page" && row.status === "published",
  },
  post: {
    entity: "content_entry",
    type: CATALOG_ENTITY_TYPES.post,
    fields: ["id", "title", "status", "kind"],
    live: (row) => row.kind === "post" && row.status === "published",
  },
  landing: {
    entity: "landing_page",
    type: CATALOG_ENTITY_TYPES.landing,
    fields: ["id", "title", "status"],
    live: (row) => row.status === "published",
  },
}

export const isRecordKind = (kind: MenuLinkKind): kind is RecordLinkKind => kind in RECORDS

/** The records' rows and live paths for one kind of link. */
async function recordLinks(
  container: Container,
  kind: RecordLinkKind,
  ids: string[]
): Promise<Map<string, ResolvedLink>> {
  const spec = RECORDS[kind]
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const [{ data }, entries] = await Promise.all([
    query.graph({ entity: spec.entity, fields: spec.fields, filters: { id: ids } }),
    container
      .resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
      .listUrlEntries(
        { locale: CATALOG_LOCALE, entity_type: spec.type, entity_id: ids, status: "active" },
        { select: ["entity_id", "path"] }
      ),
  ])
  const paths = new Map(entries.map((entry) => [entry.entity_id, entry.path]))
  return new Map(
    (data as Row[]).map((row): [string, ResolvedLink] => {
      const path = paths.get(row.id) ?? null
      return [
        row.id,
        { name: row.name ?? row.title ?? null, path, broken: !spec.live(row) || path === null },
      ]
    })
  )
}

/** The published legal texts' titles by kind. */
async function legalTitles(container: Container): Promise<Map<string, string>> {
  const rows = await container
    .resolve<LegalModuleService>(LEGAL_MODULE)
    .listLegalDocuments({ status: "published" }, { select: ["kind", "title"] })
  return new Map(rows.map((row) => [row.kind, row.title]))
}

/** Which records exist at all, by kind (a draft counts: it is linked, shown once live). */
export async function existingRecords(
  container: Container,
  links: readonly { kind: MenuLinkKind; target: string | null }[]
): Promise<Set<string>> {
  const byKind = new Map<RecordLinkKind, string[]>()
  for (const link of links) {
    if (isRecordKind(link.kind) && link.target) {
      byKind.set(link.kind, [...(byKind.get(link.kind) ?? []), link.target])
    }
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const found = await Promise.all(
    [...byKind].map(async ([kind, ids]) => {
      const spec = RECORDS[kind]
      const { data } = await query.graph({
        entity: spec.entity,
        fields: ["id", ...(spec.fields.includes("kind") ? ["kind"] : [])],
        filters: { id: ids },
      })
      // A page's id must be a page, a post's a post
      return (data as Row[])
        .filter((row) => !row.kind || row.kind === kind)
        .map((row) => `${kind}:${row.id}`)
    })
  )
  return new Set(found.flat())
}

/**
 * Every link resolved at once (adr/0049): a record by its current name and
 * live path, a legal text by its published title, an address as written.
 * A record gone or not live, or a legal text not published, is broken.
 */
export async function resolveLinks(
  container: Container,
  links: readonly StoredLink[]
): Promise<Map<string, ResolvedLink>> {
  const byKind = new Map<RecordLinkKind, string[]>()
  for (const link of links) {
    if (isRecordKind(link.kind) && link.target) {
      byKind.set(link.kind, [...(byKind.get(link.kind) ?? []), link.target])
    }
  }
  const needsLegal = links.some((link) => link.kind === "legal")
  const [records, legal] = await Promise.all([
    Promise.all(
      [...byKind].map(
        async ([kind, ids]) => [kind, await recordLinks(container, kind, ids)] as const
      )
    ),
    needsLegal ? legalTitles(container) : Promise.resolve(new Map<string, string>()),
  ])
  const found = new Map(records)
  return new Map(
    links.map((link): [string, ResolvedLink] => {
      if (isRecordKind(link.kind)) {
        const record = link.target ? found.get(link.kind)?.get(link.target) : undefined
        return [link.id, record ?? { name: null, path: null, broken: true }]
      }
      if (link.kind === "legal") {
        const title = link.target ? legal.get(link.target) : undefined
        return [link.id, { name: title ?? null, path: null, broken: title === undefined }]
      }
      if (link.kind === "url") {
        return [link.id, { name: null, path: link.url, broken: link.url === null }]
      }
      return [link.id, { name: null, path: null, broken: false }]
    })
  )
}
