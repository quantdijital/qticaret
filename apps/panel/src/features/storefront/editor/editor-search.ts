import { CONTENT_PAGE_ID } from "./editor-page"

export interface EditorSearch {
  open?: "preferences"
  /** The content page worked on (adr/0073 §5): a reload opens on it again. */
  icerik?: string
}

/**
 * The theme editor's address: `?open=preferences` opens the storefront's
 * preferences panel at first (the old Storefront > Preferences page's
 * links land there); `?icerik=cnt_…` opens a content page's layout (İçerik's
 * "Tema düzenleyicide tasarla", and the editor's own pick); anything else
 * is left out.
 */
export const editorSearch = (search: Record<string, unknown>): EditorSearch => {
  const icerik = search["icerik"]
  return {
    ...(search["open"] === "preferences" ? { open: "preferences" as const } : {}),
    ...(typeof icerik === "string" && CONTENT_PAGE_ID.test(icerik) ? { icerik } : {}),
  }
}
