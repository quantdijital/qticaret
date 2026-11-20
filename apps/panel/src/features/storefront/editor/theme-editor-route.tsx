import { getRouteApi } from "@tanstack/react-router"
import { isJustMade } from "./just-made-page"
import { ThemeEditorPage } from "./theme-editor-page"

const route = getRouteApi("/_fullscreen/storefront/editor")

/**
 * The editor at its address: `?open=preferences` opens the storefront's
 * preferences at first; `?icerik=cnt_…` a content page (`&ayar=sayfa`: its
 * settings open); `?sayfa=icerik` the content pages. A page just made on
 * the Sayfalar list (`just-made-page`, never the address) gets its empty text.
 */
export function ThemeEditorRoute() {
  const { open, icerik, sayfa, ayar } = route.useSearch()
  const content = icerik ?? null
  const forPage =
    content === null
      ? null
      : isJustMade(content)
        ? "new-page"
        : ayar === "sayfa"
          ? "page-settings"
          : null
  return (
    <ThemeEditorPage
      open={open ?? forPage}
      content={content}
      onContent={content !== null || sayfa === "icerik"}
    />
  )
}
