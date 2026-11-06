import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { containsPattern } from "../../../../lib/security"
import { CONTENT_MODULE } from "../../../../modules/content"
import type ContentModuleService from "../../../../modules/content/service"
import type { ContentAuthorRecord } from "../../../../modules/content/service"
import { authorPostCounts, authorView } from "../../../../workflows/content/author-reads"
import type { AdminGetContentAuthorsType } from "./validators"

const FIELDS = [
  "id",
  "name",
  "handle",
  "job_title",
  "bio",
  "image_url",
  "website_url",
  "linkedin_url",
  "instagram_url",
  "x_url",
  "user_id",
  "created_at",
  "updated_at",
] as const

type Author = Pick<ContentAuthorRecord, (typeof FIELDS)[number]>

interface StaffUser {
  id: string
  email: string
  name: string | null
}

/** The staff accounts the authors are tied to, by id; a deleted one is not there. */
async function usersOf(container: MedusaContainer, authors: Author[]) {
  const ids = [...new Set(authors.flatMap((author) => author.user_id ?? []))]
  if (ids.length === 0) {
    return new Map<string, StaffUser>()
  }
  const users = await container
    .resolve(Modules.USER)
    .listUsers({ id: ids }, { select: ["id", "email", "first_name", "last_name"], take: null })
  return new Map(
    users.map((user) => [
      user.id,
      {
        id: user.id,
        email: user.email,
        name: [user.first_name, user.last_name].filter(Boolean).join(" ") || null,
      },
    ])
  )
}

/** Authors as the panel shows them, with their staff account and how many posts (drafts too) and live posts. */
async function shown(container: MedusaContainer, authors: Author[]) {
  const ids = authors.map((author) => author.id)
  const [posts, live, users] = await Promise.all([
    authorPostCounts(container, ids, { live: false }),
    authorPostCounts(container, ids, { live: true }),
    usersOf(container, authors),
  ])
  return authors.map((author) => ({
    ...authorView(author),
    bio: author.bio,
    image_url: author.image_url,
    website_url: author.website_url,
    linkedin_url: author.linkedin_url,
    instagram_url: author.instagram_url,
    x_url: author.x_url,
    user_id: author.user_id,
    user: author.user_id ? (users.get(author.user_id) ?? null) : null,
    post_count: posts.get(author.id) ?? 0,
    live_post_count: live.get(author.id) ?? 0,
    created_at: author.created_at,
    updated_at: author.updated_at,
  }))
}

/** A page of a blog's authors by name. */
export async function readAuthorList(
  container: MedusaContainer,
  query: AdminGetContentAuthorsType
) {
  const [authors, count] = await container
    .resolve<ContentModuleService>(CONTENT_MODULE)
    .listAndCountContentAuthors(query.q ? { name: { $ilike: containsPattern(query.q) } } : {}, {
      select: [...FIELDS],
      skip: query.offset,
      take: query.limit,
      order: { name: "ASC" },
    })
  return {
    authors: authors.length > 0 ? await shown(container, authors) : [],
    count,
    offset: query.offset,
    limit: query.limit,
  }
}

export async function readAuthor(container: MedusaContainer, id: string) {
  const [author] = await container
    .resolve<ContentModuleService>(CONTENT_MODULE)
    .listContentAuthors({ id }, { select: [...FIELDS], take: 1 })
  if (!author) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "content.author_unknown")
  }
  const [one] = await shown(container, [author])
  return one
}
