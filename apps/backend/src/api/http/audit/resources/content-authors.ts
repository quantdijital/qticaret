import { toSlug } from "../../../../lib/seo"
import { CONTENT_MODULE } from "../../../../modules/content"
import type ContentModuleService from "../../../../modules/content/service"
import type { AuditedResource, Resolver, Snapshot } from "../types"
import { ID } from "../types"

/**
 * Blog authors (adr/0060, adr/0011): their fields before and after, the
 * bio by its length (it is published text, but long). A new author is
 * found by the handle their body gives.
 */

const content = (scope: Resolver) => scope.resolve(CONTENT_MODULE) as ContentModuleService

async function authorSnapshot(scope: Resolver, filters: Record<string, string>): Promise<Snapshot> {
  const [author] = await content(scope).listContentAuthors(filters, { take: 1 })
  return author
    ? {
        name: author.name,
        handle: author.handle,
        job_title: author.job_title,
        bio_length: author.bio?.length ?? 0,
        image_url: author.image_url,
        website_url: author.website_url,
        linkedin_url: author.linkedin_url,
        instagram_url: author.instagram_url,
        x_url: author.x_url,
        user_id: author.user_id,
      }
    : {}
}

async function authorByHandle(scope: Resolver, body: unknown): Promise<Snapshot> {
  const { handle, name } = (body ?? {}) as { handle?: unknown; name?: unknown }
  const wanted =
    typeof handle === "string" && handle.trim() !== ""
      ? handle.trim()
      : typeof name === "string"
        ? toSlug(name)
        : ""
  return wanted !== "" ? authorSnapshot(scope, { handle: wanted }) : {}
}

export const CONTENT_AUTHOR_RESOURCES: readonly AuditedResource[] = [
  {
    method: "POST",
    route: "POST /admin/content/authors",
    pattern: /^\/admin\/content\/authors$/i,
    resourceType: "content_author",
    resourceId: () => null,
    snapshot: ({ scope, body }) => authorByHandle(scope, body),
  },
  ...(["POST", "DELETE"] as const).map((method) => ({
    method,
    route: `${method} /admin/content/authors/:id`,
    pattern: new RegExp(`^/admin/content/authors/(?<id>${ID})$`, "i"),
    resourceType: "content_author",
    resourceId: (params: Record<string, string>) => params["id"] ?? null,
    snapshot: ({ scope, params }: { scope: Resolver; params: Record<string, string> }) =>
      authorSnapshot(scope, { id: params["id"] ?? "" }),
  })),
]
