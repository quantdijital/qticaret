import { CONTENT_PAGE_ID } from "./editor-page"

export interface EditorSearch {
  open?: "preferences"
  /** The content page worked on (adr/0073 §5): a reload opens on it again. */
  icerik?: string
  /** Opens on the content pages (İçerik's old Sayfalar tab, adr/0073 Ek 2026-11-19 (2) K5). */
  sayfa?: "icerik"
  /** Opens the content page's own settings at first (İçerik's old page address). */
  ayar?: "sayfa"
  /** The page was just made (the Sayfalar list's "Yeni sayfa"): its empty text is added and opened. */
  yeni?: "1"
}

/**
 * The theme editor's address: `?open=preferences` opens the storefront's
 * preferences panel at first (the old Storefront > Preferences page's
 * links land there); `?icerik=cnt_…` opens a content page (the editor's own
 * pick, İçerik's old page links), with its settings at first on
 * `&ayar=sayfa`; `?sayfa=icerik` opens on the content pages; anything
 * else is left out.
 */
export const editorSearch = (search: Record<string, unknown>): EditorSearch => {
  const icerik = search["icerik"]
  return {
    ...(search["open"] === "preferences" ? { open: "preferences" as const } : {}),
    ...(typeof icerik === "string" && CONTENT_PAGE_ID.test(icerik) ? { icerik } : {}),
    ...(search["sayfa"] === "icerik" ? { sayfa: "icerik" as const } : {}),
    ...(search["ayar"] === "sayfa" ? { ayar: "sayfa" as const } : {}),
    ...(search["yeni"] === "1" || search["yeni"] === 1 ? { yeni: "1" as const } : {}),
  }
}
