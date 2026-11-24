import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { currentListingDoc, listingDescriptionDoc } from "../../lib/catalog/listing-description"
import { rewriteDocHrefs } from "../../lib/content/links"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import type { LinkDocument } from "./link-plan"
import { termDescription } from "./term-plan"
import type { TermFields } from "./term-plan"

/**
 * Blog categories' and tags' description documents (adr/0075 Ek
 * 2026-11-24) in the link rewrite (adr/0042 Ek 2026-11-05), as the
 * catalog's listings are (`link-listings.ts`): read as the storefront
 * shows them (a document whose text is no longer the term's is stale and
 * shows nowhere, so it is neither read nor written). Written as pages and
 * posts are, under the content lock the rewrite holds (a term's own save
 * takes that lock, so it is not run here), through the term's save rule
 * (`termDescription`: the document and its plain text together).
 */

type Container = Pick<MedusaContainer, "resolve">

const PAGE = 200

// A stored document: a JSON column with something in it
const WITH_DOC = { description_doc: { $ne: null } } as Record<string, unknown>

const content = (container: Container) => container.resolve<ContentModuleService>(CONTENT_MODULE)

export async function* termDocuments(
  container: Container,
  ids: readonly string[] | null
): AsyncGenerator<LinkDocument> {
  if (ids?.length === 0) {
    return
  }
  for (let skip = 0; ; skip += PAGE) {
    const rows = await content(container).listContentTerms(
      { ...WITH_DOC, ...(ids ? { id: [...ids] } : {}) },
      {
        select: ["id", "kind", "name", "description", "description_doc"],
        skip,
        take: PAGE,
        order: { id: "ASC" },
      }
    )
    for (const row of rows) {
      const doc = currentListingDoc(row.description_doc, row.description)
      if (doc) {
        yield {
          kind: row.kind === "category" ? "post_category" : "post_tag",
          id: row.id,
          title: row.name,
          doc,
        }
      }
    }
    if (rows.length < PAGE) {
      return
    }
  }
}

export interface RewriteTermsInput {
  ids: string[]
  next: Record<string, string>
}

type Previous = { id: string } & Pick<TermFields, "description" | "description_doc">

/**
 * Each term's document read again as it is now, its links given their new
 * addresses, written only when one changed; how many were. Undone, each
 * gets back the text it had.
 */
export const rewriteTermLinksStep = createStep(
  "content-rewrite-term-links",
  async (input: RewriteTermsInput, { container }) => {
    const service = content(container)
    const next = new Map(Object.entries(input.next))
    const previous: Previous[] = []
    const rows =
      input.ids.length > 0
        ? await service.listContentTerms(
            { id: input.ids },
            { select: ["id", "description", "description_doc"], take: null }
          )
        : []
    for (const row of rows) {
      const doc = currentListingDoc(row.description_doc, row.description)
      const out = doc ? rewriteDocHrefs(doc, next) : null
      // The new addresses are the shop's own paths; checked again as a save from the panel is
      const checked = out && out.changed > 0 ? listingDescriptionDoc.safeParse(out.doc) : null
      if (checked?.success) {
        await service.updateContentTerms({
          id: row.id,
          ...termDescription({ description_doc: checked.data }, row),
        })
        previous.push({
          id: row.id,
          description: row.description,
          description_doc: row.description_doc as TermFields["description_doc"],
        })
      }
    }
    return new StepResponse(previous.length, previous)
  },
  async (previous, { container }) => {
    const service = content(container)
    for (const row of previous ?? []) {
      await service.updateContentTerms(row)
    }
  }
)
