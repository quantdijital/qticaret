/**
 * The panel's map (adr/0079 §4): every screen of the panel, and the parts
 * of a screen worth going to on their own (a settings tab), with the
 * everyday words people look for it by. Data only: the panel's menu, its
 * command menu (Y1-0) and later the assistant's `find_screen` read it.
 */

/** A text in the panel's two languages. */
export interface PanelMapText {
  readonly tr: string
  readonly en: string
}

export interface PanelMapEntry<Need extends string = string> {
  /** Unique; a menu item's own key for the menu's items (`orders`). */
  readonly key: string
  /** The panel route's full path, a real screen (no redirect, no `$param`). */
  readonly path: string
  /** The route's search that opens the part (`{ part: "options" }`). */
  readonly search?: Readonly<Record<string, string>>
  /** The entry it sits under (`settings.shipping`): the trail "Ayarlar › Kargo ve teslimat". */
  readonly parent?: string
  /**
   * Shown only while this tenant flag is on (adr/0012), as in `navigation.ts`.
   * A parent's gate holds for its children too.
   */
  readonly feature?: string
  /** Shown only to a role with this capability (adr/0040), as in `navigation.ts`. */
  readonly needs?: Need
  /** Its name: an i18n key of the panel. */
  readonly label: string
  /** The everyday words it is looked for by, besides its name; never empty. */
  readonly keywords: { readonly tr: readonly string[]; readonly en: readonly string[] }
  /** What is done there, at most three sentences. */
  readonly help: PanelMapText
}
