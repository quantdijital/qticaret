import { createHash } from "node:crypto"
import { docStats } from "../../../../lib/content"
import type { ContentDoc } from "../../../../lib/content"
import { toSlug } from "../../../../lib/seo"
import { CONTENT_MODULE } from "../../../../modules/content"
import type ContentModuleService from "../../../../modules/content/service"
import type { ContentEntryRecord } from "../../../../modules/content/service"
import type { AuditedResource, Resolver, Snapshot } from "../types"
import { ID } from "../types"

/**
 * Content pages and blog posts (F3.16, adr/0011): title, handle, status,
 * summary, author and cover before and after. The body is summed up by its
 * word count and a short digest, enough to see that it changed. A new
 * entry is found by the kind and handle its body gives.
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
]
