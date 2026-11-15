import { useState } from "react"
import type { BodyGroup } from "@/features/storefront/api/layout"
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

/**
 * Which page the editor works on and the preview shows (adr/0065 Faz 2):
 * the page picked above (home, a product's, a category's) and its sample;
 * or a page reached by following a link in the frame. A product's or a
 * category's becomes that page with that sample (its tree shows); any
 * other (the cart, a brand, the blog) is shown as it is, the picked
 * page's tree kept, until a page or sample is picked again.
 */
export function usePreviewPlace({ onPageChange }: { onPageChange: () => void }) {
  const [page, setPage] = useState<BodyGroup>("home")
  // A page reached in the frame that is none of the editor's pages: shown until one is picked
  const [visited, setVisited] = useState<string | null>(null)
  const target = usePreviewTarget(page)
  const shown = visited ?? target.path ?? "/"

  const choosePage = (next: BodyGroup) => {
    setVisited(null)
    setPage(next)
    onPageChange()
  }
  return {
    page,
    choosePage,
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
    /** The frame drew `path`, whose sections are `group`'s (null: none of the editor's pages). */
    land: (path: string, group: BodyGroup | null) => {
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
      if (group === null && path !== shown) {
        setVisited(path)
      }
    },
  }
}
