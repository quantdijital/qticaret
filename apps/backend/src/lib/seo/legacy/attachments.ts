/**
 * A WordPress attachment page (adr/0059 Ek 2026-11-06): an uploaded file's
 * own page under the record it was attached to, `/urun/dokum-tava/tava/`
 * or `/tava-bakimi/attachment/kapak/`. Nothing here takes its place but
 * the record's page, so it leads there. Only the shape is read here: the
 * resolver asks whether the parent is a moved record. Paths come
 * normalised (`parseRequestPath`).
 */

// A decoded slug: letters (Turkish ones too), digits and hyphens (`wordpress.ts`)
const SLUG = /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,199}$/u

/** WordPress's segment before an attachment's slug when the parent's permalink needs one. */
const ATTACHMENT_BASE = "attachment"

export interface AttachmentPage {
  /** The record's address the page hung under (`/urun/dokum-tava`). */
  parent: string
  /** The attachment's own slug (`tava`). */
  slug: string
}

/** The record an attachment page's address hangs under; null when the path has none. */
export function attachmentPage(path: string): AttachmentPage | null {
  const segments = path.split("/").slice(1)
  const slug = segments.at(-1) ?? ""
  if (segments.length < 2 || !SLUG.test(slug)) {
    return null
  }
  let parent = segments.slice(0, -1)
  if (parent.at(-1) === ATTACHMENT_BASE && parent.length > 1) {
    parent = parent.slice(0, -1)
  }
  return parent.every((segment) => segment !== "") ? { parent: `/${parent.join("/")}`, slug } : null
}
