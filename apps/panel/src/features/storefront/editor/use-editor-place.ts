import { useNavigate } from "@tanstack/react-router"
import { useEffect, useMemo, useRef } from "react"
import { barePath, shownPage } from "./editor-page"
import type { EditorSearch } from "./editor-search"
import { useContactPath, useContentPage } from "./use-content-pages"
import { usePreviewPlace } from "./use-preview-place"

/** The editor's address with the content page worked on, or without one. */
const withContent = (search: EditorSearch, content: string | null): EditorSearch => ({
  ...(search.open ? { open: search.open } : {}),
  ...(content ? { icerik: content } : {}),
})

/**
 * The page the editor works on (`usePreviewPlace`) with what a content
 * page adds (adr/0073 §5): the page picked, by its title; whether it is
 * the contact page (its text stands with the form, `contact_form_path`);
 * its id in the address (`?icerik=`), so a reload opens on it again; and
 * its id for the preview while it is a draft.
 */
export function useEditorPlace({
  content: opened,
  onPageChange,
}: {
  /** The content page the address names at first. */
  content: string | null
  onPageChange: () => void
}) {
  const navigate = useNavigate()
  const place = usePreviewPlace({ onPageChange, content: opened })
  const onContent = place.page === "content"
  const picked = useContentPage(place.content).page
  const contactPath = useContactPath(onContent)
  const contact =
    picked !== null && contactPath !== null && barePath(contactPath) === barePath(picked.path)
  const shown = useMemo(() => shownPage(place.page, place.content), [place.page, place.content])

  // The page picked stays in the address; replaced, not added to the history
  const inAddress = onContent ? place.content : null
  const said = useRef(opened)
  useEffect(() => {
    if (said.current === inAddress) {
      return
    }
    said.current = inAddress
    void navigate({
      to: "/storefront/editor",
      search: (search: EditorSearch) => withContent(search, inAddress),
      replace: true,
      ignoreBlocker: true,
    })
  }, [inAddress, navigate])

  return {
    ...place,
    /** The page shown, as its sections are told from others'. */
    shown,
    /** The content page picked, as İçerik lists it; null: none (yet). */
    picked: onContent ? picked : null,
    contentPage: { id: place.content, title: onContent ? (picked?.title ?? null) : null, contact },
    /** A content page in draft shown: only the editor's own session shows it (`?icerik=`). */
    draftPage: onContent && picked?.status === "draft" ? picked.id : null,
  }
}
