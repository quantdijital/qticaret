import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { EMPTY_DOC, contentDoc, docStats, summaryOf } from "../../lib/content"
import type { ContentDoc } from "../../lib/content"
import { ValidationError } from "../../lib/errors"
import { isCleanText } from "../../lib/security"
import { isValidSlug, toSlug } from "../../lib/seo"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import type { ContentEntryRecord, ContentKind } from "../../modules/content/service"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"

/**
 * What a content save may hold (F3.16, adr/0019): clean text, a slug handle
 * one entry of its kind has, a checked document, images uploaded to the
 * shop's media library only, and cards for products and categories that
 * exist. References are checked when the save sends them: a product
 * deleted since leaves its card out on the page, it does not lock the page.
 */

export const CONTENT_LIMITS = { title: 200, excerpt: 500, author: 120, imageAlt: 300 } as const
// The body's opening kept for lists and descriptions
const SUMMARY_LENGTH = 300

export interface ContentInput {
  title?: string | undefined
  handle?: string | undefined
  status?: "draft" | "published" | undefined
  /** Checked by the route's validator (`contentDoc`), and again here. */
  body?: unknown
  excerpt?: string | null | undefined
  author_name?: string | null | undefined
  image_url?: string | null | undefined
  image_alt?: string | null | undefined
}

export interface ContentFields {
  kind: ContentKind
  title: string
  handle: string
  status: "draft" | "published"
  body: ContentDoc
  body_summary: string
  word_count: number
  excerpt: string | null
  author_name: string | null
  image_url: string | null
  image_alt: string | null
  published_at: Date | null
  revised_at: Date | null
}

export interface ContentPlan {
  fields: ContentFields
  /** The media records its new images use, to keep their files (F3.3). */
  media: string[]
  /** Whether it was live before this save: an old path it leaves is then kept for a 301. */
  wasLive: boolean
}

function lineOf(raw: string, max: number, key: string): string {
  const text = raw.trim().replace(/\s+/g, " ")
  if (text.length > max || !isCleanText(text)) {
    throw new ValidationError(key, { field: key.split(".")[1] ?? key })
  }
  return text
}

const optional = (raw: string | null, max: number, key: string): string | null =>
  raw === null || raw.trim() === "" ? null : lineOf(raw, max, key)

function handleOf(raw: string | undefined, title: string): string {
  const handle = raw === undefined || raw.trim() === "" ? toSlug(title) : raw.trim()
  if (handle === "") {
    throw new ValidationError("catalog.handle_required", { field: "handle" })
  }
  if (!isValidSlug(handle)) {
    throw new ValidationError("catalog.handle_invalid", { field: "handle" })
  }
  return handle
}

/** The document checked again (an import or job may skip the route), as the schema shapes it. */
function bodyOf(raw: unknown): ContentDoc {
  const parsed = contentDoc.safeParse(raw)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message
    throw new ValidationError(
      message === "content.too_large" ? "content.too_large" : "content.body_invalid",
      { field: "body" }
    )
  }
  return parsed.data
}

// Both sides through one schema, so key order (jsonb keeps its own) does not count as a change
const canonical = (body: unknown): string | null => {
  const parsed = contentDoc.safeParse(body)
  return parsed.success ? JSON.stringify(parsed.data) : null
}

/** The uploaded media records behind these addresses; one that is not the shop's upload refuses the save. */
async function mediaOf(container: MedusaContainer, urls: string[], field: string) {
  const unique = [...new Set(urls)]
  if (unique.length === 0) {
    return []
  }
  const assets = await container
    .resolve<MediaModuleService>(MEDIA_MODULE)
    .listMediaAssets({ url: unique, file_id: { $ne: null } }, { select: ["id", "url"] })
  if (assets.length < unique.length) {
    throw new ValidationError("content.image_unknown", { field })
  }
  return assets.map((asset) => asset.id)
}

async function assertCards(container: MedusaContainer, doc: ContentDoc): Promise<void> {
  const { product, category } = docStats(doc).cards
  const products = [...new Set(product)]
  const categories = [...new Set(category)]
  const service = container.resolve(Modules.PRODUCT)
  const [foundProducts, foundCategories] = await Promise.all([
    products.length ? service.listProducts({ id: products }, { select: ["id"] }) : [],
    categories.length ? service.listProductCategories({ id: categories }, { select: ["id"] }) : [],
  ])
  if (foundProducts.length < products.length || foundCategories.length < categories.length) {
    throw new ValidationError("content.card_unknown", { field: "body" })
  }
}

async function assertHandleFree(
  container: MedusaContainer,
  fields: ContentFields,
  id: string | null
) {
  const taken = await container
    .resolve<ContentModuleService>(CONTENT_MODULE)
    .listContentEntries({ kind: fields.kind, handle: fields.handle }, { select: ["id"] })
  if (taken.some((entry) => entry.id !== id)) {
    throw new ValidationError("seo.path_taken", { field: "handle" })
  }
}

/** The text fields as they will be stored: `current` filled in with what the save sends. */
function textFields(input: ContentInput, current: ContentEntryRecord | null) {
  const title = lineOf(
    input.title ?? current?.title ?? "",
    CONTENT_LIMITS.title,
    "content.title_invalid"
  )
  if (title === "") {
    throw new ValidationError("content.title_invalid", { field: "title" })
  }
  const keep = (key: "excerpt" | "author_name" | "image_alt", max: number, error: string) =>
    input[key] === undefined ? (current?.[key] ?? null) : optional(input[key] ?? null, max, error)
  // "" takes the cover off, as null does
  const sentCover = input.image_url?.trim()
  const cover =
    input.image_url === undefined
      ? (current?.image_url ?? null)
      : sentCover === undefined || sentCover === ""
        ? null
        : sentCover
  return {
    title,
    handle: input.handle === undefined && current ? current.handle : handleOf(input.handle, title),
    excerpt: keep("excerpt", CONTENT_LIMITS.excerpt, "content.excerpt_invalid"),
    author_name: keep("author_name", CONTENT_LIMITS.author, "content.author_invalid"),
    image_url: cover,
    image_alt: keep("image_alt", CONTENT_LIMITS.imageAlt, "content.image_alt_invalid"),
  }
}

/**
 * The entry as it will be stored. Going live the first time sets
 * `published_at`; a changed title or body after that sets `revised_at`.
 */
export async function contentPlan(
  container: MedusaContainer,
  kind: ContentKind,
  input: ContentInput,
  current: ContentEntryRecord | null
): Promise<ContentPlan> {
  const text = textFields(input, current)
  const body =
    input.body === undefined
      ? ((current?.body as ContentDoc | undefined) ?? EMPTY_DOC)
      : bodyOf(input.body)
  const status = input.status ?? current?.status ?? "draft"
  const now = new Date()
  const revised = current?.published_at
    ? text.title !== current.title || canonical(body) !== canonical(current.body)
    : false
  const stats = docStats(body)
  const fields: ContentFields = {
    kind,
    ...text,
    status,
    body,
    body_summary: summaryOf(stats.text, SUMMARY_LENGTH),
    word_count: stats.words,
    published_at: current?.published_at ?? (status === "published" ? now : null),
    revised_at: revised ? now : (current?.revised_at ?? null),
  }
  await assertHandleFree(container, fields, current?.id ?? null)
  const media: string[] = []
  if (input.body !== undefined) {
    await assertCards(container, body)
    media.push(
      ...(await mediaOf(
        container,
        stats.images.map((image) => image.src),
        "body"
      ))
    )
  }
  if (input.image_url !== undefined && fields.image_url) {
    media.push(...(await mediaOf(container, [fields.image_url], "image_url")))
  }
  return { fields, media, wasLive: Boolean(current?.published_at) }
}
