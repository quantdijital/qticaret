import "server-only"
import type { Resolution, StoreContentPageSection, StorePageLayout } from "@qticaret/types"
import type { ContentPageSectionView, Translate } from "@qticaret/ui"
import type { ContentEntry } from "@/lib/store-api/content-entry"
import { isStoreApiError } from "@/lib/store-api/errors"
import { previewPageLayout, publishedPageLayout, sessionPage } from "@/lib/store-api/page-layout"
import { isEditorSession, layoutPreviewToken, previewTokenKind } from "./layout"
import { pageAnchors } from "./page-anchors"
import { isStorePageText, pageTextView, type StorePageArticle } from "./page-text"
import { sectionViews, withLook } from "./sections"

type Entity = Extract<Resolution, { type: "entity" }>

/**
 * A content page's own layout as this request shows it (adr/0073 §5, §6):
 * the theme editor's live session reads the draft (the page in draft or
 * live), a signed design link the draft of a live page, anyone else the
 * published one. An answer that fails is no layout: the page is its text
 * alone (`contentSections`).
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
 * The page's text alone, when its layout did not come (adr/0073 Ek
 * 2026-11-19 (2) K7): its `body` mirror as the content read prints it,
 * one `article` without a mark (the editor has no section to point at).
 */
const textAlone = (entry: ContentEntry): StorePageArticle => ({
  id: "",
  type: "rich_text",
  variant: "article",
  title: null,
  html: entry.html,
  ...(entry.images ? { images: entry.images } : {}),
})

/**
 * A content page's sections as the theme draws them (adr/0073 Ek
 * 2026-11-19 (2) K8), one list in the shop's order: its own text sections
 * read here (`pageTextView`), the home page's types as the home page's and
 * the category page's are (`sectionViews`); the empty ones left out. Each
 * with its look and screens, and in the theme editor's live session its
 * field marks. A page whose layout did not come is its text alone. The
 * layout is asked for while the page itself is read (`entry`, for its
 * cover and that fallback).
 */
export async function contentSections(
  id: string,
  read: Promise<ContentEntry> | ContentEntry,
  t: Translate
): Promise<ContentPageSectionView[]> {
  const [layout, entry, editing] = await Promise.all([pageLayoutOf(id), read, isEditorSession()])
  const cover = Boolean(entry.image_url)
  const sections: readonly StoreContentPageSection[] = layout ? layout.sections : [textAlone(entry)]
  // One set for the page: each text's anchors clear of the theme's ids and of the texts before it
  // (each text takes them before its first wait, so in the page's order)
  const anchors = pageAnchors()
  const views = await Promise.all(
    sections.map(async (section, index): Promise<ContentPageSectionView[]> => {
      if (!isStorePageText(section)) {
        return sectionViews([section], t)
      }
      const view = await pageTextView(section, t, { opens: !cover && index === 0, anchors })
      if (!view) {
        return []
      }
      const shown = withLook(view, section)
      return [editing ? { ...shown, editor: true as const } : shown]
    })
  )
  return views.flat()
}

/**
 * A content page the theme editor's live session names by its id
 * (`?icerik=`, adr/0073 §5): the page in draft or live, as resolve would
 * have found a live one. Only the live session opens one; on any other
 * request, when the session does not name such a page, or when the
 * backend does not answer (the editor's preview then shows the draft's
 * home page, not an error): null.
 */
export async function draftContentPage(
  id: string
): Promise<{ page: Entity; entry: ContentEntry } | null> {
  const token = await layoutPreviewToken()
  if (!token || previewTokenKind(token) !== "session") {
    return null
  }
  const found = await sessionPage(token, id).catch((error: unknown) => {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  })
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
