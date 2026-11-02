import { ValidationError } from "../../lib/errors"
import { postCategoryPath, postTagPath } from "../../lib/seo"
import type { ContentKind, ContentTermKind } from "../../modules/content/service"

/**
 * A blog post's category and tags (adr/0019 ek 2026-11-03): at most one
 * category, any tags up to a limit, each a term of its kind. Pure: the
 * step loads the post's links and the terms the save names.
 */

export const MAX_POST_TAGS = 50

export interface TermRef {
  id: string
  kind: ContentTermKind
}

/** What a save sends; a field left out keeps its value, `null` and `[]` clear. */
export interface PostTermsInput {
  category_id?: string | null | undefined
  tag_ids?: string[] | undefined
}

export interface PostTermsPlan {
  /** The post's terms after the save: its category (if any) first. */
  next: TermRef[]
  add: TermRef[]
  remove: TermRef[]
}

export const termPath = (term: { kind: ContentTermKind; handle: string }): string =>
  term.kind === "category" ? postCategoryPath(term.handle) : postTagPath(term.handle)

/** Whether the save names any term at all. */
export const sendsTerms = (input: PostTermsInput | undefined): input is PostTermsInput =>
  input !== undefined && (input.category_id !== undefined || input.tag_ids !== undefined)

function termOf(
  found: ReadonlyMap<string, TermRef>,
  id: string,
  kind: ContentTermKind,
  field: string
): TermRef {
  const term = found.get(id)
  if (term?.kind !== kind) {
    throw new ValidationError("content.term_unknown", { field })
  }
  return term
}

/**
 * The post's terms after a save. Only a post takes terms: a page sending a
 * category or a tag is refused (clearing them is harmless). A category
 * given replaces the one it had; a tag list given replaces its tags.
 */
export function planPostTerms(
  kind: ContentKind,
  current: readonly TermRef[],
  input: PostTermsInput,
  found: ReadonlyMap<string, TermRef>
): PostTermsPlan {
  const tagIds = input.tag_ids === undefined ? undefined : [...new Set(input.tag_ids)]
  if (kind !== "post" && (typeof input.category_id === "string" || (tagIds?.length ?? 0) > 0)) {
    throw new ValidationError("content.terms_post_only", { field: "category_id" })
  }
  if (tagIds && tagIds.length > MAX_POST_TAGS) {
    throw new ValidationError("content.tags_too_many", { field: "tag_ids" })
  }
  const category =
    input.category_id === undefined
      ? current.filter((term) => term.kind === "category").slice(0, 1)
      : input.category_id === null
        ? []
        : [termOf(found, input.category_id, "category", "category_id")]
  const tags =
    tagIds === undefined
      ? current.filter((term) => term.kind === "tag")
      : tagIds.map((id) => termOf(found, id, "tag", "tag_ids"))
  const next = [...category, ...tags]
  const had = new Set(current.map((term) => term.id))
  const keeps = new Set(next.map((term) => term.id))
  return {
    next,
    add: next.filter((term) => !had.has(term.id)),
    remove: current.filter((term) => !keeps.has(term.id)),
  }
}
