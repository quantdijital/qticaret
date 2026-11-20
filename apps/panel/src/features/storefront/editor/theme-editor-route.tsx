import { getRouteApi } from "@tanstack/react-router"
import { ThemeEditorPage } from "./theme-editor-page"

const route = getRouteApi("/_fullscreen/storefront/editor")

/**
 * The editor at its address: `?open=preferences` opens the storefront's
 * preferences at first; `?icerik=cnt_…` a content page (`&ayar=sayfa`: its
 * settings open; `&yeni=1`: just made, its empty text added); `?sayfa=icerik`
 * the content pages.
 */
export function ThemeEditorRoute() {
  const { open, icerik, sayfa, ayar, yeni } = route.useSearch()
  const content = icerik ?? null
  const forPage =
    content === null ? null : yeni ? "new-page" : ayar === "sayfa" ? "page-settings" : null
  return (
    <ThemeEditorPage
      open={open ?? forPage}
      content={content}
      onContent={content !== null || sayfa === "icerik"}
    />
  )
}
