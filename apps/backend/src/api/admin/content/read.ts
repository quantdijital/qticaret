import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { containsPattern } from "../../../lib/security"
import { CONTENT_MODULE } from "../../../modules/content"
import type ContentModuleService from "../../../modules/content/service"
import type { ContentEntryRecord } from "../../../modules/content/service"
import { contentPath } from "../../../workflows/content/paths"
import type { AdminGetContentType } from "./validators"

const LIST_FIELDS = [
  "id",
  "kind",
  "title",
  "handle",
  "status",
  "excerpt",
  "author_name",
  "image_url",
  "published_at",
  "revised_at",
  "created_at",
  "updated_at",
] as const

type Listed = Pick<ContentEntryRecord, (typeof LIST_FIELDS)[number]>

const listed = (entry: Listed) => ({
  id: entry.id,
  kind: entry.kind,
  title: entry.title,
  handle: entry.handle,
  path: contentPath(entry),
  status: entry.status,
  excerpt: entry.excerpt,
  author_name: entry.author_name,
  image_url: entry.image_url,
  published_at: entry.published_at,
  revised_at: entry.revised_at,
  created_at: entry.created_at,
  updated_at: entry.updated_at,
})

/** A page of content entries by title, the most recently changed first; bodies left out. */
export async function readContentList(container: MedusaContainer, query: AdminGetContentType) {
  const [entries, count] = await container
    .resolve<ContentModuleService>(CONTENT_MODULE)
    .listAndCountContentEntries(
      {
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.q ? { title: { $ilike: containsPattern(query.q) } } : {}),
      },
      {
        select: [...LIST_FIELDS],
        skip: query.offset,
        take: query.limit,
        order: { updated_at: "DESC" },
      }
    )
  return { entries: entries.map(listed), count, offset: query.offset, limit: query.limit }
}

/** One entry with its document. */
export async function readContentEntry(container: MedusaContainer, id: string) {
  const [entry] = await container
    .resolve<ContentModuleService>(CONTENT_MODULE)
    .listContentEntries({ id }, { take: 1 })
  if (!entry) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "content.unknown")
  }
  return { ...listed(entry), body: entry.body, image_alt: entry.image_alt }
}
