import * as React from "react"

/**
 * The browser tab's title: the page's own title, then the panel's name
 * ("Siparişler · My L'arte"). Until a panel names itself, the name is the
 * one its `index.html` opened with; a page with no title of its own shows
 * the name alone.
 */
let page: string | undefined
let name = typeof document === "undefined" ? "" : document.title

function apply() {
  if (typeof document === "undefined") {
    return
  }
  document.title = page && name ? `${page} · ${name}` : (page ?? name)
}

/** The page's title in the browser tab, while the page is open. */
export function useDocumentTitle(title: string | undefined) {
  React.useEffect(() => {
    const own = title?.trim()
    if (!own) {
      return
    }
    page = own
    apply()
    return () => {
      // The next page may already have put its own title in
      if (page === own) {
        page = undefined
        apply()
      }
    }
  }, [title])
}

/** The panel's name after every page title (the shop's name in a shop's panel). */
export function useDocumentTitleName(next: string | undefined) {
  React.useEffect(() => {
    const own = next?.trim()
    if (own) {
      name = own
      apply()
    }
  }, [next])
}
