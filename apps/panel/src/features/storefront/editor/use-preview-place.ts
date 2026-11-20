import { useState } from "react"
import type { BodyGroup } from "@/features/storefront/api/layout"
import { barePath } from "./editor-page"
import type { EditorPage } from "./editor-page"
import { useContentPages } from "./use-content-pages"
import type { PreviewSample } from "./use-preview-sample"
import { usePreviewTarget } from "./use-preview-target"

/** A page reached in the frame, named by its last part (`/urun/sef-bicagi` → `sef-bicagi`). */
export function sampleAt(path: string): PreviewSample {
  const [bare = ""] = path.split(/[?#]/)
  const last = bare.split("/").filter(Boolean).at(-1) ?? bare
  let name = last
  try {
    name = decodeURIComponent(last)
  } catch {
    // An odd escape: shown as it is
  }
  return { id: `visit:${path}`, name: name || path, path }
}

interface PlaceOptions {
  onPageChange: () => void
  /** The content page the editor's address names (`?icerik=`): opened on it. */
  content?: string | null
  /** Opened on the content pages (`?sayfa=icerik`), the shop's first if none is named. */
  onContent?: boolean
}

/**
 * Which page the editor works on and the preview shows (adr/0065 Faz 2):
 * the page picked above (home, a product's, a category's, a content
 * page, adr/0073 §5) and its sample; or a page reached by following a
 * link in the frame. A product's or a category's becomes that page with
 * that sample (its tree shows); a content page's, by its address among
 * the shop's pages, becomes that content page; any other (the cart, a
 * brand, the blog) is shown as it is, the picked page's tree kept, until
 * a page or sample is picked again.
 */
export function usePreviewPlace({
  onPageChange,
  content: opened = null,
  onContent = opened !== null,
}: PlaceOptions) {
  const [page, setPage] = useState<EditorPage>(onContent ? "content" : "home")
  // The content page picked; none yet: the shop's first (as a template's first sample)
  const [picked, setPicked] = useState<string | null>(opened)
  // A page reached in the frame that is none of the editor's pages: shown until one is picked
  const [visited, setVisited] = useState<string | null>(null)
  const pages = useContentPages(page === "content" || visited !== null)
  const content = page === "content" ? (picked ?? pages.data?.pages[0]?.id ?? null) : null
  const target = usePreviewTarget(page, content, pages.isPending)
  const shown = visited ?? target.path ?? "/"

  const choosePage = (next: EditorPage) => {
    setVisited(null)
    setPage(next)
    onPageChange()
  }
  const chooseContent = (id: string) => {
    setVisited(null)
    if (page !== "content" || id !== content) {
      setPicked(id)
      setPage("content")
      onPageChange()
    }
  }
  // A page reached in the frame that is one of the shop's content pages: that page, its tree
  // shown (once the pages are read, the frame's path known by then)
  const reached =
    visited === null ? undefined : pages.data?.pages.find((each) => each.path === barePath(visited))
  if (reached) {
    chooseContent(reached.id)
  }
  return {
    page,
    choosePage,
    /** The content page worked on (`page: "content"`); null: none (none in İçerik yet). */
    content,
    chooseContent,
    /** The page shown is one reached in the frame, none of the editor's (its path). */
    visited,
    target: {
      ...target,
      path: visited ?? target.path,
      finding: visited === null && target.finding,
      missing: visited === null ? target.missing : null,
      choose: (next: PreviewSample) => {
        setVisited(null)
        target.choose(next)
      },
    },
    /** A link followed in the frame: shown at once, its page worked out when it is drawn. */
    visit: (path: string) => {
      if (path !== shown) {
        setVisited(path)
      }
    },
    /**
     * The frame drew `path`, whose sections are `group`'s (null: none of the
     * editor's pages); `onPage`: the content page whose own sections they are.
     */
    land: (path: string, group: BodyGroup | null, onPage: string | null = null) => {
      // A content page with its own layout: that page (one without is told by its address)
      if (onPage !== null) {
        chooseContent(onPage)
        return
      }
      // The home page's sections: the home page (a path it fell back from goes with it)
      if (group === "home") {
        if (page !== "home") {
          choosePage("home")
        }
        setVisited(null)
        return
      }
      if ((group === "product" || group === "category") && path !== target.path) {
        target.chooseFor(group, sampleAt(path))
        if (page !== group) {
          setPage(group)
          onPageChange()
        }
        setVisited(null)
        return
      }
      if ((group === "product" || group === "category") && page === group) {
        setVisited(null)
        return
      }
      if (group === null && page === "content" && barePath(path) === target.path) {
        setVisited(null)
        return
      }
      if (group === null && path !== shown) {
        setVisited(path)
      }
    },
  }
}
