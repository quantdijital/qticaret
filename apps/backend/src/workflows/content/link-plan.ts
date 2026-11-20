import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { ContentDoc } from "../../lib/content/doc"
import { docHrefs } from "../../lib/content/links"
import {
  bareHost,
  internalLinkOf,
  isHostname,
  isStorefrontPage,
  outcomeOf,
} from "../../lib/seo/internal-links"
import type { LinkAnswer, LinkOutcome, UnresolvedReason } from "../../lib/seo/internal-links"
import { isBackendPath, parseRequestPath } from "../../lib/seo/redirects"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { followPath } from "../seo/redirects/resolve"
import { draftPageTexts } from "./link-layout"

/**
 * What a link rewrite would do (adr/0042 Ek 2026-11-05): every content
 * document read (pages, as their text sections stand in the theme
 * editor's draft; posts; products' descriptions), each link to the
 * shop resolved once as the storefront would resolve it, the links that
 * move and those that answer nothing listed. Reads only.
 */

type Container = Pick<MedusaContainer, "resolve">

const PAGE = 200

export type LinkDocKind = "page" | "post" | "product"

/** One link of one document: where it goes now, or why it goes nowhere. */
export interface LinkRow {
  kind: LinkDocKind
  id: string
  title: string
  href: string
  /** The new address; null when unresolved. */
  target: string | null
  reason: UnresolvedReason | null
}

/** Which documents: none named is every one of that kind; an empty list is none. */
export interface LinkScope {
  entries?: string[] | null
  products?: string[] | null
}

export interface LinkPlan {
  /** Documents read. */
  documents: number
  /** Each changed link's new address, by its old one (the same wherever it stands). */
  next: Record<string, string>
  /** The documents with a link to change. */
  writes: { entries: string[]; products: { product_id: string; extension_id: string }[] }
  changed: LinkRow[]
  unresolved: LinkRow[]
}

interface LinkDocument {
  kind: LinkDocKind
  id: string
  extension_id?: string
  title: string
  doc: ContentDoc | null
}

/**
 * The shop's hosts: its own domain (`seo.canonical_host`), the old sites
 * its migrations came from (`wordpress:mylarte.com`, `shopify:…`), and
 * any the caller names.
 */
export async function linkHosts(container: Container, extra: readonly string[] = []) {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const seo = (await settings.getSection("seo")) as { canonical_host?: string | null }
  const items = await container
    .resolve<MigrationModuleService>(MIGRATION_MODULE)
    // The sources that moved texts in (not each customer's row)
    .listMigrationItems({ kind: ["post", "page", "product"] }, { select: ["source"], take: null })
  const fromSources = items.map((item) => item.source.split(":").slice(1).join(":"))
  return new Set(
    [seo.canonical_host ?? "", ...fromSources, ...extra].filter(isHostname).map(bareHost)
  )
}

/**
 * What the shop answers at an address today, as a storefront request
 * would get it: its own pages as they are, the registry's live record, a
 * chain followed to its end (only a page that answers is a new address).
 */
export async function lookupLink(container: Container, raw: string): Promise<LinkAnswer> {
  const request = parseRequestPath(raw)
  if (!request || isBackendPath(request.path)) {
    return { type: "not_found" }
  }
  if (isStorefrontPage(request.path)) {
    return { type: "live", path: request.path }
  }
  const scope = container as MedusaContainer
  const { resolution } = await followPath(scope, request, { countHits: false })
  if (resolution.type !== "redirect") {
    return resolution.type === "entity" ? { type: "live", path: resolution.path } : resolution
  }
  const end = parseRequestPath(resolution.location)
  if (!end) {
    return { type: "not_found" }
  }
  if (isStorefrontPage(end.path)) {
    return { type: "moved", location: resolution.location }
  }
  const last = (await followPath(scope, end, { countHits: false })).resolution
  if (last.type === "entity") {
    return { type: "moved", location: resolution.location }
  }
  return { type: last.type === "gone" ? "gone" : "not_found" }
}

async function* contentDocuments(
  container: Container,
  ids: readonly string[] | null
): AsyncGenerator<LinkDocument> {
  if (ids?.length === 0) {
    return
  }
  // A page's text is its sections' in the draft (adr/0073 Ek 2026-11-19 (2) K7)
  const texts = await draftPageTexts(container)
  const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
  for (let skip = 0; ; skip += PAGE) {
    const rows = await service.listContentEntries(ids ? { id: [...ids] } : {}, {
      select: ["id", "kind", "title", "body"],
      skip,
      take: PAGE,
      order: { id: "ASC" },
    })
    for (const row of rows) {
      yield {
        kind: row.kind,
        id: row.id,
        title: row.title,
        doc:
          (row.kind === "page" ? texts.get(row.id) : undefined) ??
          (row.body as unknown as ContentDoc | null),
      }
    }
    if (rows.length < PAGE) {
      return
    }
  }
}

interface ProductRow {
  id: string
  title: string
  product_extension?: { id: string; description_doc: ContentDoc | null } | null
}

async function* productDocuments(
  container: Container,
  ids: readonly string[] | null
): AsyncGenerator<LinkDocument> {
  if (ids?.length === 0) {
    return
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  for (let skip = 0; ; skip += PAGE) {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "title", "product_extension.id", "product_extension.description_doc"],
      filters: ids ? { id: [...ids] } : {},
      pagination: { skip, take: PAGE, order: { id: "ASC" } },
    })
    const rows = data as unknown as ProductRow[]
    for (const row of rows) {
      const extension = row.product_extension
      if (extension?.description_doc) {
        yield {
          kind: "product",
          id: row.id,
          extension_id: extension.id,
          title: row.title,
          doc: extension.description_doc,
        }
      }
    }
    if (rows.length < PAGE) {
      return
    }
  }
}

/**
 * The plan for the documents in `scope`: each distinct link resolved once
 * (a link elsewhere never), `progress` told every page of documents.
 */
export async function planContentLinks(
  container: Container,
  input: { scope?: LinkScope; hosts?: readonly string[] },
  progress: (documents: number) => Promise<void> = () => Promise.resolve()
): Promise<LinkPlan> {
  const hosts = await linkHosts(container, input.hosts ?? [])
  const answers = new Map<string, LinkOutcome | null>()
  const outcome = async (href: string): Promise<LinkOutcome | null> => {
    if (!answers.has(href)) {
      const link = internalLinkOf(href, hosts)
      answers.set(
        href,
        link
          ? outcomeOf(href, link, await lookupLink(container, `${link.path}${link.query}`))
          : null
      )
    }
    return answers.get(href) ?? null
  }
  const plan: LinkPlan = {
    documents: 0,
    next: {},
    writes: { entries: [], products: [] },
    changed: [],
    unresolved: [],
  }
  const sources = [
    contentDocuments(container, input.scope?.entries ?? null),
    productDocuments(container, input.scope?.products ?? null),
  ]
  for (const documents of sources) {
    for await (const document of documents) {
      plan.documents += 1
      let moves = false
      for (const href of docHrefs(document.doc)) {
        const result = await outcome(href)
        if (!result || result.status === "same") {
          continue
        }
        const row = { kind: document.kind, id: document.id, title: document.title, href }
        if (result.status === "changed") {
          plan.next[href] = result.href
          plan.changed.push({ ...row, target: result.href, reason: null })
          moves = true
        } else {
          plan.unresolved.push({ ...row, target: null, reason: result.reason })
        }
      }
      if (moves && document.kind === "product" && document.extension_id) {
        plan.writes.products.push({ product_id: document.id, extension_id: document.extension_id })
      } else if (moves) {
        plan.writes.entries.push(document.id)
      }
      if (plan.documents % PAGE === 0) {
        await progress(plan.documents)
      }
    }
  }
  return plan
}
