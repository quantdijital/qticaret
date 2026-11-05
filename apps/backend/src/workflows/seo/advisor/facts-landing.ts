import type { MedusaContainer } from "@medusajs/framework/types"
import { docStats, renderDoc } from "../../../lib/content"
import type { ContentDoc } from "../../../lib/content"
import { keptOutOfSearch } from "../../../lib/content/originality"
import type { AdvisorFacts } from "../../../lib/seo/advisor"
import { BATCH_DAYS } from "../../../lib/seo/advisor/rules-landing"
import { CONTENT_MODULE } from "../../../modules/content"
import type ContentModuleService from "../../../modules/content/service"
import { CATALOG_ENTITY_TYPES } from "../../catalog/entity-paths"
import { landingProducts } from "../../content/landing-facet"
import { seoPayloadFor } from "../payload"
import { activePathOf } from "../redirects/owners"
import { OWN_FIELDS, duplicates, rowOf } from "./facts-common"
import type { Own } from "./facts-common"

interface LandingRow {
  id: string
  title: string
  handle: string
  status: "draft" | "published"
  category_id: string
  facet_kind: "brand" | "attribute"
  facet_key: string
  facet_value: string
  body: ContentDoc
  word_count: number
  originality: number
  reviewed_at?: string | Date | null
  published_at?: string | Date | null
  seo_meta?: Own | null
}

const DAY_MS = 24 * 60 * 60 * 1000

/** The landing pages that went live in the batch window, and how many of them a person read. */
async function batchOf(container: MedusaContainer, since: Date) {
  const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
  const [[, size], [, reviewed]] = await Promise.all([
    service.listAndCountLandingPages(
      { published_at: { $gte: since } },
      { select: ["id"], take: 1 }
    ),
    service.listAndCountLandingPages(
      { published_at: { $gte: since }, reviewed_at: { $ne: null } },
      { select: ["id"], take: 1 }
    ),
  ])
  return { size, reviewedShare: size === 0 ? 1 : reviewed / size }
}

const LANDING_FIELDS = [
  "id",
  "title",
  "handle",
  "status",
  "category_id",
  "facet_kind",
  "facet_key",
  "facet_value",
  "body",
  "word_count",
  "originality",
  "reviewed_at",
  "published_at",
  ...OWN_FIELDS,
]

/** Its originality as last measured, the products it lists, the batch it went live in. */
async function standingOf(
  container: MedusaContainer,
  row: LandingRow,
  now: Date
): Promise<NonNullable<AdvisorFacts["landing"]>> {
  const since = new Date(now.getTime() - BATCH_DAYS * DAY_MS)
  const [batch, listed] = await Promise.all([
    batchOf(container, since),
    landingProducts(
      container,
      {
        category_id: row.category_id,
        facet: { kind: row.facet_kind, key: row.facet_key, value: row.facet_value },
      },
      { skip: 0, take: 1 }
    ),
  ])
  return {
    words: row.word_count,
    originality: row.originality,
    products: listed.count,
    recent: Boolean(row.published_at && new Date(row.published_at) >= since),
    batchSize: batch.size,
    batchReviewedShare: batch.reviewedShare,
    reviewed: Boolean(row.reviewed_at),
  }
}

/**
 * A facet landing page's facts (F3.16, docs/14 §3.7): the search result
 * text as resolve builds it, its originality as last measured (at its save
 * and each night), the products it lists, and the batch it went live in.
 */
export async function landingFacts(
  container: MedusaContainer,
  id: string,
  now: Date = new Date()
): Promise<(AdvisorFacts & { isListed: boolean }) | null> {
  const row = await rowOf<LandingRow>(container, "landing_page", LANDING_FIELDS, id)
  if (!row) {
    return null
  }
  const owner = { entity_type: CATALOG_ENTITY_TYPES.landing, entity_id: id }
  const path = (await activePathOf(container, owner)) ?? `/${row.handle}`
  const seo = await seoPayloadFor(container, owner, path)
  const own = row.seo_meta ?? null
  const noindex = own?.robots_override?.startsWith("noindex") ?? false
  const title = seo?.title ?? row.title
  const description = seo?.description ?? ""
  return {
    // Kept out of search for its text (adr/0019 Ek 2026-11-05), it is no one's duplicate
    isListed:
      row.status === "published" &&
      !noindex &&
      !own?.canonical_override &&
      !keptOutOfSearch(row.originality),
    kind: "landing",
    name: row.title,
    handle: row.handle,
    title,
    titleIsOwn: Boolean(own?.seo_title),
    description,
    descriptionIsOwn: Boolean(own?.seo_description),
    body: docStats(row.body).text,
    bodyHtml: renderDoc(row.body),
    focusKeyword: own?.focus_keyword ?? null,
    duplicates: await duplicates(container, "landing", id, { title, description }),
    noindex,
    landing: await standingOf(container, row, now),
  }
}
