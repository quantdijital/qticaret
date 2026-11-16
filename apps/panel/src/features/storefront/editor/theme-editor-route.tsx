import { getRouteApi } from "@tanstack/react-router"
import { ThemeEditorPage } from "./theme-editor-page"

const route = getRouteApi("/_fullscreen/storefront/editor")

/** The editor at its address: `?open=preferences` opens the storefront's preferences at first. */
export function ThemeEditorRoute() {
  const { open } = route.useSearch()
  return <ThemeEditorPage open={open ?? null} />
}
