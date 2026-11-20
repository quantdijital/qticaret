import { useNavigate } from "@tanstack/react-router"
import { useEffect, useMemo, useRef } from "react"
import { shownPage } from "./editor-page"
import type { EditorSearch } from "./editor-search"
import { useContentPage } from "./use-content-pages"
import { usePreviewPlace } from "./use-preview-place"

/** The editor's address with the content page worked on, or without one. */
const withContent = (search: EditorSearch, content: string | null): EditorSearch => ({
  ...(search.open ? { open: search.open } : {}),
  ...(content ? { icerik: content } : {}),
})

/**
 * The page the editor works on (`usePreviewPlace`) with what a content
 * page adds (adr/0073 §5): the page picked, by its title; its id in the
 * address (`?icerik=`), so a reload opens on it again; and
 * its id for the preview while it is a draft.
 */
export function useEditorPlace({
  content: opened,
  onContent: startOnContent = opened !== null,
  onPageChange,
}: {
  /** The content page the address names at first. */
  content: string | null
  /** Opened on the content pages (`?sayfa=icerik`). */
  onContent?: boolean
  onPageChange: () => void
}) {
  const navigate = useNavigate()
  const place = usePreviewPlace({ onPageChange, content: opened, onContent: startOnContent })
  const onContent = place.page === "content"
  const picked = useContentPage(place.content).page
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
    /**
     * The content page worked on, once known among İçerik's pages (an id
     * the address names that is none, or no longer one, takes no section).
     */
    contentPage: {
      id: onContent && picked ? picked.id : null,
      title: onContent ? (picked?.title ?? null) : null,
    },
    /** A content page in draft shown: only the editor's own session shows it (`?icerik=`). */
    draftPage: onContent && picked?.status === "draft" ? picked.id : null,
  }
}
