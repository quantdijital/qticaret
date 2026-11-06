import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { SLUG_MAX_LENGTH, postAuthorPath, toSlug } from "../../lib/seo"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import type { ContentAuthorRecord } from "../../modules/content/service"
import { URL_REGISTRY_MODULE } from "../../modules/url-registry"
import type UrlRegistryModuleService from "../../modules/url-registry/service"
import { CATALOG_ENTITY_TYPES, CATALOG_LOCALE } from "../catalog/entity-paths"
import { AUTHOR_LINKS, authorNameOf, bioOf, jobTitleOf, linkOf } from "./author-rules"
import type { AuthorLinkField } from "./author-rules"
import { handleOf } from "./handle"
import { mediaOf } from "./rules"

/**
 * A blog author as it will be stored (adr/0060): the pure rules, then a
 * handle no other author has (one made from the name takes the first free
 * `-2`, `-3`…; one typed and taken is refused), a photo from the shop's
 * media library and a staff account that exists.
 */

export interface AuthorInput {
  name?: string | undefined
  handle?: string | undefined
  job_title?: string | null | undefined
  bio?: string | null | undefined
  image_url?: string | null | undefined
  website_url?: string | null | undefined
  linkedin_url?: string | null | undefined
  instagram_url?: string | null | undefined
  x_url?: string | null | undefined
  user_id?: string | null | undefined
}

export interface AuthorFields extends Record<AuthorLinkField, string | null> {
  name: string
  handle: string
  job_title: string | null
  bio: string | null
  image_url: string | null
  user_id: string | null
}

export interface AuthorPlan {
  fields: AuthorFields
  /** The photo's media record, to keep its file (F3.3). */
  media: string[]
}

// How far a handle made from the name counts up before the save says it is taken
const MAX_SUFFIX = 50

/** Whether no other author has the handle, nor any other record its path in the registry. */
export async function isAuthorHandleFree(
  container: MedusaContainer,
  handle: string,
  id: string | null
): Promise<boolean> {
  const [authors, paths] = await Promise.all([
    container
      .resolve<ContentModuleService>(CONTENT_MODULE)
      .listContentAuthors({ handle }, { select: ["id"] }),
    container
      .resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
      .listUrlEntries(
        { locale: CATALOG_LOCALE, path: postAuthorPath(handle) },
        { select: ["entity_type", "entity_id"] }
      ),
  ])
  return (
    authors.every((author) => author.id === id) &&
    paths.every(
      (entry) => entry.entity_type === CATALOG_ENTITY_TYPES.post_author && entry.entity_id === id
    )
  )
}

/** A handle made from the name, or `-2`, `-3`… after it when another author has it. */
export async function freeAuthorHandle(
  container: MedusaContainer,
  base: string,
  id: string | null
): Promise<string> {
  for (let count = 1; count <= MAX_SUFFIX; count += 1) {
    const suffix = count === 1 ? "" : `-${String(count)}`
    const handle = `${toSlug(base, SLUG_MAX_LENGTH - suffix.length)}${suffix}`
    if (await isAuthorHandleFree(container, handle, id)) {
      return handle
    }
  }
  return toSlug(base)
}

async function assertUser(container: MedusaContainer, userId: string): Promise<void> {
  const users = await container
    .resolve(Modules.USER)
    .listUsers({ id: userId }, { select: ["id"], take: 1 })
  if (users.length === 0) {
    throw new ValidationError("content.author_user_unknown", { field: "user_id" })
  }
}

/** `current` filled in with what the save sends; a field left out keeps its value, `null` clears. */
export async function authorPlan(
  container: MedusaContainer,
  input: AuthorInput,
  current: ContentAuthorRecord | null
): Promise<AuthorPlan> {
  const keep = (
    key: Exclude<keyof AuthorInput & keyof AuthorFields, "name" | "handle">,
    read: (raw: string | null) => string | null
  ): string | null =>
    input[key] === undefined ? (current?.[key] ?? null) : read(input[key] ?? null)
  // "" is none, as null is
  const idOrNone = (raw: string | null) => (raw?.trim() ? raw.trim() : null)
  const name = authorNameOf(input.name ?? current?.name ?? "")
  const typed = input.handle?.trim() ?? ""
  let handle = input.handle === undefined && current ? current.handle : handleOf(typed, name)
  if (typed === "" && !(input.handle === undefined && current)) {
    handle = await freeAuthorHandle(container, handle, current?.id ?? null)
  }
  if (!(await isAuthorHandleFree(container, handle, current?.id ?? null))) {
    throw new ValidationError("content.author_handle_taken", { field: "handle" })
  }
  const links = Object.fromEntries(
    AUTHOR_LINKS.map((field) => [field, keep(field, (raw) => linkOf(raw, field))])
  ) as Record<AuthorLinkField, string | null>
  const fields: AuthorFields = {
    name,
    handle,
    job_title: keep("job_title", jobTitleOf),
    bio: keep("bio", bioOf),
    image_url: keep("image_url", idOrNone),
    ...links,
    user_id: keep("user_id", idOrNone),
  }
  if (input.user_id && fields.user_id) {
    await assertUser(container, fields.user_id)
  }
  const media =
    input.image_url !== undefined && fields.image_url
      ? await mediaOf(container, [fields.image_url], "image_url")
      : []
  return { fields, media }
}
