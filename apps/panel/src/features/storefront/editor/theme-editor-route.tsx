import { getRouteApi } from "@tanstack/react-router"
import { ThemeEditorPage } from "./theme-editor-page"

const route = getRouteApi("/_fullscreen/storefront/editor")

/**
 * The editor at its address: `?open=preferences` opens the storefront's
 * preferences at first; `?icerik=cnt_…` a content page (`&ayar=sayfa`: its
 * settings open); `?sayfa=icerik` the content pages.
 */
export function ThemeEditorRoute() {
  const { open, icerik, sayfa, ayar } = route.useSearch()
  const content = icerik ?? null
  return (
    <ThemeEditorPage
      open={open ?? (content !== null && ayar === "sayfa" ? "page-settings" : null)}
      content={content}
      onContent={content !== null || sayfa === "icerik"}
    />
  )
}
