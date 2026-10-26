import { createHash } from "node:crypto"
import { docStats } from "../../../../lib/content"
import type { ContentDoc } from "../../../../lib/content"
import { toSlug } from "../../../../lib/seo"
import { CONTENT_MODULE } from "../../../../modules/content"
import type ContentModuleService from "../../../../modules/content/service"
import type { ContentEntryRecord, LandingPageRecord } from "../../../../modules/content/service"
import type { AuditedResource, Resolver, Snapshot } from "../types"
import { ID } from "../types"

/**
 * Content pages, blog posts and landing pages (F3.16, adr/0011): title, handle, status,
 * summary, author and cover before and after. The body is summed up by its
 * word count and a short digest, enough to see that it changed. A new
 * entry is found by the kind and handle its body gives; a new landing page
 * by its category and facet (one page each).
 */

const content = (scope: Resolver) => scope.resolve(CONTENT_MODULE) as ContentModuleService

function snapshotOf(entry: ContentEntryRecord | undefined): Snapshot {
  if (!entry) {
    return {}
  }
  const body = JSON.stringify(entry.body)
  return {
    kind: entry.kind,
    title: entry.title,
    handle: entry.handle,
    status: entry.status,
    excerpt: entry.excerpt,
    author_name: entry.author_name,
    image_url: entry.image_url,
    image_alt: entry.image_alt,
    published_at: entry.published_at ? new Date(entry.published_at).toISOString() : null,
    body_words: docStats(entry.body as unknown as ContentDoc).words,
    body_digest: createHash("sha256").update(body).digest("hex").slice(0, 16),
  }
}

async function byId(scope: Resolver, id: string): Promise<Snapshot> {
  const [entry] = await content(scope).listContentEntries({ id }, { take: 1 })
  return snapshotOf(entry)
}

async function byHandle(scope: Resolver, body: unknown): Promise<Snapshot> {
  const { kind, handle, title } = (body ?? {}) as {
    kind?: unknown
    handle?: unknown
    title?: unknown
  }
  const wanted =
    typeof handle === "string" && handle.trim() !== ""
      ? handle.trim()
      : typeof title === "string"
        ? toSlug(title)
        : ""
  if ((kind !== "page" && kind !== "post") || wanted === "") {
    return {}
  }
  const [entry] = await content(scope).listContentEntries({ kind, handle: wanted }, { take: 1 })
  return snapshotOf(entry)
}

const isoOf = (value: Date | string | null) => (value ? new Date(value).toISOString() : null)

function landingSnapshot(landing: LandingPageRecord | undefined): Snapshot {
  return landing
    ? {
        category_id: landing.category_id,
        facet: `${landing.facet_kind}:${landing.facet_key}=${landing.facet_value}`,
        title: landing.title,
        handle: landing.handle,
        status: landing.status,
        originality: landing.originality,
        reviewed_at: isoOf(landing.reviewed_at),
        published_at: isoOf(landing.published_at),
        body_words: landing.word_count,
        body_digest: createHash("sha256")
          .update(JSON.stringify(landing.body))
          .digest("hex")
          .slice(0, 16),
      }
    : {}
}

async function landingById(scope: Resolver, id: string): Promise<Snapshot> {
  const [landing] = await content(scope).listLandingPages({ id }, { take: 1 })
  return landingSnapshot(landing)
}

async function landingByFacet(scope: Resolver, body: unknown): Promise<Snapshot> {
  const { category_id: categoryId, facet } = (body ?? {}) as {
    category_id?: unknown
    facet?: { kind?: unknown; key?: unknown; value?: unknown } | null
  }
  const { kind, key, value } = facet ?? {}
  if (
    typeof categoryId !== "string" ||
    (kind !== "brand" && kind !== "attribute") ||
    typeof key !== "string" ||
    typeof value !== "string"
  ) {
    return {}
  }
  const [landing] = await content(scope).listLandingPages(
    { category_id: categoryId, facet_kind: kind, facet_key: key, facet_value: value },
    { take: 1 }
  )
  return landingSnapshot(landing)
}

export const CONTENT_RESOURCES: readonly AuditedResource[] = [
  {
    method: "POST",
    route: "POST /admin/content",
    pattern: /^\/admin\/content$/i,
    resourceType: "content_entry",
    resourceId: () => null,
    snapshot: ({ scope, body }) => byHandle(scope, body),
  },
  ...(["POST", "DELETE"] as const).map((method) => ({
    method,
    route: `${method} /admin/content/:id`,
    pattern: new RegExp(`^/admin/content/(?<id>${ID})$`, "i"),
    resourceType: "content_entry",
    resourceId: (params: Record<string, string>) => params["id"] ?? null,
    snapshot: ({ scope, params }: { scope: Resolver; params: Record<string, string> }) =>
      byId(scope, params["id"] ?? ""),
  })),
  {
    method: "POST",
    route: "POST /admin/landings",
    pattern: /^\/admin\/landings$/i,
    resourceType: "landing_page",
    resourceId: () => null,
    snapshot: ({ scope, body }) => landingByFacet(scope, body),
  },
  ...(["POST", "DELETE"] as const).map((method) => ({
    method,
    route: `${method} /admin/landings/:id`,
    pattern: new RegExp(`^/admin/landings/(?<id>${ID})$`, "i"),
    resourceType: "landing_page",
    resourceId: (params: Record<string, string>) => params["id"] ?? null,
    snapshot: ({ scope, params }: { scope: Resolver; params: Record<string, string> }) =>
      landingById(scope, params["id"] ?? ""),
  })),
]
