import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { contentQuery } from "@/features/content/api/content"
import type { LayoutDocument } from "@/features/storefront/api/layout"
import type { EditorAction } from "@/features/storefront/layout/editor-state"
import { pageLayoutOf } from "@/features/storefront/layout/page-layouts"
import { idsOf, newPageText, newSectionId } from "@/features/storefront/layout/sections"
import type { TreeContentPage } from "./editor-page"
import { ContentPagePicker } from "./content-page-picker"
import { forgetJustMade } from "./just-made-page"
import { NewPageDialog } from "./new-page-dialog"
import type { Opened } from "./opened"
import { usePageSynth } from "./page-synth"
import { useContentPages } from "./use-content-pages"
import type { useEditorPlace } from "./use-editor-place"

/**
 * What the theme editor does with content pages (adr/0073 Ek 2026-11-19
 * (2) K5): the page picked shown with its text as sections when the
 * design has none for it (`view`, `act`, K1), a new page opened from the
 * picker (picked, an empty page text added), a page deleted from its
 * settings let go of (its layout out of the draft, the next page picked).
 * A page made on the Sayfalar list (`fresh`) gets its empty text once
 * known, and only while it is still new: a draft with no text and no layout
 * entry (never an existing page's text emptied).
 */
export function useContentPageEditing({
  doc,
  place,
  act,
  setOpened,
  fresh = null,
}: {
  doc: LayoutDocument
  place: ReturnType<typeof useEditorPlace>
  act: (action: EditorAction) => void
  setOpened: (opened: Opened) => void
  /** A page just made on the Sayfalar list (`just-made-page`): its empty text added once. */
  fresh?: string | null
}) {
  const synth = usePageSynth(doc, place.contentPage.id, act)
  const [adding, setAdding] = useState(false)
  const pages = useContentPages(place.page === "content").data?.pages ?? []
  // Its text, empty, as its first section: written in place
  const addText = (id: string) => {
    const sectionId = newSectionId(idsOf(synth.view))
    synth.act({ type: "add", group: "pages", page: id, section: newPageText(sectionId) })
    setOpened({ kind: "section", id: sectionId })
  }
  const added = useRef(false)
  const picked = place.contentPage.id
  const detail = useQuery({ ...contentQuery(fresh ?? ""), enabled: fresh !== null })
  const page = detail.data
  useEffect(() => {
    if (fresh === null || added.current || picked !== fresh || page?.id !== fresh) {
      return
    }
    added.current = true
    forgetJustMade(fresh)
    // Still new: a draft page, no text written, no layout of its own
    const blank = page.kind === "page" && (page.body.content?.length ?? 0) === 0
    if (page.status === "draft" && blank && !pageLayoutOf(doc, fresh)) {
      addText(fresh)
    }
  })
  const contentPage: TreeContentPage = {
    ...place.contentPage,
    synthesized: synth.synthesized,
    shownOnly: synth.shownOnly,
  }
  return {
    /** The draft as the editor shows it (the tree, the forms, the chooser). */
    view: synth.view,
    /** A change, making the picked page's entry first when it is shown synthesized. */
    act: synth.act,
    contentPage,
    /** The content page picker (beside the page choice) with its new page's dialog. */
    picker:
      place.page === "content" ? (
        <>
          <ContentPagePicker
            doc={doc}
            page={place.picked}
            onChange={place.chooseContent}
            onNew={() => {
              setAdding(true)
            }}
          />
          <NewPageDialog
            open={adding}
            onOpenChange={setAdding}
            onCreated={(id) => {
              place.chooseContent(id)
              addText(id)
            }}
          />
        </>
      ) : null,
    onPageDeleted: (id: string) => {
      act({ type: "drop-pages", ids: [id] })
      setOpened(null)
      const next = pages.find((page) => page.id !== id)
      if (next) {
        place.chooseContent(next.id)
      }
    },
  }
}
