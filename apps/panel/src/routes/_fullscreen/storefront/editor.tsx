import { createFileRoute } from "@tanstack/react-router"
import { ThemeEditorPage } from "@/features/storefront/editor/theme-editor-page"

/** `/storefront/editor`: the theme editor, full screen (adr/0049). */
export const Route = createFileRoute("/_fullscreen/storefront/editor")({
  component: ThemeEditorPage,
})
