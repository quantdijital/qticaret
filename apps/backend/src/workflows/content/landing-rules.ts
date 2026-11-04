import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { EMPTY_DOC, docStats, summaryOf } from "../../lib/content"
import type { ContentDoc } from "../../lib/content"
import { fingerprint } from "../../lib/content/originality"
import { ValidationError } from "../../lib/errors"
import { toSlug } from "../../lib/seo/slug"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import type { LandingPageRecord } from "../../modules/content/service"
import { describeFacet, findFacet } from "./landing-facet"
import type { FacetName, LandingFacet } from "./landing-facet"
import { measuredLandings, shareAmong } from "./landing-originality"
import { handleOf } from "./handle"
import { CONTENT_LIMITS, assertCards, bodyOf, canonical, lineOf, mediaOf } from "./rules"

const SUMMARY_LENGTH = 300

export interface LandingInput {
  /** Set when the page is made; a page's category and facet do not change after. */
  category_id?: string | undefined
  facet?: LandingFacet | undefined
  title?: string | undefined
  handle?: string | undefined
  status?: "draft" | "published" | undefined
  body?: unknown
  /** A person read it through (docs/14 L-REVIEW-01). */
  reviewed?: boolean | undefined
}

export interface LandingFields {
  category_id: string
  facet_kind: LandingFacet["kind"]
  facet_key: string
  facet_value: string
  title: string
  handle: string
  status: "draft" | "published"
  body: ContentDoc
  body_summary: string
  word_count: number
  fingerprint_size: number
  fingerprint: number[]
  originality: number
  text_live_at: Date | null
  reviewed_at: Date | null
  published_at: Date | null
  revised_at: Date | null
}

export interface LandingPlan {
  fields: LandingFields
  media: string[]
  wasLive: boolean
}

const service = (container: MedusaContainer) =>
  container.resolve<ContentModuleService>(CONTENT_MODULE)

async function categoryName(container: MedusaContainer, id: string): Promise<string | null> {
  const [category] = await container
    .resolve(Modules.PRODUCT)
    .listProductCategories({ id }, { select: ["name"], take: 1 })
  return category?.name ?? null
}

/** One page per category and facet, one handle per category. */
async function assertFree(container: MedusaContainer, fields: LandingFields, id: string | null) {
  const [byFacet, byHandle] = await Promise.all([
    service(container).listLandingPages(
      {
        category_id: fields.category_id,
        facet_kind: fields.facet_kind,
        facet_key: fields.facet_key,
        facet_value: fields.facet_value,
      },
      { select: ["id"] }
    ),
    service(container).listLandingPages(
      { category_id: fields.category_id, handle: fields.handle },
      { select: ["id"] }
    ),
  ])
  if (byFacet.some((row) => row.id !== id)) {
    throw new ValidationError("content.landing_exists", { field: "facet" })
  }
  if (byHandle.some((row) => row.id !== id)) {
    throw new ValidationError("seo.path_taken", { field: "handle" })
  }
}

const facetOf = (input: LandingInput, current: LandingPageRecord | null): LandingFacet => {
  const facet = current
    ? { kind: current.facet_kind, key: current.facet_key, value: current.facet_value }
    : input.facet
  if (!facet) {
    throw new ValidationError("content.landing_facet_unknown", { field: "facet" })
  }
  return facet
}

// A person marked it read, or took the mark off; an untouched mark stays
function reviewedAt(input: LandingInput, current: LandingPageRecord | null, now: Date) {
  if (input.reviewed === undefined) {
    return current?.reviewed_at ?? null
  }
  return input.reviewed ? (current?.reviewed_at ?? now) : null
}

// After it first went live, a changed title or text dates a revision
function revisedAt(
  current: LandingPageRecord | null,
  next: { title: string; body: ContentDoc },
  now: Date
): Date | null {
  const changed =
    current?.published_at &&
    (next.title !== current.title || canonical(next.body) !== canonical(current.body))
  return changed ? now : (current?.revised_at ?? null)
}

/** The title and the text as they will be stored: `current` filled in with what the save sends. */
function textOf(input: LandingInput, current: LandingPageRecord | null, names: string[]) {
  const title = lineOf(
    input.title ?? current?.title ?? "",
    CONTENT_LIMITS.title,
    "content.title_invalid"
  )
  if (title === "") {
    throw new ValidationError("content.title_invalid", { field: "title" })
  }
  const body =
    input.body === undefined
      ? ((current?.body as ContentDoc | undefined) ?? EMPTY_DOC)
      : bodyOf(input.body)
  const stats = docStats(body)
  // A template with only the facet's and the category's names swapped is one text
  return { title, body, stats, print: fingerprint(stats.text, names) }
}

/**
 * Names that make the page's handle: the option's value may make no slug
 * (`42`, `_`), then its name does, then the title.
 */
const handleSource = (named: FacetName | null, title: string): string =>
  [named?.handle, named?.label].find((source) => source && toSlug(source) !== "") ?? title

/**
 * The facet's and the category's names. A new page's must exist; a saved
 * page's may be gone since (the page then shows no products, L-PRODUCTS-01).
 */
async function namesOf(
  container: MedusaContainer,
  categoryId: string,
  facet: LandingFacet,
  isNew: boolean
): Promise<{ named: FacetName | null; names: string[] }> {
  const [category, named] = await Promise.all([
    categoryName(container, categoryId),
    isNew ? describeFacet(container, facet) : findFacet(container, facet),
  ])
  if (isNew && category === null) {
    throw new ValidationError("content.landing_category_unknown", { field: "category_id" })
  }
  return { named, names: [named?.label, category].filter((name) => typeof name === "string") }
}

/**
 * When the page's text went live: now, as it goes live or its live text
 * changes; a draft has none. Only then is its text held to the gate.
 */
function textLiveAt(
  current: LandingPageRecord | null,
  next: { status: "draft" | "published"; body: ContentDoc },
  now: Date
): { at: Date | null; goesLive: boolean } {
  if (next.status !== "published") {
    return { at: null, goesLive: false }
  }
  const goesLive =
    current?.status !== "published" ||
    !current.text_live_at ||
    canonical(next.body) !== canonical(current.body)
  return { at: goesLive ? now : current.text_live_at, goesLive }
}

// A sent text's cards and images are checked; the stored one's were when it was sent
async function newMedia(
  container: MedusaContainer,
  input: LandingInput,
  text: ReturnType<typeof textOf>
): Promise<string[]> {
  if (input.body === undefined) {
    return []
  }
  await assertCards(container, text.body)
  return mediaOf(
    container,
    text.stats.images.map((image) => image.src),
    "body"
  )
}

/**
 * The landing page as it will be stored. Its text is measured against the
 * live pages whose text went live before it (`landing-originality`). A low
 * share is the advisor's warning (L-UNIQ-01), never a refusal: whether a
 * page goes live is the shop's call (the owner, 2026-11-04).
 */
export async function landingPlan(
  container: MedusaContainer,
  input: LandingInput,
  current: LandingPageRecord | null
): Promise<LandingPlan> {
  const categoryId = current?.category_id ?? input.category_id ?? ""
  const facet = facetOf(input, current)
  const { named, names } = await namesOf(container, categoryId, facet, !current)
  const text = textOf(input, current, names)
  const status = input.status ?? current?.status ?? "draft"
  const now = new Date()
  const live = textLiveAt(current, { status, body: text.body }, now)
  const own = shareAmong(
    text.print,
    live.at?.getTime() ?? Number.POSITIVE_INFINITY,
    current?.id ?? null,
    await measuredLandings(container, { status: "published" })
  )
  const fields: LandingFields = {
    category_id: categoryId,
    facet_kind: facet.kind,
    facet_key: facet.key,
    facet_value: facet.value,
    title: text.title,
    handle:
      input.handle === undefined && current
        ? current.handle
        : handleOf(input.handle, handleSource(named, text.title)),
    status,
    body: text.body,
    body_summary: summaryOf(text.stats.text, SUMMARY_LENGTH),
    word_count: text.stats.words,
    fingerprint_size: text.print.size,
    fingerprint: text.print.signature,
    originality: own,
    text_live_at: live.at,
    reviewed_at: reviewedAt(input, current, now),
    published_at: current?.published_at ?? (status === "published" ? now : null),
    revised_at: revisedAt(current, { title: text.title, body: text.body }, now),
  }
  await assertFree(container, fields, current?.id ?? null)
  const media = await newMedia(container, input, text)
  return { fields, media, wasLive: Boolean(current?.published_at) }
}
