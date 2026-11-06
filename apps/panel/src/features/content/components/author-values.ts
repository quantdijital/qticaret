import { AUTHOR_LINKS } from "@/features/content/api/authors"
import type { Author, AuthorInput } from "@/features/content/api/authors"

/** An author's form as typed: every field a string, "" for none. */
export interface AuthorValues {
  name: string
  handle: string
  job_title: string
  bio: string
  image_url: string
  website_url: string
  linkedin_url: string
  instagram_url: string
  x_url: string
  user_id: string
}

export const EMPTY_AUTHOR: AuthorValues = {
  name: "",
  handle: "",
  job_title: "",
  bio: "",
  image_url: "",
  website_url: "",
  linkedin_url: "",
  instagram_url: "",
  x_url: "",
  user_id: "",
}

export const authorValuesOf = (author: Author): AuthorValues => ({
  name: author.name,
  handle: author.handle,
  job_title: author.job_title ?? "",
  bio: author.bio ?? "",
  image_url: author.image_url ?? "",
  website_url: author.website_url ?? "",
  linkedin_url: author.linkedin_url ?? "",
  instagram_url: author.instagram_url ?? "",
  x_url: author.x_url ?? "",
  user_id: author.user_id ?? "",
})

type Dirty = Partial<Record<keyof AuthorValues, boolean>>

const ALL: Dirty = Object.fromEntries(Object.keys(EMPTY_AUTHOR).map((key) => [key, true]))

/**
 * What a save sends, as the server takes it: the fields that changed (a
 * new author's every field), "" as null. An emptied address keeps the
 * stored one; a new author's comes from the name.
 */
export function authorBodyOf(values: AuthorValues, dirty: Dirty | null): AuthorInput {
  const changed = dirty ?? ALL
  const text = (value: string) => value.trim() || null
  const body: AuthorInput = {}
  if (changed.name) {
    body.name = values.name.trim()
  }
  if (changed.handle && values.handle.trim() !== "") {
    body.handle = values.handle.trim()
  }
  if (changed.job_title) {
    body.job_title = text(values.job_title)
  }
  if (changed.bio) {
    body.bio = text(values.bio)
  }
  if (changed.image_url) {
    body.image_url = values.image_url || null
  }
  for (const link of AUTHOR_LINKS) {
    if (changed[link]) {
      body[link] = text(values[link])
    }
  }
  if (changed.user_id) {
    body.user_id = values.user_id || null
  }
  // A new author sends only what was given
  return dirty
    ? body
    : Object.fromEntries(Object.entries(body).filter(([, value]) => value !== null))
}
