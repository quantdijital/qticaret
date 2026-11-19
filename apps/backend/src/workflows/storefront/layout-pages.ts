import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../lib/errors"
import type { LayoutDocument } from "../../lib/storefront/layout"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"

/** A design with the layouts of pages gone since left out, and how many went. */
export interface PrunedPages {
  document: LayoutDocument
  dropped_pages: number
}

/**
 * The design's content page layouts held to the pages there are (adr/0073
 * §1): a page deleted since (in İçerik, in another tab) takes its layout
 * with it; the save goes on and says how many went (`dropped_pages`), so
 * a page gone elsewhere never locks the editor. A layout naming a blog
 * post, not a page, is a stale or forged editor: refused. A page in draft
 * keeps its layout: it shows once the page is live.
 */
export async function prunePages(
  container: MedusaContainer,
  doc: LayoutDocument
): Promise<PrunedPages> {
  if (doc.pages.length === 0) {
    return { document: doc, dropped_pages: 0 }
  }
  const entries = await container
    .resolve<ContentModuleService>(CONTENT_MODULE)
    .listContentEntries(
      { id: doc.pages.map((page) => page.page_id) },
      { select: ["id", "kind"], take: doc.pages.length }
    )
  if (entries.some((entry) => entry.kind !== "page")) {
    throw new ValidationError("storefront_layout.page_invalid", { field: "document.pages" })
  }
  const there = new Set(entries.map((entry) => entry.id))
  const pages = doc.pages.filter((page) => there.has(page.page_id))
  const dropped = doc.pages.length - pages.length
  return dropped === 0
    ? { document: doc, dropped_pages: 0 }
    : { document: { ...doc, pages }, dropped_pages: dropped }
}

/** `prunePages` as a step of the draft's save and of a publication; reads only. */
export const prunePagesStep = createStep(
  "storefront-layout-prune-pages",
  async (doc: LayoutDocument, { container }) => new StepResponse(await prunePages(container, doc))
)
