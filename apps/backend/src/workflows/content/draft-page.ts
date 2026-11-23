import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../../lib/logging"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import { importPage } from "../migration/content-page"
import { deleteContentWorkflow, saveContentWorkflow } from "./workflows"

// A workflow rejects with its error serialized (no Error instance): read by its message
const pathTaken = (error: unknown): boolean => {
  const message = (error as { message?: unknown } | null)?.message
  return typeof message === "string" && message.includes("seo.path_taken")
}

/**
 * A content page opened as a **draft** for the shop to finish and publish
 * (a sector pack's pages, adr/0076 §12; a ready-made look's page, adr/0073
 * Ek 2026-11-19 (2) K6): its title and address, nothing else. With a text
 * (a pack's template), the page and its text are written together the way
 * an import writes them (`importPage`: the text is the page's sections in
 * the theme editor, K4); without one (a look lays the page out itself),
 * the page alone, through the content save. An address another record
 * holds opens none: null. A draft is closed to everyone (404) until the
 * shop publishes it.
 */
export async function openDraftPage(
  container: MedusaContainer,
  page: { title: string; handle: string },
  body: unknown = null
): Promise<string | null> {
  const values = {
    title: page.title,
    handle: page.handle,
    status: "draft" as const,
    excerpt: null,
    author_name: null,
    image_url: null,
    image_alt: null,
  }
  try {
    if (body !== null) {
      return await importPage(container, values, body)
    }
    const { result } = await saveContentWorkflow(container).run({
      input: { kind: "page", values },
    })
    return result.id
  } catch (error) {
    if (pathTaken(error)) {
      return null
    }
    throw error
  }
}

/**
 * Draft pages opened by a step that failed later taken away again: never
 * live, so their addresses are freed (no 410). Only a page still a draft
 * that never went live is deleted: one the shop published or changed
 * meanwhile is its own, kept and logged (security review S9). One that
 * cannot be deleted is logged and left, an empty draft (harmless; the
 * shop may delete it).
 */
export async function removeDraftPages(
  container: MedusaContainer,
  ids: readonly string[]
): Promise<void> {
  if (ids.length === 0) {
    return
  }
  const entries = await container
    .resolve<ContentModuleService>(CONTENT_MODULE)
    .listContentEntries(
      { id: [...ids], kind: "page" },
      { select: ["id", "status", "published_at"], take: null }
    )
  const drafts = new Set(
    entries
      .filter((entry) => entry.status === "draft" && entry.published_at === null)
      .map((entry) => entry.id)
  )
  for (const id of ids) {
    if (!drafts.has(id)) {
      logger.warn({ event: "content.draft_page_undo_kept", page: id })
      continue
    }
    try {
      await deleteContentWorkflow(container).run({ input: id })
    } catch (error) {
      logger.error({ event: "content.draft_page_undo_failed", page: id, err: errorSummary(error) })
    }
  }
}
