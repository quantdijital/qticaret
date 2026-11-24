import type { MedusaContainer } from "@medusajs/framework/types"
import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { acquireLocksStep } from "../locking/acquire-locks"
import { releaseLocksStep } from "../locking/release-locks"
import { docStats } from "../../lib/content"
import type { ContentDoc } from "../../lib/content"
import { assertCards, bodyOf, mediaOf } from "../content/rules"
import { CONTENT_LOCK, saveContentWorkflow } from "../content/workflows"
import { LAYOUT_LOCK } from "../storefront/layout"
import { replacePageTextWorkflow } from "../storefront/page-text-replace"

/** A page's fields as an import saves them, its text apart (adr/0073 Ek 2026-11-19 (2) K4). */
export interface ImportedPage {
  title: string
  handle: string
  status: "draft" | "published"
  excerpt: string | null
  author_name: string | null
  image_url: string | null
  image_alt: string | null
}

/**
 * The page and its text as one workflow, under the design's and the
 * content's locks taken once (the nested workflows' own locks are skipped
 * when run as steps): the page saved, then its text written into the
 * theme editor's design and its mirror. A text step failing (refused, a
 * write failing) undoes the page's save: no empty page is left holding
 * its address, live or not.
 */
export const importPageWorkflow = createWorkflow(
  "migration-import-page",
  (input: { page: ImportedPage; doc: ContentDoc }) => {
    const keys = [LAYOUT_LOCK.key, CONTENT_LOCK.key]
    const held = acquireLocksStep({ ...LAYOUT_LOCK, key: keys })
    const saved = saveContentWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => ({
        kind: "page" as const,
        values: input.page,
      })),
    })
    replacePageTextWorkflow.runAsStep({
      input: transform({ saved, input }, ({ saved, input }) => ({
        page_id: saved.id,
        doc: input.doc,
      })),
    })
    releaseLocksStep(held)
    return new WorkflowResponse(transform({ saved }, ({ saved }) => saved.id))
  }
)

/**
 * A content page from the old site with its text (adr/0073 Ek 2026-11-19
 * (2) K4): its text checked first as the text step checks it (the
 * document, `{belirteç}`s, cards whose records exist, images the shop
 * uploaded), so a text refused makes no page; then the page and its text
 * written together (`importPageWorkflow`). Its id.
 */
export async function importPage(
  container: MedusaContainer,
  page: ImportedPage,
  body: unknown
): Promise<string> {
  const doc = bodyOf(body)
  await assertCards(container, doc)
  await mediaOf(
    container,
    docStats(doc).images.map((image) => image.src),
    "body"
  )
  const { result } = await importPageWorkflow(container).run({ input: { page, doc } })
  return result
}
