import type { MedusaContainer } from "@medusajs/framework/types"
import type { DescriptionDoc } from "../../lib/catalog/description"
import { listingDescriptionChanges } from "../../lib/catalog/listing-description"
import type { ContentDoc } from "../../lib/content/doc"
import { docPlainText } from "../../lib/content/plain"
import { ValidationError } from "../../lib/errors"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import type { ContentTermKind, ContentTermRecord } from "../../modules/content/service"
import { handleOf } from "./handle"
import { lineOf } from "./rules"

/**
 * What a blog category or tag may hold (adr/0019 ek 2026-11-03): a clean
 * name, a slug handle one term of its kind has (from the name unless
 * given), an optional description and a rank. The description is a
 * listing's (adr/0075 Ek 2026-11-24): a content document whose plain
 * text the server keeps in `description`, or plain text alone (an
 * import, a script), which drops the document.
 */

/**
 * `description` bounds plain text alone (an import); `document_text` a
 * document's text (adr/0075 Ek 2026-11-24): an archive's foot, not a
 * product's page, and the plain mirror stays the document's whole text.
 */
export const TERM_LIMITS = { name: 120, description: 1000, document_text: 5000 } as const

export interface TermInput {
  name?: string | undefined
  handle?: string | undefined
  description?: string | null | undefined
  /** The description as a checked document; null drops it and keeps the text. */
  description_doc?: ContentDoc | null | undefined
  rank?: number | undefined
}

export interface TermFields {
  kind: ContentTermKind
  name: string
  handle: string
  description: string | null
  /** The description as a document; `description` then holds its plain text. */
  description_doc: DescriptionDoc | null
  rank: number
}

function plainOf(raw: string | null): string | null {
  const text = raw?.trim() ?? ""
  return text === ""
    ? null
    : lineOf(text, TERM_LIMITS.description, "content.term_description_invalid")
}

/**
 * The term's text as stored, as a brand's is (adr/0075 §2): a document
 * and its plain text as `listingDescriptionChanges` says, or plain text
 * checked as before (one line), which drops a document the term had.
 */
export function termDescription(
  input: Pick<TermInput, "description" | "description_doc">,
  current: { description: string | null; description_doc?: unknown } | null
): Pick<TermFields, "description" | "description_doc"> {
  const before = {
    description: current?.description ?? null,
    description_doc: (current?.description_doc ?? null) as DescriptionDoc | null,
  }
  const text =
    input.description === undefined || input.description_doc !== undefined
      ? undefined
      : plainOf(input.description)
  if (input.description_doc && docPlainText(input.description_doc, TERM_LIMITS.document_text).cut) {
    throw new ValidationError("content.term_description_too_long", { field: "description_doc" })
  }
  const changes = listingDescriptionChanges(
    { doc: input.description_doc, text },
    { doc: before.description_doc, description: before.description },
    null
  )
  return {
    description:
      text !== undefined
        ? text
        : changes.description !== undefined
          ? changes.description
          : before.description,
    description_doc: changes.doc === undefined ? before.description_doc : changes.doc,
  }
}

/** The term as it will be stored; a handle another term of its kind holds is refused. */
export async function termPlan(
  container: MedusaContainer,
  kind: ContentTermKind,
  input: TermInput,
  current: ContentTermRecord | null
): Promise<TermFields> {
  const name = lineOf(
    input.name ?? current?.name ?? "",
    TERM_LIMITS.name,
    "content.term_name_invalid"
  )
  if (name === "") {
    throw new ValidationError("content.term_name_invalid", { field: "name" })
  }
  const handle =
    input.handle === undefined && current ? current.handle : handleOf(input.handle, name)
  const taken = await container
    .resolve<ContentModuleService>(CONTENT_MODULE)
    .listContentTerms({ kind, handle }, { select: ["id"] })
  if (taken.some((term) => term.id !== current?.id)) {
    throw new ValidationError("content.term_handle_taken", { field: "handle" })
  }
  return {
    kind,
    name,
    handle,
    ...termDescription(input, current),
    rank: input.rank ?? current?.rank ?? 0,
  }
}
