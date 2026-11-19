import "server-only"
import type { Resolution, StorePageLayout } from "@qticaret/types"
import type { ContentPageView, Translate } from "@qticaret/ui"
import type { ContentEntry } from "@/lib/store-api/content-entry"
import { isStoreApiError } from "@/lib/store-api/errors"
import { previewPageLayout, publishedPageLayout, sessionPage } from "@/lib/store-api/page-layout"
import { layoutPreviewToken, previewTokenKind } from "./layout"
import { byPlacement, sectionViews } from "./sections"

type Entity = Extract<Resolution, { type: "entity" }>

/**
 * A content page's own layout as this request shows it (adr/0073 §5, §6):
 * the theme editor's live session reads the draft (the page in draft or
 * live), a signed design link the draft of a live page, anyone else the
 * published one. An answer that fails is no layout: the page is drawn as
 * before.
 */
export async function pageLayoutOf(id: string): Promise<StorePageLayout | null> {
  const token = await layoutPreviewToken()
  const kind = token ? previewTokenKind(token) : null
  try {
    if (token && kind === "session") {
      return (await sessionPage(token, id))?.page ?? null
    }
    if (token && kind === "link") {
      return await previewPageLayout(token, id)
    }
    return await publishedPageLayout(id)
  } catch (error) {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  }
}

/**
 * A content page's sections as the theme draws them, above its text and
 * below it, read as the home page's and the category page's are
 * (`sectionViews`). None, or none left to show: undefined, so the page's
 * view is as it was before pages took sections.
 */
export async function contentSections(
  id: string,
  t: Translate
): Promise<ContentPageView["sections"]> {
  const layout = await pageLayoutOf(id)
  if (!layout || layout.sections.length === 0) {
    return undefined
  }
  const { top, bottom } = byPlacement(layout.sections)
  const [above, below] = await Promise.all([sectionViews(top, t), sectionViews(bottom, t)])
  return above.length > 0 || below.length > 0 ? { top: above, bottom: below } : undefined
}

/**
 * A content page the theme editor's live session names by its id
 * (`?icerik=`, adr/0073 §5): the page in draft or live, as resolve would
 * have found a live one. Only the live session opens one; on any other
 * request, or when the session does not name such a page: null.
 */
export async function draftContentPage(
  id: string
): Promise<{ page: Entity; entry: ContentEntry } | null> {
  const token = await layoutPreviewToken()
  if (!token || previewTokenKind(token) !== "session") {
    return null
  }
  const found = await sessionPage(token, id)
  if (found?.entry.kind !== "page") {
    return null
  }
  return {
    page: {
      type: "entity",
      path: found.entry.path ?? "/",
      entity_type: "page",
      entity_id: found.entry.id,
      seo: null,
    },
    entry: found.entry,
  }
}
