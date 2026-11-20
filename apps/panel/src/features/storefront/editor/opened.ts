import type { FieldGroupName } from "./forms/field-registry"
import type { ThemeGroupName } from "./forms/theme-registry"
import type { FieldFocus } from "./use-field-focus"
import type { FooterPart } from "./footer-rows/footer-rows-fields"

/** The panel open beside the page's parts; none: the list alone. */
export type Opened =
  /** A section, at the field the settings search picked if it did (adr/0049 Ek 2026-11-14 §6). */
  | {
      kind: "section"
      id: string
      focus?: FieldFocus & { group: FieldGroupName }
      /** A free rows footer's row or block, in its own panel (adr/0070 §7). */
      part?: FooterPart
    }
  /** The theme's settings, at the field the settings search picked if it did. */
  | { kind: "theme"; focus?: FieldFocus & { group: ThemeGroupName } }
  /** The stock line and colour names, drafted with the design (adr/0049 Ek 2026-11-06). */
  | { kind: "looks" }
  /** How the storefront behaves (contact and info pages): saved at once, not drafted. */
  | { kind: "preferences" }
  /** A content page's own settings (adr/0073 Ek 2026-11-19 (2) K5): saved at once, not drafted. */
  | { kind: "page-settings"; page: string }
  | null

/** What names the open panel, so the column starts at its top when another opens. */
export function formKeyOf(opened: Opened, sectionId: string | null): string | null {
  if (sectionId !== null) {
    return opened?.kind === "section" && opened.part ? `${sectionId}:${opened.part.id}` : sectionId
  }
  return opened && opened.kind !== "section" ? opened.kind : null
}

/**
 * What the address opens at first: the preferences, the content page's
 * settings, or a page just made (`new-page`: its empty text is added and
 * opened once the page is known, `useContentPageEditing`).
 */
export type OpenAtFirst = "preferences" | "page-settings" | "new-page" | null

/** The panel the address opens at first (a new page's text is opened once it is added). */
export function openedAtFirst(which: OpenAtFirst, content: string | null): Opened {
  if (which === "new-page") {
    return null
  }
  if (which === "page-settings") {
    return content === null ? null : { kind: which, page: content }
  }
  return which ? { kind: which } : null
}
