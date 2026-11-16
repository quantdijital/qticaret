import { createFileRoute } from "@tanstack/react-router"
import { editorSearch } from "@/features/storefront/editor/editor-search"
import { ThemeEditorRoute } from "@/features/storefront/editor/theme-editor-route"

/**
 * `/storefront/editor`: the theme editor, full screen (adr/0049);
 * `?open=preferences` opens the storefront's preferences beside the parts.
 */
export const Route = createFileRoute("/_fullscreen/storefront/editor")({
  validateSearch: editorSearch,
  component: ThemeEditorRoute,
})
