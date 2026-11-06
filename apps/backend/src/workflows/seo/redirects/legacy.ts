import type { MedusaContainer } from "@medusajs/framework/types"
import { likeLiteral } from "../../../lib/db/like"
import { oldAddressOf } from "../../../lib/migration/addresses"
import { LISTING_PARAMS } from "../../../lib/seo/facets"
import { keptQuery, uploadStem, wordpressAddress } from "../../../lib/seo/legacy"
import type { LegacyAddress } from "../../../lib/seo/legacy"
import { encodePath } from "../../../lib/seo/redirects"
import type { RequestPath } from "../../../lib/seo/redirects"
import { toSlug } from "../../../lib/seo/slug"
import { postCategoryPath, postTagPath } from "../../../lib/seo/url-patterns"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"
import { MIGRATION_MODULE } from "../../../modules/migration"
import type MigrationModuleService from "../../../modules/migration/service"
import { SEO_REDIRECTS_MODULE } from "../../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../../modules/seo-redirects/service"
import { entityOf } from "../../migration/entities"
import { attachmentTarget } from "./legacy-attachment"
import { LIST_PAGES, pageCountOf } from "./legacy-pages"
import type { Follow } from "./legacy-pages"
import { activePathOf, ownerState } from "./owners"
import type { Resolution } from "./resolve"

export type { Follow } from "./legacy-pages"

/**
 * An old platform's own addresses (adr/0059): for a shop that moved from
 * WordPress, what WordPress served besides its records' permalinks (those
 * the URL registry keeps) answers with one 301 to the page that took its
 * place, or a 410 where none did. Asked last, for a path nothing else
 * here answers: no live page, rule or kept path is ever shadowed.
 */

type Answer = Exclude<Resolution, { type: "entity" }> | null

const WORDPRESS = "wordpress%"

/** Whether a WordPress migration was ever applied here; remembered with the resolve answers. */
async function movedFromWordpress(container: MedusaContainer): Promise<boolean> {
  const slot = await container
    .resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
    .resolutionSlot("legacy|wordpress")
  if (typeof slot.value === "boolean") {
    return slot.value
  }
  const [run] = await container
    .resolve<MigrationModuleService>(MIGRATION_MODULE)
    .listMigrationRuns({ source: { $like: WORDPRESS }, mode: "apply" }, { select: ["id"], take: 1 })
  slot.keep(run !== undefined)
  return run !== undefined
}

/** `target` (an encoded path, maybe with its own query) with `extra` set and the request's own parameters after. */
function locationOf(
  target: string,
  request: RequestPath,
  extra: Readonly<Record<string, string>> = {}
): string {
  const mark = target.indexOf("?")
  const query = new URLSearchParams(mark === -1 ? "" : target.slice(mark + 1))
  for (const [key, value] of Object.entries(extra)) {
    query.set(key, value)
  }
  for (const [key, value] of keptQuery(request.query)) {
    if (!query.has(key)) {
      query.append(key, value)
    }
  }
  const path = mark === -1 ? target : target.slice(0, mark)
  const search = query.toString()
  return search ? `${path}?${search}` : path
}

const moved = (location: string, status: 301 | 302 | 307 = 301): Answer => ({
  type: "redirect",
  path: "",
  status,
  location,
})
const GONE: Answer = { type: "gone", path: "" }

interface Item {
  kind: string
  source_key: string
  target_id: string | null
  status: string
  old_url: string | null
}

/** A migrated record's page today: its own path while live, else where its old path leads. */
async function recordAnswer(
  container: MedusaContainer,
  follow: Follow,
  items: readonly Item[],
  request: RequestPath
): Promise<Answer> {
  for (const item of items) {
    const entity_type = entityOf(item.kind)
    if (item.status === "done" && item.target_id && entity_type) {
      const owner = { entity_type, entity_id: item.target_id }
      const path =
        (await ownerState(container, owner)).kind === "live"
          ? await activePathOf(container, owner)
          : null
      if (path) {
        return moved(locationOf(encodePath(path), request))
      }
    }
    const old = item.old_url ? oldAddressOf(item.old_url) : null
    if (old && old.path !== "/") {
      const end = await follow({ path: old.path, query: new URLSearchParams() })
      if (end.type === "redirect") {
        return moved(locationOf(end.location, request), end.status)
      }
      if (end.type === "entity") {
        return moved(locationOf(encodePath(old.path), request))
      }
      if (end.type === "gone") {
        return GONE
      }
    }
  }
  // A record the old site had but nothing here shows (a draft): not found; one never moved: gone
  return items.length > 0 ? null : GONE
}

const items = (container: MedusaContainer, filters: Record<string, unknown>) =>
  container
    .resolve<MigrationModuleService>(MIGRATION_MODULE)
    .listMigrationItems(
      { source: { $like: WORDPRESS }, ...filters },
      { select: ["kind", "source_key", "target_id", "status", "old_url"], take: 20 }
    ) as Promise<Item[]>

// A slug as WordPress keeps it: as written, or percent-encoded (`%c3%a7aki`)
const slugForms = (slug: string) => [...new Set([slug, encodeURIComponent(slug).toLowerCase()])]

/** The moved file's address: the same file, else another size of the same upload. */
async function uploadAnswer(container: MedusaContainer, path: string): Promise<Answer> {
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const select = ["path", "media_id"]
  const exact = await migration.listMigrationFiles({ path }, { select, take: 1 })
  const rows =
    exact.length > 0
      ? exact
      : await migration.listMigrationFiles(
          { stem: uploadStem(path) },
          { select, take: 10, order: { path: "ASC" } }
        )
  const extension = (file: string) => /\.[a-z0-9]+$/.exec(file)?.[0] ?? ""
  rows.sort(
    (a, b) =>
      Number(extension(b.path) === extension(path)) - Number(extension(a.path) === extension(path))
  )
  const assets = rows.length
    ? await container
        .resolve<MediaModuleService>(MEDIA_MODULE)
        .listMediaAssets({ id: rows.map((row) => row.media_id) }, { select: ["id", "url"] })
    : []
  const urls = new Map(assets.map((asset) => [asset.id, asset.url]))
  // Only an asset's own address, never one a row could make up
  const url = rows
    .map((row) => urls.get(row.media_id))
    .find((each) => each !== undefined && /^(?:https?:\/\/|\/(?!\/))/i.test(each))
  return url ? moved(url) : GONE
}

/** A numbered page: the list's own page there while it has that many, else its first. */
async function pagedAnswer(
  container: MedusaContainer,
  follow: Follow,
  address: Extract<LegacyAddress, { kind: "paged" }>,
  request: RequestPath
): Promise<Answer> {
  const { base } = address
  const list = base.path === "/" ? null : await follow(base)
  let target: string
  let status: 301 | 302 | 307 = 301
  if (list?.type === "gone") {
    return GONE
  } else if (list?.type === "redirect") {
    target = list.location
    status = list.status
  } else if (list?.type === "entity" || base.path === "/" || LIST_PAGES.has(base.path)) {
    target = encodePath(base.path)
  } else {
    return null
  }
  // An archive that became one page (a date's, an author's) has no page of its own there
  const page = wordpressAddress(base) ? 1 : address.page
  const pages =
    page > 1 && target.startsWith("/") ? await pageCountOf(container, follow, target) : null
  const extra = pages !== null && page <= pages ? { [LISTING_PARAMS.page]: String(page) } : {}
  return moved(locationOf(target, request, extra), status)
}

/** A blog archive no migration kept: the blog's own for the same slug, else the blog. */
async function postTermAnswer(
  follow: Follow,
  address: Extract<LegacyAddress, { kind: "post_term" }>,
  request: RequestPath
): Promise<Answer> {
  const handle = toSlug(address.slug)
  const path = address.taxonomy === "tag" ? postTagPath(handle) : postCategoryPath(handle)
  const archive = handle ? await follow({ path, query: new URLSearchParams() }) : null
  if (archive?.type === "entity") {
    return moved(locationOf(encodePath(path), request))
  }
  return moved(locationOf("/blog", request))
}

const searchFor = (text: string, request: RequestPath) =>
  moved(locationOf(`/arama?${new URLSearchParams({ q: text }).toString()}`, request))

/** What the old platform's address answers here; null when it was none, or nothing took its place. */
async function wordpressAnswer(
  container: MedusaContainer,
  request: RequestPath,
  follow: Follow
): Promise<Answer> {
  const address = wordpressAddress(request)
  switch (address?.kind) {
    case undefined: {
      // None of WordPress's own: maybe an attachment page under a moved record
      const page = await attachmentTarget(container, follow, request.path)
      return page && moved(locationOf(page.location, request), page.status)
    }
    case "paged":
      return pagedAnswer(container, follow, address, request)
    case "record_id": {
      const found = await items(container, { source_key: address.keys })
      const order = (item: Item) => address.keys.indexOf(item.source_key)
      return recordAnswer(
        container,
        follow,
        found.sort((a, b) => order(a) - order(b)),
        request
      )
    }
    case "product_slug": {
      const forms = slugForms(address.slug).map(likeLiteral)
      const found = await items(container, {
        kind: "product",
        $or: forms.flatMap((slug) => [
          { old_url: { $ilike: `%/${slug}/` } },
          { old_url: { $ilike: `%/${slug}` } },
        ]),
      })
      return recordAnswer(container, follow, found, request)
    }
    case "category_slug": {
      const keys = slugForms(address.slug).map((slug) => `product_cat:${slug}`)
      const found = await items(container, { kind: "category", source_key: keys })
      return recordAnswer(container, follow, found, request)
    }
    case "product_tag":
      return searchFor(address.slug.replace(/[-_]+/g, " ").trim(), request)
    case "search":
      return searchFor(address.text, request)
    case "post_term":
      return postTermAnswer(follow, address, request)
    case "upload":
      return uploadAnswer(container, address.path)
    case "page":
      return moved(locationOf(address.path, request))
    case "gone":
      return GONE
  }
}

/**
 * The old platform's answer for `request` (adr/0059), or null. Only a
 * shop that moved from WordPress has these rules.
 */
export async function legacyResolution(
  container: MedusaContainer,
  request: RequestPath,
  follow: Follow
): Promise<Exclude<Resolution, { type: "entity" }> | null> {
  if (!(await movedFromWordpress(container))) {
    return null
  }
  const answer = await wordpressAnswer(container, request, follow)
  return answer && { ...answer, path: request.path }
}
